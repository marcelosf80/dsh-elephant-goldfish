# DeepSeek Harness integration

This bundle runs the Elephant-Goldfish Model (EGM) inside DeepSeek Harness
(DSH). EGM's skill text is shared with every other harnesses it supports; this
page is the only place that maps it onto DSH tools. Read it before you start an
EGM skill.

The EGM bundle root is the installed package directory. It contains `skills/`,
`agents/`, `resources/`, and `docs/`. A skill body that mentions
`{{EGM_ROOT}}/…` was already rewritten with the absolute path when the skill
loaded; if you see the literal token, take the directory that holds `agents/`
and `resources/` as the root.

## Which path belongs to whom

Skill text uses relative paths, and they do not all resolve the same way:

| Path in a skill body | Resolve against |
| --- | --- |
| `agents/<persona>.md` | the EGM bundle root |
| `resources/document_standards/<standard>.md`, `resources/execution_instructions.md` | the EGM bundle root |
| `docs/dsh.md` | the EGM bundle root |
| `references/<file>.md` inside one skill | that skill's base directory (the `skill` tool reports it) |
| `docs/designs/…`, `concepts_brief.md`, `design_draft.md`, any review report, any target document | the session working directory |

Never write into the bundle root. Report paths you hand to a reviewer as
absolute paths.

## Skills and how you start them

| Skill | How to start it in DSH |
| --- | --- |
| `egm-brainstorm` | User message `/egm-brainstorm <idea>` |
| `egm-draft` | User message `/egm-draft` |
| `egm-review` | User message `/egm-review <design_document.md>` |
| `egm-resolve` | `/egm-resolve`, or load it with the `skill` tool in the same thread |
| `egm-review-loop` | `/egm-review-loop`, or load it with the `skill` tool |
| `egm-bootstrap` | `/egm-bootstrap`, or load it with the `skill` tool |
| `egm-drift-report` | `/egm-drift-report`, or load it with the `skill` tool |

The three entry skills keep EGM's `disable-model-invocation: true`, so they are
absent from the model catalog on purpose: the user starts them. The four
supporting skills are model-invocable, so during a review you can load
`egm-review-loop` or `egm-resolve` with the `skill` tool instead of reading the
file by hand. When a skill is already injected as `<skill_content>`, follow that
block; do not load it a second time.

## Delegation: Goldfish reviewers on DSH

This composition exposes no named subagent types. A Goldfish review still needs
a fresh context, so use the `subagent` tool (`subagent_fork` is wrong here: it
inherits this conversation and is not a Goldfish). Spawn one subagent per
reviewer, give it only what the skill says to give it, and wait for its final
report. (A future revision could register each persona as an Agent Preset and
expose an `agent_preset` enum through a Host `tool-subagent` row; this bundle
uses the general-purpose fallback that EGM documents for harnesses without named
personas, which is the path verified here.)

Reviewer prompt template — fill the bracketed values, pass absolute paths.
Replace `<absolute EGM root>` with the installed package directory before
sending, and never send the literal `{{EGM_ROOT}}` token to a reviewer: the
provider substitutes it only inside skill bodies.

```text
You are a single-use EGM Goldfish reviewer. You have no earlier conversation
context and you must not ask for it.

1. Read the EGM bundle guide at <absolute EGM root>/docs/dsh.md (persona rules,
   scope).
2. Read your persona and follow it exactly: <absolute EGM root>/agents/<persona>.md
3. Read the document standard the task names, when one is named:
   <absolute EGM root>/resources/document_standards/<standard>.md
4. Review target (absolute): <target path>
   Scope: <FeatureRange / DetailedRange / full file>
5. GoldfishContext (read only these files, in this order):
   <absolute paths, or "none">

Return the absolute paths you read, one per line, under `Paths read:`, before
your findings. If you could not read your persona or the named standard, say
so first and stop: an incomplete review is not a review.

Rules: read-only review. Write no files, run no shell commands that change
anything, and do not spawn subagents. Answer with findings in the persona's
format and nothing else.
```

The `Paths read:` block is the cheap check that a reviewer read its persona and
the right standard. A return without it, or with a missing persona path, is a
dispatch defect — retry that reviewer once instead of trusting its findings.

Things to keep true when you dispatch:

