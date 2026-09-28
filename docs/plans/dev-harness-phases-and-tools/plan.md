---
title: Dev Harness Phases and Tools
slug: dev-harness-phases-and-tools
description: >-
  Extend the completed dev-harness-skills OpenCode V2 plugin with three
  user-mandated modifications: (M1) phased plans — a new ordered phase +
  sub-task planning model across the planning, execute-plan,
  execute-plan-task, review and final-review skills; (M2) OpenCode V2 custom
  tools under the `harness` namespace (plan_read, plan_update_status,
  plan_create) registered by the plugin for plan-lifecycle automation;
  (M3) removal of the `permission` key from all 6 bundled agent frontmatters
  via a persistent post-copy patch in the extraction pipeline.
created: 2026-09-28
updated: 2026-09-28
status: Completed
active: false
tags:
  - plan
  - plugin
  - opencode
  - v2
  - harness
  - phases
  - tools
project: dev-harness-skills
stack:
  - typescript
  - opencode-plugin
  - vitest
  - node
---

# Plan: Dev Harness Phases and Tools

## Objective

Extend the **completed** `dev-harness-skills` OpenCode V2 plugin (6 agents + 12 skills, scoped manifest extracted from read-only `~/.agents`, packaged via `@opencode/plugin` `Plugin.define`) with three user-mandated modifications:

- **M1 — Phased plans (new planning model):** plans gain ordered **phases**, each containing **sub-tasks**, with explicit status markers for BOTH phases and sub-tasks; `planning`, `execute-plan`, `execute-plan-task`, `review`, and `final-review` become phase-aware; loop text, skills index graph, README, and tests are updated.
- **M2 — OpenCode V2 custom tools for the plan lifecycle:** the plugin registers a minimal toolset under the `harness` namespace (`plan_read`, `plan_update_status`, `plan_create`; codemode: true) so agents parse/update/create phased plans through tools instead of manual plan.md edits; pure parsing/building helpers with vitest coverage; workspace-anchored, path-safe file access.
- **M3 — Remove `permission` from agents frontmatter:** all 6 bundled agent files lose the `permission:` key entirely (keeping `tools` and all other fields), enforced as a persistent post-copy patch step in the extraction pipeline so re-running `extract.mjs` keeps them stripped while `~/.agents` stays untouched.

The plugin remains scoped: exactly 6 agents + 12 skills, NO commands. The existing gate stays authoritative: `pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs`.

## Requirements Snapshot

- **R1 — Phased plan model:** plan.md supports a phased structure — `## Phases` containing ordered `### Phase N: <title>` sections; each phase contains `#### Sub-Task N.M: <title>` blocks carrying ALL existing sub-task fields (Objective, Related Requirements, Dependencies, In Scope, Out of Scope, Instructions, Acceptance Criteria, Cautionary Points, Implementation Suggestions, Testing Suggestions, Done When) plus explicit status markers for both phases and sub-tasks (`- **Status:** Pending|In Progress|Completed`). `planning` creates phased plans (sub-tasks initialized `Pending`, phase status `Pending`, requirements snapshot with stable IDs kept). `execute-plan` iterates phases in order → sub-tasks, with a phase lifecycle (phase In Progress when its first sub-task starts; phase Completed when all its sub-tasks are Completed) and phase-aware resume mode (resume the first In Progress phase → its first In Progress/Pending sub-task). `execute-plan-task` selects the active sub-task (In Progress phase first, then its In Progress/Pending sub-task), implements it, marks it Completed, and tells the orchestrator when a phase completes. `review`/`final-review` keep their semantics but on the phased plan (per sub-task reviews; final plan-level sign-off must note per-phase completion). Downstream references updated: `AGENTS.md` loop text, `skills/index.md` mermaid graph, README (brief), tests (plan parsing fixture).
- **R2 — Plan-lifecycle tools:** the plugin registers V2 custom tools under the `harness` namespace (effective id `harness_plan_read`, `harness_plan_update_status`, `harness_plan_create`; `codemode: true`): `plan_read` (`{ slug, path? }` → structured JSON: meta, phases[] with title+status, subTasks[] with phase+title+status+relatedRequirements; clear errors when path missing/unparseable), `plan_update_status` (`{ slug, target: "phase"|"subtask", index, status }` → line-aware status-marker edit preserving everything else; minimal documented transition rules), `plan_create` (`{ slug, title, objective, phases: [{ title, subTasks: [{ title }] }] }` → scaffolds a phased plan.md from a template + optional index.md row update flag). Pure helpers (`parsePlan`, `buildPlanTemplate`, `setStatus`) live in `src/tools/plan-lifecycle.ts`, exported for vitest. Path resolution anchored to the workspace (`ctx.location.directory` captured in setup, or explicit `path` input; NEVER `process.cwd()`); fs reads/writes confined to `docs/plans` (reject `..` escapes). No separate `plan_phases` tool — `plan_read` returns phase statuses (decision, see Core concepts).
- **R3 — Permission key removal:** all 6 bundled `agents/*.md` files have NO `permission:` key in frontmatter (all other fields, incl. `tools`, kept). The strip is a persistent **post-copy patch step in the extraction pipeline** (a `PATCHES` entry in `scripts/manifest.json` + a strip step in `scripts/extract.mjs`, analogous to the alias rename), because `~/.agents` is read-only and `extract.mjs` re-copies from source on every run. `extract.mjs --check` verifies the key is absent in the repo while source is untouched, and re-running extract keeps it stripped. Registration impact is nil: `buildAgentRecord`/`buildPermissions` already default to `tools`-only rules when `permission` is missing. The ST6 registration expectations still hold (6 agents / 12 skills / 0 commands) and audit stays exit 0. A unit test asserts parsed agent frontmatter has no `permission` key after the patch. `docs/EXTRACTION.md` documents the permission-strip patch; README manifest description updated.
- **R4 — Skills/agents wiring:** `execute-plan`, `execute-plan-task`, `review`, `final-review` are updated to the phased model AND use the harness tools (`plan_read` + `plan_update_status` instead of manual plan.md edits; resume phase-aware; phase completion gate; hard-blocker stop rule 2.4 preserved verbatim). `planning` references `plan_create`/`plan_read`. Agent files `software-architect` and `software-engineer` include the harness-namespace tools in their `tools` maps (and, per R3, have no `permission` key). `AGENTS.md`, `skills/index.md`, and README mention the new tools.
- **R5 — Validation & documentation:** the full gate passes at the end; `docs/EXTRACTION.md` and README document the permission-strip patch and the tools (usage + troubleshooting); a real-session note for the tools is best-effort/optional; a final verification record is written.

