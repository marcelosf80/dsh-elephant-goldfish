/**
 * Host half of the Elephant-Goldfish Model (EGM) bundle for DeepSeek Harness.
 *
 * The bundle ships the seven upstream EGM skills under `skills/`, the reviewer
 * personas under `agents/`, and the document standards under `resources/`.
 * This module publishes those skills through the `ctx.skills` provider
 * registry, so they reach the session catalog and the `skill` tool without
 * copying anything into `~/.dsh/skills`.
 *
 * Root resolution: skill bodies address shipped material as
 * `{{EGM_ROOT}}/agents/<persona>.md`, `{{EGM_ROOT}}/resources/...` and
 * `{{EGM_ROOT}}/docs/...`. The provider replaces that token with its own
 * installed package directory when it loads a body, so no skill text has to
 * hardcode a machine-, profile- or version-specific path. Paths the user owns,
 * such as `docs/designs/` or a target document, stay relative to the session
 * working directory and are never rewritten.
 *
 * Activation validates the whole shipped set synchronously: one unreadable or
 * misnamed skill fails the plugin row with a named error instead of degrading
 * into a permanent "some skills could not be checked" catalog.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_ROOT = join(PACKAGE_ROOT, 'skills')
const PROVIDER = 'egm'
const SOURCE = 'bundled'
// The bundled rank from `@deepseek-ai/dsh-skill` (a literal on purpose: a
// profile-installed bundle resolves no bare specifiers from the dsh
// installation, so importing that package would fail at activation). Lower
// rank wins a duplicate name inside one layer, so a project or user copy of an
// EGM skill (100-500) still overrides this one.
const BUNDLED_SKILL_RANK = 600
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ROOT_TOKEN = /\{\{EGM_ROOT\}\}/g

/** The registry this plugin contributes to. */
export const inject = ['skills']

/** Register the EGM skill provider; fiber disposal unregisters it. */
export function apply(ctx) {
  const candidates = loadCandidates()
  const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]))
  ctx.skills.registerProvider(() => createProvider(candidates, byName))
}

/** Model-facing paths use forward slashes, as the shipped providers render them. */
function toPosix(path) {
  return path.split('\\').join('/')
}

function fail(message) {
  throw new Error(`dsh-elephant-goldfish: ${message}`)
}

/**
 * Validate every shipped skill before registering the provider, so a packaging
 * defect surfaces as a failed activation with a path and a reason.
 */
function loadCandidates() {
  let entries
  try {
    entries = readdirSync(SKILLS_ROOT, { withFileTypes: true })
  } catch (error) {
    fail(`cannot read the skills directory at ${SKILLS_ROOT}: ${error.message}`)
  }
  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillFile = join(SKILLS_ROOT, entry.name, 'SKILL.md')
    let text
    try {
      text = readFileSync(skillFile, 'utf8')
    } catch (error) {
      fail(`skill "${entry.name}" has no readable body at ${skillFile}: ${error.message}`)
    }
    const parsed = parseSkillFile(text)
    if (parsed === undefined) {
      fail(`skill "${entry.name}" has no valid frontmatter (name and description are required) at ${skillFile}`)
    }
    if (parsed.name !== entry.name) {
      fail(`skill "${entry.name}" declares name "${parsed.name}"; the directory name and the frontmatter name must match`)
    }
    if (!SKILL_NAME.test(parsed.name)) {
      fail(`skill name "${parsed.name}" is not kebab-case ([a-z0-9]+ groups joined by "-")`)
    }
    candidates.push(candidateOf(parsed, skillFile))
  }
  if (candidates.length === 0) fail(`no skills found under ${SKILLS_ROOT}`)
  return candidates
}

function candidateOf(parsed, skillFile) {
  const candidate = {
    name: parsed.name,
    description: parsed.description,
    invocation: {
      modelInvocable: parsed.modelInvocable,
      userInvocable: parsed.userInvocable,
    },
    source: SOURCE,
    provider: PROVIDER,
    rank: BUNDLED_SKILL_RANK,
    path: toPosix(skillFile),
    // Rendered to the model as "Base directory for this skill: <path>".
    resourceBase: { kind: 'directory', path: toPosix(dirname(skillFile)) },
    // Opaque discovery locator, handed back to get(); never model-facing.
    locator: { file: skillFile },
  }
  if (parsed.whenToUse !== undefined) candidate.whenToUse = parsed.whenToUse
  return candidate
}

