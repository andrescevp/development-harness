---
title: Code Review — Web Research Agent and Skill (plan-wide)
slug: dh-research-agent-skill-code-review
description: Plan-wide code review of 89f28b9..HEAD (dh-researcher + dh-research) against R1–R9 and AC1–AC8.
tags: [review, code-review, plan]
project: dev-harness-skills
stack: Markdown harness assets + TypeScript tooling
created: 2026-11-16
updated: 2026-11-16
status: active
---

# Code Review Summary

**Scope**: `89f28b9..HEAD` — `dh-researcher` agent, `dh-research` skill, `docs/research/` registry, optional `## Research` plan section, execution unblock, inventory/docs sweep (50 files).
**Packages**: None — standalone repository
**Overall risk**: Medium
**Verdict**: **Approve with comments**

No P0/P1 findings. All findings are P2/P3 recommendations; nothing blocks the
plan-end gates.

## Verification performed

- `npx vitest run` → 66 files / 1,113 tests pass.
- `node scripts/audit.mjs` → exit 0, PASS, loop membership 27/27 skills, 6/6 agents.
- `node scripts/check-links.mjs` → 404 references, no dead links.
- `npx biome check` on the changed TypeScript → clean.
- `dh_plan_fast_read` → `stale: false`, `sourceSha256` matches `plan.md`.
- Secret scan of the diff: no credentials, tokens, personal data, or absolute home paths.
- Inventory surfaces (`EXPECTED_*`, install harness, `pack-install`, `smoke-pack`,
  `install-smoke-checks`, `shared.mjs` LOOP lists, TUI fixture) are consistent at
  6 / 27 / 33; `shared.mjs` lists stay alphabetical and the audit passes.
- Parser/format compatibility: `## Research` sits outside `## Phases`; the
  canonical fixture and legacy plans parse unchanged (`plan-lifecycle`,
  `workspace-plan-contract`, `mermaid-skill` suites green).

## Findings

### [P0] Blocking

_None._

### [P1] High

_None._

### [P2] Medium

- **`dh_plan_create` scaffolds a fabricated "verified" research citation and a dead link**
  - **Package**: `[workspace]`
  - **Location**: `src/tools/plan-template.ts:110-115` (bullet at `:115`), reached from `src/tools/plan-lifecycle.ts:278-280`
  - **Why it matters**: Every newly scaffolded plan inherits
    `- Node 20 EOL → ../../research/node-eol.md — verified 2026-11-15; drives R4.`
    The note does not exist (the registry ships empty), so the generated plan
    carries a dead `../../research/node-eol.md` link plus a fabricated
    verification date and a requirement ID from a different plan. This is the
    fabrication path R1 and the new skill's citation rules exist to prevent, and
    it conflicts with the fixture's own placeholder form.
  - **Evidence**: `src/__tests__/fixtures/plans/phased-plan.md:50` renders the same
    section as `None — no research consulted; link ../../research/<topic>.md
    notes when used.`; `docs/research/index.md` has no rows. A new plan therefore
    claims evidence that was never gathered, and any workspace link check reports
    a dead reference.
  - **Fix**: replace the concrete bullet with a placeholder (`<topic> → ../../research/<topic>.md` — `<confidence> <date>; drives <requirement>`) or emit `None — no research consulted.`, matching the fixture. Keep the concrete `node-eol` example only in `skills/dh-planning/references/phased-plan-template.md`, where it is illustrative and fenced.

- **The research skill's Final Check contradicts its own `model knowledge` rule**
  - **Package**: `[workspace]`
  - **Location**: `skills/dh-research/SKILL.md:181` vs `:45-47`, `:49-51`
  - **Why it matters**: The rules allow a finding without a source when it is
    labelled `model knowledge` (`:45-47`, `:49-51`), but the Final Check requires
    "Every finding has a source URL, a retrieval date, and a confidence label."
    A note that legitimately uses the sanctioned fallback cannot satisfy the
    checklist, which pressures the agent to invent a URL — precisely what `:47`
    forbids.
  - **Evidence**: `:45` "Every finding carries four things: the claim, the source
    URL, the retrieval date, and a confidence label"; `:46` "mark it `model
    knowledge` or drop it"; `:181` requires a source URL unconditionally.
  - **Fix**: "Every finding carries a confidence label; every `verified` / `partially verified` finding has a source URL + retrieval date; `model knowledge` findings are explicitly labelled and carry no invented source."

