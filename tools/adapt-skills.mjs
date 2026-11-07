// One-shot adapter for the EGM skills copied into bundle/skills.
// Rewrites the harness pointer lines and the invocation policy for DSH.
// Run with: node _tools/adapt-skills.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS = join(import.meta.dirname, '..', 'skills')

// DeepSeek Harness is model-invoked for the four supporting skills; the three
// entry skills keep EGM's disable-model-invocation so they stay user-started.
const MODEL_INVOCABLE = new Set(['egm-resolve', 'egm-review-loop', 'egm-bootstrap', 'egm-drift-report'])

const POINTER_OLD = 'When running in Codex or ChatGPT Work, first read [Codex integration](../../docs/codex.md).\nIn Claude Code or Cowork, read `${CLAUDE_PLUGIN_ROOT}/docs/claude.md` first.'
const POINTER_NEW = 'In DeepSeek Harness, first read the EGM DSH integration guide at `{{EGM_ROOT}}/docs/dsh.md`. Keep that guide open: it maps every delegation, gate, and artifact rule below onto this harness.'

const HARNESSES_OLD = 'See `docs/harnesses.md`.'
const HARNESSES_NEW = 'See `{{EGM_ROOT}}/docs/dsh.md`.'

const TOOLS_OLD = '(Antigravity: `invoke_subagent`; Claude Code: `Agent`; Codex: `spawn_agent`)'
const TOOLS_NEW = '(DeepSeek Harness: `subagent`; Antigravity: `invoke_subagent`; Claude Code: `Agent`; Codex: `spawn_agent`)'

const report = []
for (const dir of readdirSync(SKILLS, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const name = dir.name
  const file = join(SKILLS, name, 'SKILL.md')
  // Git checked these out with CRLF on Windows; ship LF so the replacements
  // below and the Host parser both see one line-ending convention.
  let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const applied = []
  const swap = (from, to, label) => {
    if (!text.includes(from)) return
    text = text.split(from).join(to)
    applied.push(label)
  }
  swap(POINTER_OLD, POINTER_NEW, 'harness pointer')
  swap(HARNESSES_OLD, HARNESSES_NEW, 'delegation guide link')
  swap(TOOLS_OLD, TOOLS_NEW, 'subagent tool name')
  if (MODEL_INVOCABLE.has(name) && text.includes('disable-model-invocation: true\n')) {
    text = text.replace('disable-model-invocation: true\n', '')
    applied.push('model-invocable frontmatter')
  }
  writeFileSync(file, text, 'utf8')
  report.push(`${name}: ${applied.length > 0 ? applied.join(', ') : 'NO CHANGE'}`)
}

console.log(report.join('\n'))
