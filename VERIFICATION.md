# Verification record

Environment: DeepSeek Harness `0.2.2-rc.1`, profile `desktop` on Windows, Node
`v24.15.0`. Recorded 2026-11-07. Install source: this directory, linked into the
profile as `link:C:/Users/marce/OneDrive/Desktop/plug-in elefant/bundle`.

## 1. Installation

`plugin_manager { action: "install_bundle", target: "<this directory>" }` returned:

```json
{"stage":"enable","target":"dsh-elephant-goldfish","enabled":true,"changed":true,
 "application":"applied","bundle":"dsh-elephant-goldfish","version":"0.1.1","warnings":[]}
```

`application: applied` with an empty `warnings` array is the live-change signal;
the package manager exit code was 0. The profile now records the bundle:

- `~/.dsh/profiles/desktop/package.json` → `dependencies["dsh-elephant-goldfish"] = "link:.../bundle"` and `dsh.profile.bundles` includes `dsh-elephant-goldfish`.
- `plugin_manager { action: "list_bundles" }` → entry `dsh-elephant-goldfish`, `enabled: true`, `installed: true`, rows `[{rowId: "egm", moduleName: "dsh-elephant-goldfish", entryId: "include:egm"}]`.
- `cordis_inspect_query` `Config.listConfigs {name: "dsh-elephant-goldfish"}` → one entry `include:egm`, `patchId: "egm"`, `status: "absent"` (the row exists and exports no config schema, which is what `absent` reports here).

## 2. Live skill registration

The session catalog changed at install time and gained exactly the four
model-invocable EGM skills. Disabling and re-enabling the row changed the catalog
again, in both directions, which proves the dynamic effect rather than a stale
boot payload:

| Step | Catalog effect |
| --- | --- |
| `install_bundle` | `egm-bootstrap`, `egm-drift-report`, `egm-resolve`, `egm-review-loop` appear |
| `set_plugin {enabled:false, target:"include:egm"}` | all four disappear |
| `set_plugin {enabled:true, target:"include:egm"}` | all four return |

`skill { name: "egm-drift-report" }` returned a full `<skill_content>` block:

```text
<skill_resources>
Base directory for this skill: C:/Users/marce/OneDrive/Desktop/plug-in elefant/bundle/skills/egm-drift-report
...
<skill_instructions>
# Detect Drift In Designs and Code

In DeepSeek Harness, first read the EGM DSH integration guide at `C:/Users/marce/OneDrive/Desktop/plug-in elefant/bundle/docs/dsh.md`. ...
```

That single result proves: discovery, body load, frontmatter stripping, the
`{{EGM_ROOT}}` substitution, and the per-skill directory resource guidance.

`skill { name: "egm-review" }` returned
`Error: skill "egm-review" is not available for model invocation`. The skill is
discovered and registered but keeps EGM's `disable-model-invocation: true`, which
is the intended user-started policy for the three entry skills.

## 3. Offline contract tests

Both scripts are in `tools/` and run with plain Node, no dependencies:

```text
node tools/test-provider.mjs
OK: 7 skills, all bodies loaded and token-substituted
  egm-bootstrap        model=true  user=true
  egm-brainstorm       model=false user=true
  egm-draft            model=false user=true
  egm-drift-report     model=true  user=true
  egm-resolve          model=true  user=true
  egm-review           model=false user=true
  egm-review-loop      model=true  user=true

node tools/check-shipped-files.mjs
OK: 14 distinct file references across 27 markdown files all resolve inside the bundle
```

The first script imports the real `lib/index.js`, captures the provider the
plugin registers, and asserts names, invocation policy, resource bases, body
load, frontmatter stripping, token substitution and the unreadable-locator path.
The second one catches a shipped-material reference that no longer resolves —
it found one during development (`docs/harnesses.md`, which this port does not
ship) and that link was removed.

### 3.1 Adaptation passes applied

Two scripted passes made the skill text correct for this harness; each rule is
counted and a missing match fails the run:

| Pass | Change | Sites |
| --- | --- | --- |
| pass 2 | `ask_question` → `ask_user_question` | 13 |
| pass 2 | Claude command form `/egm:egm-…` → `/egm-…` | 4 |
| pass 2 | "with the host's command form (for example …)" wrapper removed | 2 |
| pass 2 | "in Claude Code and agy CLI, or the skill picker in Codex" note removed | 2 |
| pass 2 | `egm-bootstrap`: inline scout sentence for DSH | 1 |

`node tools/adapt-skills-pass3.mjs` then asserts that no `command form`,
`Claude Code and agy`, `/egm:egm-`, or `` `ask_question` `` text survives in the
skill bodies. The port-analysis rules that rewrite whole EGM subflows (the synthesizer path, the bootstrap scout) were not
applied as body rewrites: DSH's depth cap makes the skills' own existing
fallbacks correct, and `docs/dsh.md` states the rule once. That keeps the review
protocol text upstream.