/**
 * Build the provider. The catalog is the validated set from activation; bodies
 * are re-read on every load so edits need no reload.
 */
function createProvider(candidates, byName) {
  return {
    name: PROVIDER,

    async list() {
      return candidates
    },

    async get(candidate, options = {}) {
      const known = byName.get(candidate.name)
      if (known === undefined) return undefined
      const { rank: _rank, locator, ...summary } = known
      let text
      try {
        text = await readFile(locator.file, { encoding: 'utf8', signal: options.signal })
      } catch {
        return undefined
      }
      const parsed = parseSkillFile(text)
      // The registry rejects a definition whose name no longer matches the
      // candidate that was selected from discovery.
      if (parsed === undefined || parsed.name !== candidate.name) return undefined
      return {
        ...summary,
        content: parsed.body.replace(ROOT_TOKEN, toPosix(PACKAGE_ROOT)).trim(),
      }
    },
  }
}

/**
 * Read one `SKILL.md`: YAML frontmatter plus the instruction body.
 * Only the plain subset EGM uses is supported (inline scalars, `>`/`|` block
 * scalars, booleans); anything else is ignored rather than guessed.
 */
function parseSkillFile(text) {
  const source = text.replace(/^\uFEFF/, '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (match === null) return undefined
  const meta = parseFrontmatter(match[1])
  const name = typeof meta.name === 'string' ? meta.name : undefined
  const description = typeof meta.description === 'string' ? meta.description.trim() : undefined
  if (name === undefined || name === '' || description === undefined || description === '') return undefined
  return {
    name,
    description,
    whenToUse: typeof meta.whenToUse === 'string' ? meta.whenToUse : undefined,
    modelInvocable: meta['disable-model-invocation'] !== true,
    userInvocable: meta['user-invocable'] !== false,
    body: source.slice(match[0].length),
  }
}

function parseFrontmatter(source) {
  const lines = source.split(/\r?\n/)
  const meta = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    const keyed = /^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$/.exec(line)
    if (keyed === null) continue
    const key = keyed[1]
    const inline = (keyed[2] ?? '').trim()
    if (/^[>|][-+]?$/.test(inline)) {
      const block = []
      let cursor = index + 1
      for (; cursor < lines.length; cursor += 1) {
        const next = lines[cursor]
        if (next.trim() === '') {
          block.push('')
          continue
        }
        if (!/^[ \t]/.test(next)) break
        block.push(next)
      }
      index = cursor - 1
      meta[key] = foldBlock(block, inline[0] === '>')
      continue
    }
    meta[key] = parseScalar(inline)
  }
  return meta
}

function foldBlock(lines, folded) {
  const indents = lines.filter((line) => line.trim() !== '').map((line) => (/^[ \t]*/.exec(line) ?? [''])[0].length)
  const indent = indents.length > 0 ? Math.min(...indents) : 0
  const stripped = lines.map((line) => (line.trim() === '' ? '' : line.slice(indent)))
  if (!folded) return stripped.join('\n').trim()
  const parts = []
  for (const line of stripped) {
    if (line === '') {
      parts.push('\n')
      continue
    }
    if (parts.length > 0 && parts[parts.length - 1] !== '\n') parts.push(' ')
    parts.push(line)
  }
  return parts.join('').trim()
}

function parseScalar(raw) {
  if (raw === '') return ''
  if (raw.length >= 2) {
    const first = raw[0]
    const last = raw[raw.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return raw.slice(1, -1)
  }
  const lowered = raw.toLowerCase()
  if (lowered === 'true' || lowered === 'yes' || lowered === 'on') return true
  if (lowered === 'false' || lowered === 'no' || lowered === 'off') return false
  return raw
}
