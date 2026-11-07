// Offline contract test for the bundle's Host provider.
// It imports the real module, captures the provider the plugin registers, and
// exercises list()/get() the way the skill registry does.
// Run with: node _tools/test-provider.mjs
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

const moduleUrl = new URL('../lib/index.js', import.meta.url)
const plugin = await import(moduleUrl.href)

assert.equal(typeof plugin.apply, 'function', 'apply export')
assert.deepEqual(plugin.inject, ['skills'], 'inject declares the skills service')

let provider
const ctx = {
  skills: {
    registerProvider(factory) {
      provider = factory({ signal: new AbortController().signal, invalidate() {} })
      return () => {}
    },
  },
}
plugin.apply(ctx)
assert.ok(provider, 'provider registered')
assert.equal(provider.name, 'egm')

const candidates = await provider.list()
const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]))
assert.equal(candidates.length, 7, `expected 7 skills, got ${candidates.length}: ${[...byName.keys()].join(', ')}`)

const expected = ['egm-bootstrap', 'egm-brainstorm', 'egm-draft', 'egm-drift-report', 'egm-resolve', 'egm-review', 'egm-review-loop']
assert.deepEqual([...byName.keys()].sort(), expected, 'exact skill names')

const userOnly = ['egm-brainstorm', 'egm-draft', 'egm-review']
const modelInvocable = ['egm-bootstrap', 'egm-drift-report', 'egm-resolve', 'egm-review-loop']
for (const name of userOnly) {
  const candidate = byName.get(name)
  assert.equal(candidate.invocation.modelInvocable, false, `${name} must stay user-invoked`)
  assert.equal(candidate.invocation.userInvocable, true, `${name} must stay user-invocable`)
}
for (const name of modelInvocable) {
  const candidate = byName.get(name)
  assert.equal(candidate.invocation.modelInvocable, true, `${name} must be model-invocable`)
  assert.equal(candidate.invocation.userInvocable, true, `${name} must stay user-invocable`)
}

for (const name of expected) {
  const candidate = byName.get(name)
  assert.ok(candidate.description.length > 20, `${name} description`)
  assert.equal(candidate.provider, 'egm')
  assert.equal(candidate.source, 'bundled')
  assert.equal(candidate.resourceBase.kind, 'directory')
  assert.ok(candidate.resourceBase.path.endsWith(`skills\\${name}`) || candidate.resourceBase.path.endsWith(`skills/${name}`), `${name} resource base`)

  const definition = await provider.get(candidate)
  assert.ok(definition, `${name} loads`)
  assert.equal(definition.name, name, `${name} definition name matches candidate`)
  assert.ok(definition.content.length > 0, `${name} body`)
  assert.equal(definition.content.includes('{{EGM_ROOT}}'), false, `${name} token fully substituted`)
  const packageRoot = resolve(candidate.resourceBase.path, '..', '..').split('\\').join('/')
  assert.ok(definition.content.includes(packageRoot), `${name} body carries the installed root ${packageRoot}`)
  assert.equal(definition.content.startsWith('---'), false, `${name} frontmatter stripped`)
}

const unknown = await provider.get({ name: 'egm-does-not-exist' })
assert.equal(unknown, undefined, 'unknown candidate yields undefined')

console.log(`OK: ${candidates.length} skills, all bodies loaded and token-substituted`)
for (const candidate of candidates) {
  console.log(`  ${candidate.name.padEnd(20)} model=${String(candidate.invocation.modelInvocable).padEnd(5)} user=${candidate.invocation.userInvocable}`)
}
