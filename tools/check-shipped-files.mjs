// Every path a skill or persona mentions must exist in the bundle, or in the
// user's working directory when it is a user artifact path.
// Run with: node _tools/check-shipped-files.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const missing = []
const checked = new Set()

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

// Files that intentionally stay outside the bundle: user artifacts and paths
// the skills only name as examples.
const userArtifacts = /^(docs\/designs|concepts_brief\.md|design_draft\.md|.*_report\.md|goldfish_review_report\.md)/

const patterns = [
  /`(agents\/[A-Za-z0-9_.-]+\.md)`/g,
  /`(resources\/[A-Za-z0-9_./-]+\.md)`/g,
  /`(references\/[A-Za-z0-9_./-]+)`/g,
  /`(docs\/[A-Za-z0-9_./-]+\.md)`/g,
]

const skillDocs = walk(join(root, 'skills'))
const agentDocs = walk(join(root, 'agents'))
const resourceDocs = walk(join(root, 'resources'))
const allDocs = [...skillDocs, ...agentDocs, ...resourceDocs, join(root, 'docs', 'dsh.md')]

for (const doc of allDocs) {
  const isSkill = doc.includes(`${root}\\skills\\`)
  const text = readFileSync(doc, 'utf8')
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const referenced = match[1]
      const key = `${doc}|${referenced}`
      if (checked.has(key)) continue
      checked.add(key)
      if (userArtifacts.test(referenced)) continue
      const candidates = isSkill ? [join(root, referenced), join(doc, '..', referenced)] : [join(root, referenced)]
      if (candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile())) continue
      missing.push(`${doc.replace(root + '\\', '')} -> ${referenced}`)
    }
  }
}

if (missing.length > 0) {
  console.error(`MISSING ${missing.length} referenced file(s):`)
  for (const line of missing) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`OK: ${checked.size} distinct file references across ${allDocs.length} markdown files all resolve inside the bundle`)
