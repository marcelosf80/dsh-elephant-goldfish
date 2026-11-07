// Pass 2 of the DSH skill adaptation: command-form and tool-name fixes that the
// port analysis flagged. Every rule must match, or the script fails loudly.
// Run with: node _tools/adapt-skills-pass2.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS = join(import.meta.dirname, '..', 'skills')

const rules = [
  {
    label: 'ask_user_question tool name',
    find: /`ask_question`/g,
    replace: '`ask_user_question`',
    min: 13,
  },
  {
    label: 'bare DSH skill invocation form',
    find: /\/egm:egm-/g,
    replace: '/egm-',
    min: 5,
  },
  {
    label: 'drop the host command-form wrapper',
    find: /with the host's command form \(for example ([^)]*?)\)/gs,
    replace: 'with $1',
    min: 3,
  },
  {
    label: 'drop the Claude/Codex spelling note',
    find: / in Claude Code and agy CLI, or the skill picker in Codex\./g,
    replace: ' (or the skill picker).',
    min: 3,
  },
  {
    label: 'inline scout on DSH (bootstrap)',
    find: 'If your harness has no subagent tool, run the scout steps inline.',
    replace:
      'If your harness has no subagent tool, run the scout steps inline. On DeepSeek Harness, delegation depth is capped at 1, so a spawned worker cannot spawn further: run the scout steps inline there too.',
    min: 1,
  },
]

const totals = new Map(rules.map((rule) => [rule.label, 0]))
const files = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(SKILLS, entry.name, 'SKILL.md'))

for (const file of files) {
  let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const applied = []
  for (const rule of rules) {
    const count = (text.match(rule.find) ?? []).length
    if (count === 0) continue
    text = text.replace(rule.find, rule.replace)
    totals.set(rule.label, totals.get(rule.label) + count)
    applied.push(`${rule.label} x${count}`)
  }
  writeFileSync(file, text, 'utf8')
  if (applied.length > 0) console.log(`${file.split('\\').at(-2)}: ${applied.join(', ')}`)
}

let failed = false
for (const rule of rules) {
  const total = totals.get(rule.label)
  if (total < rule.min) {
    console.error(`FAIL: ${rule.label} matched ${total}, expected at least ${rule.min}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log('OK: all pass-2 rules applied at or above their expected counts')