**Requirement → sub-task mapping:** ST1→R1 (format contract); ST2→R2; ST3→R3; ST4→R1+R2+R4; ST5→R3+R4; ST6→R5.

## Scope

- **In scope:** phased plan format + `planning` skill update (ST1); `src/tools/plan-lifecycle.ts` helpers + `src/plugin.ts` tool registration + vitest suite + documented transition rules (ST2); manifest `PATCHES` + `extract.mjs` permission strip + `--check` update + audit/regression checks + EXTRACTION.md note (ST3); loop-skill updates for the phased model + harness tools (ST4); agent file updates, `AGENTS.md`, `skills/index.md`, README (ST5); final gate re-run + verification record (ST6).
- **Out of scope:** any change to `~/.agents` (read-only source); new agents/skills/commands beyond the 6/12/0 manifest; a separate `plan_phases` tool (covered by `plan_read`); over-engineered status transition logic (P0/P1 blocker parsing); migrating existing flat plans to phased format automatically (only the format/contract changes); anything outside the three user-mandated modifications.

## Assumptions and Constraints

- Repo state: branch `feat/dev-harness-v2-plugin`, work is **uncommitted**; the plugin is functionally complete (51 vitest tests green, gate passing). This plan's changes are additive modifications on top of that state.
- Source of truth is `~/.agents` (**read-only**). All extraction pipeline steps (`extract.mjs` + `PATCHES`) operate on repo copies only and must remain rerunnable and idempotent.
- `scripts/manifest.json` remains the single source of truth: include lists, expectations, loop membership, junk/secret rules — the new `PATCHES` entry lives there too.
- Line limits stay enforced: SKILL.md ≤ 250 lines, agents ≤ 300 lines. `planning` SKILL.md will grow — keep it ≤ 250 by moving template/detail content into `skills/planning/references/`.
- This plan file itself uses the **current flat `## Sub-Tasks` format** — the phased format is introduced by ST1 and applied to future plans, not retroactively to this one.
- Tool registration contract follows `create-update-opencode-plugin` skill: `ctx.tool.transform((editor) => { editor.namespace(...); editor.add({ ..., options: { namespace, codemode }, execute }) })`; effective id `namespace_name`; `execute(input, context)` gets `context.signal` + `context.progress`. Verify the exact editor shape against the installed `@opencode/plugin` typings during ST2.
- Path anchoring: capture the workspace root in `setup` via `ctx.location.directory` if present in the typings; if the field does not exist, require an explicit `path` input and document the limitation. Never use `process.cwd()`.
- `buildAgentRecord`/`buildPermissions` already tolerate a missing `permission` frontmatter key (rules derive from `tools` only) — R3 requires no record-builder changes.

## Risks and Areas Requiring Care

- **Format/parser drift between M1 and M2:** ST1 defines the phased format contract (exact marker syntax: `## Phases`, `### Phase N: <title>` + `- **Status:**`, `#### Sub-Task N.M: <title>` + full fields + status); ST2's `parsePlan` must consume exactly that contract. Mitigation: ST1 ships a canonical sample fixture (`src/__tests__/fixtures/plans/phased-plan.md`) and the template lives in `skills/planning/references/`; ST2's tests use BOTH the fixture and the template output as parse inputs. If the format changes, the fixture changes in the same commit.
- **Permission strip vs extract re-run:** the strip must be deterministic and idempotent; `extract.mjs --check` must assert absence after every run; a naive regex (e.g., matching `permission:` alone) can leave dangling rest-of-line content or eat following keys — the strip step must remove the whole multi-line key block (e.g., lines up to the next top-level key at the same indent). Source files in `~/.agents` must byte-match after extraction except for the sanctioned patches (rename, strip, tools upsert).
- **Tool path safety:** `..` escapes, absolute paths outside `docs/plans`, symlink traversal, and CWD dependence are all attack/misuse surfaces. Confine all fs access to `<workspaceRoot>/docs/plans`, reject escapes, and unit-test the rejection.
- **Existing 51 tests must stay green or be updated with rationale:** e.g., records tests may currently assert the `permission` field on AgentRecord — after R3 the record keeps `permission: undefined` (field remains in the type for provenance, just absent from frontmatter), so builder tests should still pass; if any fixture has `permission` in agent frontmatter, update the fixture with a comment noting the mandate.
- **Audit cross-reference allowlists:** new words in skill/agent text (`phased`, `phase-aware`, tool names like `plan_read`, namespace `harness`, status markers) may trip the kebab-prose or mention checks. Audit is warn-only for cross-refs, but keep the allowlists updated with rationale rather than forcing `--check` noise.
- **`planning` SKILL.md line limit:** adding the phased template inline risks > 250 lines. Move reusable template/format detail to `references/` and keep the skill body lean.
- **`ctx.tool` typing availability:** if the installed `@opencode/plugin` version's `Context` lacks `tool`/`location`, ST2 must pin/upgrade the package in lockstep with the host opencode (document the version pairing) rather than dropping the feature.
- **Skill line counts after ST4 patches:** `execute-plan`/`execute-plan-task`/`review`/`final-review` gain phase language + tool references; keep each ≤ 250 lines (trim prose, keep the loop text authoritative in AGENTS.md).

