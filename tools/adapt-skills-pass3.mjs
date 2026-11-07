// Pass 3: finish the Claude/Codex command-form cleanup that pass 2 could not
// match because the upstream text wraps those phrases across lines.
// Run with: node _tools/adapt-skills-pass3.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS = join(import.meta.dirname, '..', 'skills')
const files = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(SKILLS, entry.name, 'SKILL.md'))

const squash = (text) => text.replace(/\s+/g, ' ').trim()

for (const file of files) {
  let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  text = text.replace(
    /with (?:the )?host's\s+command\s+form \(for\s+example\s+([\s\S]*?)\)/g,
    (_match, example) => `with ${squash(example)}`,
  )
  text = text.replace(/ in Claude Code\s+and agy\s+CLI, or the skill picker in Codex([.,])/g, ' (or the skill picker)$1')
  writeFileSync(file, text, 'utf8')
}

// Nothing harness-specific may remain in the skill bodies.
const leftovers = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const needle of ['command form', 'Claude Code and agy', '/egm:egm-', '`ask_question`']) {
    if (text.includes(needle)) leftovers.push(`${file.split('\\').at(-2)}: ${needle}`)
  }
}
if (leftovers.length > 0) {
  console.error('LEFTOVER harness-specific text:')
  for (const line of leftovers) console.error(`  ${line}`)
  process.exit(1)
}
console.log('OK: no Claude/Codex command forms or old tool names remain in the skill bodies')