- **Execution skills tell the executor to persist the research note, bypassing the documentation owner**
  - **Package**: `[workspace]`
  - **Location**: `skills/dh-execute-plan-task/SKILL.md:84`; `skills/dh-execute-plan-task-fast/SKILL.md:131`
  - **Why it matters**: The added line says "run `dh-research` for ONE cited pass
    and register the note under `docs/research/`". The executor is an
    implementation agent with `write`, so this authorizes a second writer and
    drops the handoff that review comment 1 and R5 resolve: `dh-research` only
    composes, and `dh-documentor` via `dh-create-documentation` persists the note,
    registry row, and plan links. It also contradicts `AGENTS.md` ("owned by the
    documentation agent") and the skill's own step 6.
  - **Evidence**: `skills/dh-research/SKILL.md:101-110` ("Hand off … give both to
    the documentation owner … which writes the note, updates the registry");
    `AGENTS.md` workspace contract ("research notes and their registry … owned by
    the documentation agent"); the new line has no handoff.
  - **Fix**: "… run `dh-research` for ONE cited pass and hand the note to the documentation owner (`dh-create-documentation`) for registration under `docs/research/`; if the evidence is inconclusive, stop and report the blocker for guidance." Keep the caller-persists behaviour only as the documented fallback.

- **The demo registers five agents and can never surface `dh-researcher`**
  - **Package**: `[workspace]`
  - **Location**: `demo-project/opencode.jsonc:39-70` (map ends at `dh-documentor`, `:64-69`); `demo-project/demo.sh:43`
  - **Why it matters**: The demo's native `agent` map is the documented fallback
    for opencode v2.0.18, which does not load directory plugins. It still lists
    five agents, so the new agent is unavailable in the demo while
    `demo-project/docs/index.md:15,29,56,74` now claims 6 agents / 27 skills.
    `demo.sh` validates against a five-name array and reports `5/5`, so the gap
    can never be detected by the demo check.
  - **Evidence**: `demo-project/opencode.jsonc` has no `dh-researcher` entry
    although `agents/dh-researcher.md` exists and prompts resolve by relative
    path; `demo-project/demo.sh:43`
    `AGENTS=(dh-software-architect dh-software-engineer dh-reviewer dh-final-reviewer dh-documentor)`.
  - **Fix**: add a `dh-researcher` entry (`mode: subagent`, model, `prompt:
    "{file:../agents/dh-researcher.md}"`) and append it to the `AGENTS` array so
    the demo reports `6/6`.

- **Close-out notes claim the researcher cannot write; that enforcement does not exist**
  - **Package**: `[workspace]`
  - **Location**: `docs/evolution/2026-11-16-dh-research-agent-skill.md:131-132`; `docs/evolution/observations/2026-11-16-0110-dh-research-agent-skill.md:60-62` and `:103-104`
  - **Why it matters**: Both notes state "The agent has no write tool" and "the
    agent cannot write, which is structural". `agents/dh-researcher.md` declares
    no `tools`/`permission` keys (the repo convention for all six agents), so the
    runtime default toolset — including write/edit/bash — applies. Only the
    *skill* declares `allowed-tools: read, webfetch, websearch`; the agent's "No
    writes" boundary is instructional. The contract test asserts the `tools` key
    is absent, not that writes are disabled.
  - **Evidence**: `agents/dh-researcher.md:1-9` (no `tools`/`permission`);
    `src/lib/records.ts:118-119` (`tools`/`permission` only when declared);
    `src/__tests__/research-contract.test.ts:61-62` asserts
    `doc.data.tools === undefined`; every bundled agent lacks the key.
  - **Fix**: reword to "the skill declares no write tool, and the agent's rules forbid writes; because bundled agents carry no `tools` key, this boundary is instructional for the agent and declared for the skill." (optionally note the future option of a `tools: { write: false }` hardening in a separate change).

### [P3] Low

- **`plan_fast.md`'s own allowance contract omits `## Research`**
  - **Package**: `[workspace]`
  - **Location**: `docs/plans/dh-research-agent-skill/plan_fast.md:37` vs `src/tools/plan-fast-template.ts:24,124`
  - **Why it matters**: The mirror was generated before `Research` joined
    `FAST_OMITTED_SECTIONS`. Its "Omits from `plan.md`" line lists eleven
    sections but not `## Research`, while the renderer would now emit it between
    `## Visual Context` and `## Agent Selection`. The mirror is therefore not
    reproducible from the current generator, its allowed-differences contract
    disagrees with the fast skill/reference/`dh-review`, and
    `dh_plan_fast_sync` cannot detect it (structure-only, `stale: false`).
  - **Evidence**: `plan_fast.md:37` vs `src/tools/plan-fast-template.ts:24`;
    re-rendering this plan would add `` `## Research` `` to line 37.
  - **Fix**: re-render the mirror with `dh_plan_fast_create`/`dh_plan_fast_sync --apply`, or add `` `## Research` `` to the line and bump `updated`.

- **The contract suite pins the constant's source text instead of the rendered mirror**
  - **Package**: `[workspace]`
  - **Location**: `src/__tests__/research-contract.test.ts:148-157` (also `:126-132`)
  - **Why it matters**: The only assertion that the generator omits `Research`
    regexes the `FAST_OMITTED_SECTIONS` literal. It cannot catch a mirror that
    was never re-rendered (the finding above), a renderer regression, or the
    scaffold's fabricated link. The `SCAFFOLD_SOURCE` file case (`:128`) is
    redundant with the rendered `SCAFFOLD_TEXT` case and breaks if the literal is
    ever assembled from a helper. The suite also never asserts the
    `workspace-docs.md` research rows the ownership handoff depends on.
  - **Evidence**: `src/__tests__/mermaid-skill.test.ts:186-205` already renders
    `renderFastPlan` and asserts `` `## Visual Context` `` / `` `## Agent
    Selection` `` in the output — the pattern this suite should reuse; the
    `plan_fast.md` drift above demonstrates the gap.
  - **Fix**: add a `renderFastPlan` case asserting the rendered omission list
    contains `` `## Research` ``; drop the `SCAFFOLD_SOURCE` text case; add one
    assertion for the research note/index rows in
    `skills/dh-create-documentation/references/workspace-docs.md`.

## Suggested Next Steps

- [x] Fix the P2 findings (scaffold placeholder, Final Check wording, execution
      handoff wording, demo agent registration, close-out write claim).
- [x] Address the P3 contract-test gap so the fast-mirror omission and the
      documentation-owner rows are regression-protected.
- [x] Re-run `npx vitest run`, `node scripts/audit.mjs`, and
      `node scripts/check-links.mjs` after the edits.
- [x] Re-render or reconcile `plan_fast.md` before the plan-end alignment review.

## Remediation Applied

- `src/tools/plan-template.ts` now emits the fixture placeholder
  (`None — no research consulted`) instead of the fabricated `node-eol` link.
- `agents/dh-researcher.md` defers to the skill for the workflow/template and
  composes the payload from the skill’s Note Template verbatim; the description
  no longer advertises review callers.
- `skills/dh-research/SKILL.md` Final Check now distinguishes researched
  findings (URL required) from labelled `model knowledge` (no invented URL).
- Both execution task skills say the documentation owner registers the note;
  the executor does not persist it.
- `skills/dh-planning/references/agent-selection.md` has a Research role;
  `dh-planning` selects agents before delegating research.
- `demo-project/opencode.jsonc` and `demo-project/demo.sh` register
  `dh-researcher`.
- Evolution/observation notes describe the ownership boundary as instructional
  + skill tool-list enforcement, not a runtime structural guarantee.
- `research-contract.test.ts` asserts the exact read-only tool set, renders
  `renderFastPlan` for the `## Research` omission, covers the canonical fixture
  in the order/placement checks, and asserts the Research role + docs rows.
- `plan_fast.md` lists `## Research` in its Alignment Contract; the Execution
  Record realignment bumped `plan_version` to `fast-2`.

Remaining P3-only, intentionally deferred: shared count constants across package
layers, count prose in comments, and broader fence-aware heading helpers. All
remediation was re-verified by the full gate (`1116` tests, audit PASS, links
404, smokes PASS).