## Core concepts

### Phased plan format (M1 contract)

Future plan.md files use this shape (exact markers are the contract that `plan_read`/`plan_update_status` parse):

```markdown
## Phases

### Phase 1: Foundation
- **Status:** Pending

#### Sub-Task 1.1: Scaffold the module
- **Status:** Pending
- **Objective:** ...
- **Related Requirements:** R1
- **Dependencies and Preconditions:** ...
- **In Scope for This Sub-Task:** ...
- **Out of Scope for This Sub-Task:** ...
- **Instructions:** ...
- **Acceptance Criteria:** ...
- **Cautionary Points (Risks & Edge Cases):** ...
- **Implementation Suggestions:** ...
- **Testing Suggestions:** ...
- **Done When:** ...

(… more sub-tasks …)

### Phase 2: Integration
- **Status:** Pending
(…)
```

Lifecycle rules: sub-tasks start `Pending`; a phase becomes `In Progress` when its first sub-task starts and `Completed` only when all its sub-tasks are `Completed`; resume picks the first `In Progress` phase, then its first `In Progress`/`Pending` sub-task.

### V2 custom tool registration (M2)

Tools register in `setup` AFTER the skill transforms, via `ctx.tool.transform`:

```ts
ctx.tool.transform((editor) => {
  editor.namespace({ name: "harness", description: "Plan lifecycle tools" })
  editor.add({
    name: "plan_read",
    description: "Parse docs/plans/<slug>/plan.md into structured JSON (meta, phases, sub-tasks)",
    input: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Plan slug directory under docs/plans" },
        path: { type: "string", description: "Optional explicit path inside docs/plans (else slug is used)" },
      },
      required: ["slug"],
    },
    options: { namespace: "harness", codemode: true },
    execute: async (input, context) => {
      // context.signal for cancellation, context.progress for long ops
      // resolve <workspace>/docs/plans/<slug>/plan.md; reject ".." escapes
      const plan = parsePlan(contents) // pure helper from src/tools/plan-lifecycle.ts
      return plan
    },
  })
  // + plan_update_status, plan_create with the same shape
})
```

Pure, exported, vitest-covered helpers in `src/tools/plan-lifecycle.ts`:

- `parsePlan(contents: string): PlanDocument` → `{ meta, phases: [{ number, title, status }], subTasks: [{ id, phase, title, status, relatedRequirements }] }`; throws descriptive errors ("plan not found", "unparseable: expected ## Phases / ### Phase N / #### Sub-Task N.M").
- `setStatus(contents, target: "phase" | "subtask", index: number, status): { contents, plan }` → line-aware edit of the `- **Status:**` marker inside the matching section; preserves everything else; idempotent.
- `buildPlanTemplate(input): string` → full phased plan.md (frontmatter, Objective, Requirements Snapshot placeholder, Scope, Assumptions, Risks, Phases with Pending sub-task field skeletons, Final Integration & Verification).