### 3.2 Delegation depth is 1 — the finding behind those rules

`@deepseek-ai/dsh-tool-subagent/README.md` documents the cap:

```text
| `maxDepth` | Host setting (`1`) | Absolute delegation-depth cap (`0` forbids
delegation); and "The tool stays visible at the cap; each attempted start checks
the calling agent's current depth and rejects with an errored result."
```

So a spawned child cannot spawn. The end-to-end run below is depth 1 from the
main context, which is exactly the legal path. `egm-synthesizer` remains shipped
and unmodified but no DSH flow should spawn it; `egm-bootstrap` workers read
their scout input inline.

## 4. End-to-end reviewer dispatch

Stage 5 of `egm-review` (`egm-zoom-out` + `egm-inventive-catalyst`) was run on a
small fixture using the direct-dispatch path the integration guide specifies:
one fresh `subagent` per reviewer, absolute persona and standard paths in the
prompt, read-only rules, no parent conversation content. Both reviewers read
their persona and the document standard, read the target, and returned
formatted findings; the orchestrated report was written to a fixture outside this repository
(`_e2e/zoom_out_report.md` in the authoring workspace).

Evidence from that run:

- Each reviewer reported reading `bundle/agents/<persona>.md` and, for zoom-out,
  `bundle/resources/document_standards/zoom-out-standard.md`.
- The zoom-out reviewer correctly declared the codebase reuse search as
  **unverified** because the workspace has no implementation source, instead of
  inventing matches — the persona's own rule.
- Both used the persona's severity vocabulary and output format.
- Neither wrote files or spawned a further subagent.

## 5. Not verified here

- **Typed `/egm-*` gesture.** User-explicit invocation (`/name` token in direct
  user input) is the documented DSH entry point for the three user-only skills.
  This session cannot send user messages to itself, so that surface is verified
  only by registration policy (`userInvocable: true`), not by a typed gesture.
  Check it manually: send `/egm-drift-report` in a project with a design folder.
- **Rendered display metadata.** `locale/en.json`, `locale/es.json`, and
  `icon.svg` are exported and the bundle row shows the package description, but
  the Plugin Manager page was not visually inspected (no browser control), so
  the rendered title, translated description, and icon remain visually unverified.
- **Full five-stage review.** Only Stage 5 was executed. Stages 6–9, the
  uninterrupted subflow, and `egm-resolve` remediation were not run.
- **Nesting.** Upstream's `egm-synthesizer` persona nests reviewers on hosts that
  allow it. This port deliberately uses direct dispatch from the orchestrating
  context; a synthesizer child spawning reviewers is not exercised.

### 3.3 Live checks after the final refactor

The plugin row was toggled `false` → `true` twice after the code changed, so the
running process loaded the final module generation rather than a cached one.
Each toggle changed the live catalog (the four model-invocable EGM skills left
and returned) and each re-enable reported `application: applied` with no
warnings — which also means `apply()`'s new fail-loud validation of all seven
shipped skills passed in the real runtime.

**Body size / tool-result pruner probe.** The top-ranked risk from the parallel
research was that three model-invocable skills exceed a documented 8192-character
trim threshold, which would silently delete their middle when loaded with the
`skill` tool. `skill { name: "egm-resolve" }` (8,531 bytes) returned every part of
the file: the marker at 25% of the document, the marker at 50%, the marker at
75%, and the final line, in order. So no trimming occurs in this profile.
`plugin_manager list_plugins` shows `include:tool-result-pruner` with
`enabled: false`; the 8192-character note in `@deepseek-ai/dsh-agent-preset`
describes the shipped standard preset, not this live composition. A profile that
re-enables that row at its default threshold would trim `egm-bootstrap`
(23.8 KB), `egm-review-loop` (10.4 KB) and `egm-resolve` (8.5 KB) — the
mitigation is to raise that threshold or to move those bodies into `references/`
before enabling it.

**Ask-user schema.** `cordis_inspect_query` `Tool.listTools` confirms the live
`ask_user_question` schema: `questions[]` with required `id` and `question`,
optional `header`, `multi_select`, and `options[]` objects carrying `label` and
`description`. This matches the payload mapping in `docs/dsh.md`.

## Reproduce

```text
plugin_manager { action: "install_bundle", target: "<abs path to bundle>" }
cordis_inspect_query host Config.listConfigs { name: "dsh-elephant-goldfish" }
skill { name: "egm-drift-report" }        # model-invocable skill
skill { name: "egm-review" }              # expect the policy error
node tools/test-provider.mjs
node tools/check-shipped-files.mjs
```

Remove the bundle with `plugin_manager { action: "remove_bundle", target: "dsh-elephant-goldfish" }`.
The fixture report lived outside this repository and is not shipped; the
installed plugin does not depend on it.