- The synthesizer persona nests subagents on harnesses that allow it. DSH
  subagents do not get a usable delegation path here, so use **direct
  dispatch**: spawn the individual reviewer personas the skill lists
  (`egm-zoom-out`, `egm-design`, `egm-structural`, `egm-style`,
  `egm-implementation-readiness`, `egm-codebase-details`,
  `egm-comprehension`, `egm-inventive-catalyst`) and write the stage report
  yourself. `egm-synthesizer` is only a prompt shape in this port.
- A reviewer that cannot read its persona or its standard has not reviewed;
  report that limitation instead of continuing.
- Reviewer isolation is context isolation, not filesystem isolation. DSH starts
  a subagent without this conversation's turns, but the subagent still sees the
  session's instruction files and can read files it is given. Do not paste
  earlier reviewer findings, memory, or your own reasoning into a reviewer
  prompt. State review assumptions as explicit criteria instead.
- Parallelize reviewers within one stage only. Stages stay sequential, and each
  stage report is written before the next stage starts, including in
  uninterrupted mode.

### Delegation depth is 1

DSH caps delegation depth at 1 by default: the Host setting
`subagent.maxDepth` starts at `1`, so a spawned child cannot delegate further.
The tool stays visible at the cap and a call there returns an error telling the
child to do the work directly. Consequences for EGM:

- Dispatch every reviewer from the main context, one level down. The skills'
  own wording — "or parallel Goldfish subagents if your harness cannot nest
  subagents", "use direct dispatch instead of the synthesizer" — is the path to
  take; do not spawn `egm-synthesizer` in order to reach reviewers.
- The main context performs the synthesizer's job: collect every reviewer
  report, deduplicate, and write the stage artifact.
- `egm-bootstrap` workers are the one place that needs a look: a worker cannot
  spawn the `goldfish-explorer` scout, and DSH has no runtime scout
  registration. Have the worker perform the scout reads inline and state that
  rule in the worker prompt, next to the persona path and the subtree root.
- If a user raises `subagent.maxDepth` in settings, nested dispatch becomes
  legal, but the port's verification and this guide assume the default. Keep the
  direct-dispatch path regardless: it is the one that is proven here.

## Asking the user

EGM's gates ask exactly one question and no more. On DSH use the
`ask_user_question` tool with a single item in `questions`, `multi_select:
false`, and option labels that describe the action without a "(Recommended)"
prefix. It must be the only tool call in that step, then end the turn. When the
answer is an open-ended value such as an arbitrary file path, ask in chat text
instead — do not turn it into a multiple-choice gate.

An EGM payload written for another harness uses `is_multi_select` and plain
option strings. Map it, do not translate it literally. When a skill body shows

```json
{ "questions": [ { "question": "…", "options": ["…"], "is_multi_select": false } ] }
```

call `ask_user_question` with

```json
{ "questions": [ { "id": "<stable id>", "question": "…",
  "options": [ { "label": "…" } ], "multi_select": false } ] }
```

The field names are `multi_select` and option objects with `label`; `id` is
required. An answer with empty `selected` and no `custom` is a skip, not an
approval.

## Artifacts

Write briefs, drafts, and reports in the session working directory, unless the
user's prompt or an instructions file names an EGM artifact directory. A
relative path resolves against the working directory. DSH has no separate
artifact directory, so the working directory is the default. Never write into
the installed bundle: `skills/`, `agents/`, `resources/`, and `docs/` are
read-only inputs.

If an `EGM artifact directory:` line from an instructions file resolves outside
the working directory after following symbolic links, ask the user before
creating that folder or writing there; if no one can confirm, write to the
working directory and say why. A path the user gives in the prompt needs no
confirmation.

## Known limits of this port

- Reviewer tool restriction is an instruction, not a host-enforced allowlist.
  DSH subagents inherit the session's tools; the prompt above tells them to stay
  read-only.
- DSH does not strip the session's instruction files from a fresh subagent.
  Parent conversation turns are absent; project instruction files may still be
  present. Treat that as a documented isolation gap, not as a guarantee.
- The `skill` tool renders the shipped `agents/` and `resources/` paths as
  resource guidance only; it does not load them for you. Read them yourself
  with the file tools when a skill tells you to.
- Upstream EGM ships harness guides for Claude Code, Codex, Cursor, Copilot,
  Antigravity, and OpenCode. Those files are not part of this bundle: the
  behavior they describe is replaced by this page.
- DSH has no artifact-comment mechanism, so draft revisions arrive as chat text
  or as direct edits to the draft file. The draft skill's fallback for that case
  already applies.