**Minimal transition rules for `plan_update_status` (documented, not over-engineered):** status must be one of `Pending|In Progress|Completed`; phase → `Completed` requires every sub-task in that phase `Completed`; phase → `In Progress` just requires the phase to exist; sub-task status changes are otherwise free (gating on P0/P1 blockers remains the orchestrator's judgment — the tool does NOT parse blocker fields). Setting the current status again is a successful no-op.

**Decision (flagged): no separate `plan_phases` tool** — `plan_read` already returns `phases[]` with statuses, covering the "list statuses" use case with one tool fewer.

### Path anchoring and safety

Workspace root is captured in `setup` (`ctx.location?.directory` when available in the typings) and passed to the tool executors; explicit `path` inputs are resolved relative to `<workspaceRoot>/docs/plans` and must stay inside it — `..` segments and absolute paths outside are rejected with a clear error. No `process.cwd()` anywhere.

### Permission-strip patch (M3)

`scripts/manifest.json` gains a `patches` section; `extract.mjs` applies patches after copying (same pipeline position as the alias rename):

```jsonc
"patches": {
  "agents": [
    { "kind": "strip-key", "key": "permission", "file": "*" },
    { "kind": "ensure-tools-entry", "file": "software-architect.md",
      "entries": { "plan_read": true, "plan_update_status": true, "plan_create": true } },
    { "kind": "ensure-tools-entry", "file": "software-engineer.md",
      "entries": { "plan_read": true, "plan_update_status": true, "plan_create": true } }
  ]
}
```

`strip-key` removes the whole `permission:` multi-line block from agent frontmatter (all 6 files); `--check` asserts the key is absent in repo copies and present in source (source untouched). The `ensure-tools-entry` patch (ST5) keeps the architect/engineer `tools` maps stable across re-extracts.

## Sub-Tasks

### Sub-Task 1: M1 — Phased plan format + `planning` skill update

- **Status:** Completed
- **Objective:** Define and document the phased plan format (phases + sub-tasks + dual status markers) as the new planning contract, update `skills/planning/SKILL.md` to create phased plans, and ship the canonical format fixtures/template that ST2's parser will consume.
- **Related Requirements:** R1 (phased plan model; format contract for R2's parser).
- **Dependencies and Preconditions:** None new. Repo state: complete plugin, gate green. This sub-task DEFINES the format; it does not implement parsing (ST2) nor the loop-skill rewiring (ST4).
- **In Scope for This Sub-Task:**
  - `skills/planning/SKILL.md`: replace the flat `## Sub-Tasks` / `### Sub-Task N` output contract with the phased model — `## Phases` → `### Phase N: <title>` (with `- **Status:** Pending|In Progress|Completed`) → `#### Sub-Task N.M: <title>` blocks carrying ALL existing sub-task fields + status markers; `planning` must: group phases logically, initialize sub-tasks `Pending`, set phase status `Pending`, keep the requirements snapshot with stable IDs, and keep the phased template in the skill or (preferred) in a new `skills/planning/references/phased-plan-template.md` so the SKILL.md stays ≤ 250 lines.
  - Canonical fixture `src/__tests__/fixtures/plans/phased-plan.md` — a representative phased plan (≥ 2 phases, mixed statuses, full field skeletons) that ST2's `parsePlan` tests use as ground truth. If a `phases`/`sub-tasks` naming convention differs from this plan's spec, that fixture is authoritative — document the mapping in a comment.
  - `docs/EXTRACTION.md` note (1 short section): bundled `planning` is a patched copy whose format contract supersedes the source's flat format (source untouched).
- **Out of Scope for This Sub-Task:** the parser/tools (ST2); loop-skill rewiring (ST4); converting existing flat plans in `docs/plans/` (they stay flat); anything in `~/.agents`.
- **Instructions:**
  1. Read the current `skills/planning/SKILL.md`; keep its interview-mode and workflow sections, replace the Required Output Template + Sub-Tasks sections with the phased contract (exact markers per Core concepts).
  2. Create `skills/planning/references/phased-plan-template.md` with the full template including every sub-task field and both status markers; the skill body references it (`references/` files are copied by the extraction pipeline and are part of the skill).
  3. Create the fixture under `src/__tests__/fixtures/plans/` mirroring the template output (2 phases; phase 1 In Progress/phase 2 Pending; sub-task statuses Pending/In Progress/Completed mix; one sub-task with `Related Requirements` present).
  4. Run `node scripts/audit.mjs` and fix warn-only allowlist noise (add new kebab terms like `phased` / `phase-aware` to `crossReference.allowedKebabProse` with a comment) — do not touch secrets/junk rules.
- **Acceptance Criteria:**
  - The phased contract is unambiguous in `skills/planning/SKILL.md` (or its references file): exact section markers, both status markers, phase lifecycle wording, requirements-snapshot requirement preserved.
  - `skills/planning/SKILL.md` ≤ 250 lines; audit passes with zero FAIL findings.
  - `src/__tests__/fixtures/plans/phased-plan.md` exists and is internally consistent (sub-task numbering matches phase numbering, statuses valid).
  - No parser exists yet (that is ST2) — but the format is stable enough that ST2 tests can consume the fixture unchanged.
- **Cautionary Points (Risks & Edge Cases):** format ambiguity is the top risk (ST2 depends on exact markers) — write the marker rules as a short spec block inside the references template; keep the skill body lean (≤ 250 lines — move detail to references/); the audit's mention checks may flag new prose (allowlist with rationale, warn-only).
- **Implementation Suggestions:** model the phased `planning` content on this plan's own structure (phases per logical workstream, sub-tasks per deliverable, stable IDs); keep `- **Status:**` lines immediately after each `### Phase N` / `#### Sub-Task N.M` header — the ST2 parser keys on that adjacency.
- **Testing Suggestions:** `pnpm run audit` exit 0; `wc -l skills/planning/SKILL.md` ≤ 250; manually review the fixture against the template (both parse cleanly via the existing frontmatter parser).
- **Done When:** phased format spec + template exist, `planning` skill creates phased plans per the contract, fixture is in place, and audit passes.

### Sub-Task 2: M2 — Plan-lifecycle tools: helpers, registration, tests

- **Status:** Completed
- **Objective:** Implement `src/tools/plan-lifecycle.ts` (pure `parsePlan`, `buildPlanTemplate`, `setStatus`), register `plan_read`/`plan_update_status`/`plan_create` under the `harness` namespace (codemode: true) in `src/plugin.ts`, add vitest coverage, and document the minimal transition rules.
- **Related Requirements:** R2 (tools); consumes the R1 format contract from ST1.
- **Dependencies and Preconditions:** ST1 complete (format contract + fixture); `@opencode/plugin` typings verified for `ctx.tool` (namespace/add) and `ctx.location` (see cautionary points).
- **In Scope for This Sub-Task:**
  - `src/tools/plan-lifecycle.ts`: exported pure helpers — `parsePlan(contents)`, `setStatus(contents, target, index, status)`, `buildPlanTemplate(input)`; types for `PlanDocument` (meta, phases, subTasks), `PhaseStatus = "Pending" | "In Progress" | "Completed"`, tool input shapes. Also a small fs-guard helper (e.g., `resolvePlanPath(workspaceRoot, slug, explicitPath?)`) that rejects `..` escapes and absolute paths outside `<workspaceRoot>/docs/plans`.
  - `src/plugin.ts`: in `setup`, after skill transforms, capture the workspace root (`ctx.location?.directory` if present in typings) and register the `harness` namespace + 3 tools via `ctx.tool.transform` per the contract in Core concepts. `execute(input, context)` uses `context.signal` (abort-aware reads) and returns structured JSON; errors are descriptive.
  - Vitest suite `src/__tests__/plan-lifecycle.test.ts` (or similar): parse the ST1 fixture + the template output; status edits (phase + sub-task, idempotent same-status no-op, preserves unrelated content — diff before/after); path-escape rejection (`../`, absolute outside docs/plans) and missing-file errors; `plan_update_status` transition rules (valid enum; phase→Completed blocked while a sub-task is not Completed; everything else allowed).
  - Transition rules documented in the tool description text and in a comment header (keep them minimal per R2 — no P0/P1 parsing).
- **Out of Scope for This Sub-Task:** wiring skills to the tools (ST4); agent tool lists (ST5); a `plan_phases` tool (decision: covered by `plan_read`); editing plan.md files at runtime beyond what the tools do.
- **Instructions:**
  1. TDD: write the vitest suite first against ST1's fixture, then implement helpers to green.
  2. Line-aware `setStatus`: locate the section by header (`### Phase N` / `#### Sub-Task N.M` — index is 1-based), replace ONLY the first `- **Status:**` line inside it; do not re-render the document; re-parse and return the updated `PlanDocument`.
  3. Registration: follow `create-update-opencode-plugin` contract exactly; effective ids `harness_plan_read`, `harness_plan_update_status`, `harness_plan_create`; codemode true on all three.
  4. Verify typings: if `ctx.tool`/`ctx.location` are absent from the installed `@opencode/plugin`, align versions with the host opencode (pin/upgrade in lockstep) and document; do not degrade to `process.cwd()`.
- **Acceptance Criteria:**
  - `pnpm typecheck` and the full vitest suite pass (existing 51 tests + new suite).
  - `parsePlan` round-trips the ST1 fixture and the planning template output; `setStatus` is minimally invasive and idempotent; escape/absolute-path inputs are rejected with clear errors.
  - The built plugin registers the 3 tools (registration/stub-context test extends the existing registration expectations: 6 agents / 12 skills / 0 commands / 3 tools in namespace `harness`).
  - `pnpm run audit` stays exit 0.
- **Cautionary Points (Risks & Edge Cases):** format drift vs ST1 fixture (fix drift in the fixture + template TOGETHER, never the parser alone); `--check`-style marker adjacency (status line directly under the header); editing plan.md must preserve CRLF/whitespace (compare with `git diff --stat` style checks in tests); `ctx.signal` aborted mid-read; version skew of `@opencode/plugin`.
- **Implementation Suggestions:** keep helpers framework-free (pure string/regex ops, return `{ contents, plan }` from `setStatus`); reuse the existing `frontmatter.ts` parser for the plan's own frontmatter in `parsePlan`; export everything for tests; add the stub-context registration assertions to `registration.test.ts` with the 3-tool expectation.
- **Testing Suggestions:** `pnpm test` (new suite green); `pnpm typecheck`; `pnpm run audit`; `pnpm build && node scripts/smoke-load.mjs`; manual smoke of `parsePlan` on the fixture via `node -e` or a scratch script.
- **Done When:** helpers + tools implemented and registered, suite green, escape/transition tests pass, transition rules documented, build + smoke-load succeed.

### Sub-Task 3: M3 — Remove `permission` from agent frontmatter

- **Status:** Completed
- **Objective:** Strip the `permission:` key from all 6 bundled agent files via a persistent post-copy patch in the extraction pipeline (manifest-driven, idempotent, source-untouched), update `extract.mjs --check` and audit/regression tests, and document the patch in EXTRACTION.md + README.
- **Related Requirements:** R3 (permission removal); supports R4 (tool additions follow the same patch mechanism in ST5).
- **Dependencies and Preconditions:** ST1/ST2 or parallel-safe — this touches `agents/`, `scripts/manifest.json`, `scripts/extract.mjs`, `scripts/audit.mjs`, tests, docs; no dependency on the parser/tools. Do it before ST5 (ST5's `ensure-tools-entry` patches build on the same `patches` machinery).
- **In Scope for This Sub-Task:**
  - `scripts/manifest.json`: new `patches` section with the `strip-key` entry for all 6 agents (shape per Core concepts) — do NOT add the `ensure-tools-entry` entries yet (ST5 owns those).
  - `scripts/extract.mjs`: apply patches post-copy (same pipeline position as the alias rename; e.g., a `applyPatches(fileContents, filePath, M.patches)` step): `strip-key` removes the whole multi-line `permission:` block from frontmatter (key through the last line before the next top-level key at the same indent) for all agents; deterministic and idempotent.
  - `extract.mjs --check`: assert (a) every bundled agent frontmatter has NO `permission` key; (b) the source files under `~/.agents` still DO (proves source untouched); (c) re-running extract re-strips (idempotency is covered by running extract twice and diffing repo copies).
  - `scripts/audit.mjs`: new FAIL-level check (manifest-driven) that no bundled agent frontmatter contains `permission:`.
  - Regression test: a unit test asserting parsed agent frontmatter has no `permission` key after the patch (e.g., extend `frontmatter.test.ts`/`manifest.test.ts` reading `agents/*.md` or the manifest fixture path that mirrors the pipeline output).
  - `docs/EXTRACTION.md`: document the permission-strip patch (why: user mandate; how: PATCHES + strip step; idempotent; source untouched). README manifest description updated to note agents ship without `permission` (tools-derived rules).
- **Out of Scope for This Sub-Task:** changing `buildAgentRecord`/`buildPermissions` (already handle missing permission); the `ensure-tools-entry` patch (ST5); editing `~/.agents`; altering agent bodies.
- **Instructions:**
  1. Confirm current state: read one agent file (e.g., `agents/executor.md`) to see the `permission:` multi-line map shape; ensure 4-space/2-space consistent indentation is handled by the strip parser.
  2. Add `patches` to `manifest.json`; implement `applyPatches` in `extract.mjs`; wire `--check` assertions.
  3. Run `node scripts/extract.mjs` (re-copy) then `node scripts/extract.mjs --check`; verify all 6 agents lack `permission` and source still has it (`grep -c '^permission:' ~/.agents/agents/*.md`).
  4. Add the audit check + unit test; update EXTRACTION.md + README.
- **Acceptance Criteria:**
  - All 6 `agents/*.md` have no `permission` key; all other frontmatter keys (`tools`, `name`, `description`, `mode`, `model`, …) intact; bodies byte-identical to source bodies.
  - `extract.mjs --check` passes and reports the strip; re-running extract keeps files stripped; source `~/.agents` untouched.
  - Audit exits 0 with the new FAIL-level permission check passing; the unit test asserting no `permission` key passes.
  - Registration test still asserts 6 agents / 12 skills / 0 commands (+ tools from ST2 when merged).
- **Cautionary Points (Risks & Edge Cases):** regex must eat the ENTIRE multi-line `permission` block (value may be a nested map — test with the executor's multi-line map); key order in frontmatter may differ per file; idempotency (strip of already-stripped file = no-op); don't accidentally strip `permission` mentions in agent bodies (only frontmatter, before `---`); existing record-builder tests that asserted the `permission` field on AgentRecord must be reviewed (field stays in the type, becomes `undefined` — update fixture/test with a rationale comment if needed).
- **Implementation Suggestions:** implement strip as a small state machine over frontmatter lines (top-level-key indent tracking) rather than a fragile regex; reuse the alien-rename helper pattern already in `extract.mjs`; make patch entries declarative so future patches (ST5) slot in without new code paths.
- **Testing Suggestions:** `node scripts/extract.mjs --check`; `pnpm run audit`; `pnpm test` (new regression test + full suite); `grep -rn '^permission:' agents/` empty; `grep -c '^permission:' ~/.agents/agents/*.md` unchanged vs before.
- **Done When:** strip is persistent + verified by `--check`/audit/tests, source untouched, docs updated.

### Sub-Task 4: Skills wiring — phased model + harness tools in the loop skills

- **Status:** Completed
- **Objective:** Update `execute-plan`, `execute-plan-task`, `review`, and `final-review` to the phased model and to drive plan status through the harness tools (`plan_read` + `plan_update_status`); update `planning` to reference `plan_create`/`plan_read`; keep the hard-blocker stop rule (2.4) verbatim.
- **Related Requirements:** R1 (phased execution semantics) + R2 (tool usage) + R4 (wiring).
- **Dependencies and Preconditions:** ST1 (format contract), ST2 (tools exist), ST3 (permission strip — agent tool availability unaffected, but keep order for clean docs).
- **In Scope for This Sub-Task:**
  - `skills/execute-plan/SKILL.md`: iteration becomes phase-aware — iterate phases in order → sub-tasks; phase lifecycle wording (phase In Progress when its first sub-task starts; phase Completed when all sub-tasks Completed); resume mode phase-aware (first In Progress phase → first In Progress/Pending sub-task); use `plan_read` + `plan_update_status` for reading and status updates (no manual plan.md edits); report to orchestrator when a phase completes; hard-blocker rule (loop 2.4) preserved verbatim.
  - `skills/execute-plan-task/SKILL.md`: active sub-task selection — the In Progress phase first, then its In Progress/Pending sub-task; after implementing and validating, mark sub-task `Completed` via `plan_update_status`; notify the orchestrator when the phase completes (all sub-tasks Completed); keep delegation behavior (coding, simplify, review, hard-blocker stop) unchanged.
  - `skills/review/SKILL.md` and `skills/final-review/SKILL.md`: unchanged review semantics but reworded for phased plans — per sub-task review (acceptance criteria of `Sub-Task N.M`), final plan-level sign-off must note **per-phase completion** (each `Phase N` status and evidence).
  - `skills/planning/SKILL.md`: add the tool references (`plan_create` for scaffolding, `plan_read` for reading existing plans) alongside the format contract from ST1.
  - `scripts/manifest.json`: update `crossReference.allowedKebabProse` (and any tool-name mention lists) for new terms (`phased`, `phase-aware`, `plan_read`, `plan_update_status`, `plan_create`, `harness`) with rationale comments, if the audit flags them.
- **Out of Scope for This Sub-Task:** agent files (ST5); README/AGENTS.md/index graph (ST5); parser changes (ST2 closed); migrating old plans.
- **Instructions:**
  1. Read each skill's current text; make surgical, additive edits (patch sections where possible) so diffs stay reviewable; keep each SKILL.md ≤ 250 lines.
  2. Standardize the phase-terminology and tool mentions across the four loop skills + planning (copy the exact wording from ST1's contract so no skill invents variants).
  3. Ensure the hard-blocker sentence ("stop and ask guidance… never silently continue…") is byte-identical to today's text.
  4. Run `node scripts/audit.mjs` after edits; add allowlist entries only with rationale.
- **Acceptance Criteria:**
  - All four loop skills + planning reflect the phased model and reference the harness tools with correct effective ids (`harness_plan_read`, `harness_plan_update_status`, `harness_plan_create`).
  - Phase lifecycle, resume mode, phase-completion notification, and the 2.4 hard-blocker rule are explicit in `execute-plan`/`execute-plan-task`.
  - `final-review` requires per-phase completion notes; `review` scopes to sub-tasks.
  - All SKILL.md ≤ 250 lines; audit exit 0; existing cross-reference checks (loop membership) still pass.
- **Cautionary Points (Risks & Edge Cases):** line limits after edits (trim, don't bloat); audit allowlist churn (new words) — batch updates in one commit with rationale; tool id typos (`harness_plan_update_status` is long — copy-paste exact ids); don't weaken the 2.4 hard-blocker semantics while rewording; keep `review`/`final-review` semantics unchanged (only the object of review is phased).
- **Implementation Suggestions:** extract the phase lifecycle wording once (e.g., a short "Phased plan model" block identical across the skills) instead of paraphrasing per skill; reference `plan_update_status` transition rules from the tool description rather than duplicating them.
- **Testing Suggestions:** `pnpm run audit`; `wc -l skills/{execute-plan,execute-plan-task,review,final-review,planning}/SKILL.md`; grep the skills for `harness_plan_read|harness_plan_update_status|harness_plan_create` and for the verbatim 2.4 sentence; re-run `pnpm test` (unaffected but cheap).
- **Done When:** loop skills are phase-aware + tool-driven, wording consistent, limits respected, audit green, 2.4 intact.

### Sub-Task 5: Agents + docs — agent files, AGENTS.md, skills index, README

- **Status:** Completed
- **Objective:** Update `software-architect` and `software-engineer` agent files to include the harness tools in their `tools` maps (via the patch pipeline, so re-extract keeps them), refresh `AGENTS.md` (loop + phase language + tools), `skills/index.md` (mermaid graph), and README (tools + phased plans + permission-strip note), and confirm all gates pass.
- **Related Requirements:** R3 (no permission key in agent files) + R4 (agents/docs wiring).
- **Dependencies and Preconditions:** ST3 (patch machinery + strip), ST4 (final tool ids + phase wording to reference).
- **In Scope for This Sub-Task:**
  - `scripts/manifest.json`: add the two `ensure-tools-entry` patch entries for `software-architect.md`/`software-engineer.md` (`plan_read`, `plan_update_status`, `plan_create` → true in the `tools` map). Verify `extract.mjs`'s patch step upserts entries into an existing multi-line `tools:` block without disturbing other entries.
  - Run `node scripts/extract.mjs` + `--check` so the repo copies carry the tools additions AND no `permission` key.
  - `AGENTS.md`: update the skills loop text for phases (iteration order, phase lifecycle, phase-aware resume), mention the harness tools (agents can call `harness_*` plan tools), keep provenance sections intact.
  - `skills/index.md`: update the mermaid graph + skill list narrative for phased planning and the harness tools (brief; graph stays readable).
  - `README.md`: brief sections — phased plans (what changed), the three plan-lifecycle tools (usage + effective ids), and the manifest description update noting agents ship without `permission` (tools-derived rules) per R3.
- **Out of Scope for This Sub-Task:** changing other agents' bodies/tools; re-architecture of the loop (ST4 owns wording); moving docs to `~/.agents`.
- **Instructions:**
  1. Add patch entries; run extract + `--check`; confirm `git diff` on `agents/software-architect.md` shows only the `tools` additions (no permission key, no body change).
  2. Update AGENTS.md / skills/index.md / README with exact tool ids and the phase lifecycle summary from ST4's wording (single source: ST1 contract).
  3. Re-run audit and fix allowlist noise (README names like `harness_*` are not scanned by the audit, but skill/agent text is).
- **Acceptance Criteria:**
  - `software-architect`/`software-engineer` frontmatter: contains the 3 harness tool entries, NO `permission` key, other fields intact; bodies unchanged.
  - Re-running `node scripts/extract.mjs` preserves both the tools entries and the strip (patch pipeline is deterministic).
  - AGENTS.md loop text is phase-aware and mentions the harness tools; skills/index.md graph updated; README covers phased plans + tools + permission-strip.
  - Gates: `pnpm typecheck && pnpm run audit && pnpm test` pass.
- **Cautionary Points (Risks & Edge Cases):** patch order matters (strip before/after tools upsert — both must be idempotent in any order; make `applyPatches` order-independent per file); the `ensure-tools-entry` regex must handle an existing multi-line `tools:` map (insert entries before the closing brace/indent of the last entry); agent ≤ 300 lines limit unaffected (frontmatter only); audit's allowed-at-mentions may flag README-only content — README is not audited, skills/agents are.
- **Implementation Suggestions:** reuse the ST3 patch machinery verbatim (declarative entries, no new code paths); verify with `node scripts/extract.mjs && node scripts/extract.mjs --check && git diff agents/`; generate the skills/index.md graph locally (mermaid preview) to avoid syntax errors.
- **Testing Suggestions:** `pnpm run audit` exit 0; `grep -E 'plan_(read|update_status|create)' agents/software-{architect,engineer}.md` hits 3×2; `grep -c '^permission:' agents/*.md` = 0; `pnpm test`; full gate at ST6.
- **Done When:** agent files patched via pipeline, docs consistent, audit + tests green.

### Sub-Task 6: Validation + documentation — full gate re-run and verification record

- **Status:** Completed
- **Objective:** Run the complete gate end-to-end, do a best-effort real-session check of the harness tools, add README/troubleshooting content for the tools, and write the final verification record for this plan.
- **Related Requirements:** R5 (validation & documentation).
- **Dependencies and Preconditions:** ST1–ST5 complete.
- **In Scope for This Sub-Task:**
  - Full gate re-run: `pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs` — all pass; record outputs.
  - Real-session note (optional, best-effort): with the plugin loaded in a scratch opencode session, invoke `plan_read`/`plan_update_status`/`plan_create` (e.g., via a `@code`/tool call) on a scratch plan directory; record results; if the local host can't exercise the tools, document the limitation in the verification record (SDK/stub registration test from ST2 stands in).
  - README: troubleshooting additions for the tools (tool not found → check plugin load + namespace; path errors → workspace anchor; status edit no-op → idempotency note) and for re-extract surprises (patches re-applied automatically).
  - Final verification record under `docs/plans/dev-harness-phases-and-tools/` (e.g., `tasks/verification.md`): gate results, tool smoke results, per-phase completion notes, deviations (if any) with rationale.
- **Out of Scope for This Sub-Task:** new features; fixing latent issues unrelated to M1–M3; upstreaming docs to `~/.agents`.
- **Instructions:**
  1. Run the gate; treat any red as a blocker (loop rule 2.4: stop and ask guidance on 3 consecutive strikes) — do not silently skip.
  2. Best-effort real-session smoke per the note above; keep it out of CI.
  3. Write the verification record; confirm this plan's index.md row can be flipped (status Completed / active No) once everything passes — flip it as part of closing per execute-plan conventions.
- **Acceptance Criteria:**
  - Full gate green, one final run, outputs recorded.
  - Tools smoke (or documented substitute) recorded; troubleshooting section covers the 3 named failure modes.
  - Verification record exists with gate results and any deviations.
- **Cautionary Points (Risks & Edge Cases):** flaky TUI-based checks (keep them manual/optional); audit allowlist churn from README edits (README not audited — verify only skills/agents); regression from doc-only changes is low but re-run the full gate anyway (cheap).
- **Implementation Suggestions:** capture gate output to the verification record verbatim; use the ST2 stub-context registration test as the fallback evidence if the real session can't run tools.
- **Testing Suggestions:** the gate command itself; `git status`/`git diff --stat` review to confirm only intended files changed; `grep -rn 'harness_plan_' README.md AGENTS.md skills/ agents/` for consistent ids.
- **Done When:** gate green with recorded evidence, tools smoke documented, troubleshooting updated, verification record written, plan closed per conventions.

## Final Integration & Verification

End-to-end validation that the plugin still loads and registers exactly the scoped manifest AND the new harness tools:

1. **Gate commands:** `pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs` — all pass (ST6 records outputs).
2. **Registration assertions:** the stub-context registration test asserts 6 agents, 12 skills, 0 commands, and 3 tools (`harness_plan_read`, `harness_plan_update_status`, `harness_plan_create`, codemode true).
3. **Extraction invariants (M3):** `node scripts/extract.mjs && node scripts/extract.mjs --check` → 6 agents / 12 skill dirs + index.md, alias bodies byte-identical, `permission` key absent in repo + present in `~/.agents`, `ensure-tools-entry` present in architect/engineer; re-run is idempotent.
4. **Phased-plan contract (M1/M2):** `parsePlan` parses the ST1 fixture and the `planning` template output; `setStatus` edits phase + sub-task statuses idempotently; escapes rejected.
5. **Real-session check (best-effort):** plugin loaded in a scratch opencode session; the harness tools are callable and `plan_create` → `plan_read` → `plan_update_status` round-trip on a scratch plan; results (or the documented substitute/limitation) in the verification record.
6. **Closeout:** on green, flip this plan's `docs/plans/index.md` row (`dev-harness-phases-and-tools`) to status **Completed** / active **No** and record the verdict, per execute-plan conventions.
## Execution amendment (2026-09-28, final review)

- **R4/ST5 deviation — planner-agent tool wiring:** the plan specified
  `ensure-tools-entry` patches adding `harness_plan_*` names to the
  architect/engineer `tools:` maps. Implementation used a **sanctioned body
  note** (`append-body-note` patch, marker `> Harness plan tools (bundled):`,
  stripped by the alias-integrity check) instead. Rationale: `tools:` is a
  boolean map of built-in tool categories, so injecting custom tool ids would
  emit meaningless permission rules via `buildPermissions`; the alias-body
  check covers frontmatter `name` changes but not arbitrary map inserts
  without new machinery. Whether codemode tools bypass agent permission gates
  remains an open question pending live-host confirmation (see verification).
- **Status flip:** Sub-Task 1 marked Completed at sign-off (was In Progress).
