---
title: Pause and Resume Plan Skills
slug: pause-resume-plan-skills
description: Add dh-pause-plan and dh-resume-plan with a durable handoff.md contract, drift-safe resume, an execute-plan guard, and 19-skill inventory updates.
created: 2026-11-07
updated: 2026-11-07
status: Pending
active: true
tags: [plan]
project: dev-harness-skills
---

# Plan: Pause and Resume Plan Skills

## Objective

Add two bundled skills — `dh-pause-plan` and `dh-resume-plan` — plus a
versioned sidecar `handoff.md` contract so a phased plan can stop safely and
resume with full session context. Pause snapshots the active phase/sub-task,
git/worktree state, decisions, blockers, validation state, and next steps
without changing plan statuses or code. Resume validates the handoff, detects
material drift, reconciles plan-vs-handoff, rehydrates context, marks the
handoff consumed, and delegates to `dh-execute-plan` resume mode. The
3-status plan parser and MCP tools remain unchanged.

## Requirements Snapshot

- **R1:** `dh-pause-plan` with pause/suspend/stop/handoff triggers and a safe pause workflow.
- **R2:** `dh-resume-plan` with resume/continue/pick-up triggers and a validated resume workflow.
- **R3:** Pause writes `docs/plans/<plan-slug>/handoff.md` beside `plan.md`, with a versioned frontmatter contract and required sections.
- **R4:** Pause is read-only for code and plan state: no status changes, commits, stash, reset, checkout, or branch changes; re-pause appends history.
- **R5:** Resume validates the contract and detects material drift (branch, HEAD ancestry, worktree, plan hash, conflicts) before continuing; never discards work.
- **R6:** Resume treats `plan.md` as task truth, rehydrates context, marks the handoff `resumed`, and delegates to `dh-execute-plan` resume mode.
- **R7:** `dh-execute-plan` redirects to `dh-resume-plan` when a paused handoff exists; `dh-execute-plan-task` recommends pausing on hard blockers.
- **R8:** No `Paused` status, plan frontmatter flag, parser change, or MCP tool change.
- **R9:** Skill inventories/assertions move from 17 to 19 across source, tests, smoke scripts, audit, and docs.
- **R10:** An automated contract test guards the handoff template, required fields/sections, and both skills' references.
- **R11:** A scripted rehearsal plus the full QA gate prove behavior and prevent regressions.
- **R12:** Harness docs present pause/resume as cross-cutting lifecycle skills; `docs/plans/index.md` tracks this plan.

## Scope

- In scope: the two skills, handoff template/contract, execute-plan/task integration, inventory and documentation updates, contract test, rehearsal evidence, release gates.
- Out of scope: plan-status model changes, new MCP tools, auto-commit/stash/reset, background persistence, multi-agent locking, commands/prompts, migrating existing plans.

## Assumptions and Constraints

- `handoff.md` is committed with the plan (`docs/plans` is tracked); no `.gitignore` change.
- Git is optional: non-git workspaces degrade to file/plan evidence and are marked unverifiable.
- `sha256sum` (or `shasum -a 256`) is available; otherwise `plan_sha256` is `null`.
- One handoff per plan; multiple paused plans are resolved by asking the user.
- Skill files stay under the 250-line audit limit; supporting material goes into `references/`.
- Handoffs must never contain secrets, tokens, env values, full diffs, or file contents.
- npm pack continues to exclude `docs/` (handoff and plan files are not shipped).

## Risks and Areas Requiring Care

- Secret leakage into handoff → redaction rules plus a secret-pattern scan before reporting.
- False-positive drift → record precise evidence, classify clean/explainable/material, ask before acting.
- Stale handoff vs edited plan → `plan_sha256` plus plan-vs-handoff reconciliation.
- Count drift → one inventory pass plus a repo-wide stale-count grep gate.
- Cross-skill reference breakage after bundling → verify packed assets; duplicate critical field expectations in resume if needed.
- Concurrent sessions → no lock; detect drift and warn rather than overwrite.
- Ambiguous active plan/sub-task → never guess; record the ambiguity or ask.

## Core concepts

**Sidecar handoff.** `plan.md` remains the only source of task status (Pending
/ In Progress / Completed). `handoff.md` records where execution stopped,
why, and how to continue; it never substitutes for plan state.

**Plan-as-truth reconciliation.** On resume, plan statuses win over handoff
claims. If work advanced after the pause, the handoff is stale but useful for
context; if plan statuses moved backwards, stop and ask.

**Drift classes.** Clean (branch/HEAD/worktree/plan hash match), explainable
(new commits or files that do not touch recorded work), material (branch
switch, non-ancestor HEAD, plan edited, merge conflicts, unexpected dirty
state). Material drift always stops for user confirmation.

**Consume lifecycle.** Pause writes/refreshes `status: paused`; resume stamps
`status: resumed`, `resumed_at`, and a history row only when execution is
about to start. The file is kept for audit; a new pause reopens it with a
fresh snapshot and preserves prior history.

## Phases

### Phase 1: Handoff contract and skill authoring

- **Status:** Completed

#### Sub-Task 1.1: Author the versioned handoff contract

- **Status:** Completed
- **Objective:** Define the canonical `handoff.md` structure shared by pause and resume.
- **Related Requirements:** R3, R4, R10
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:** `skills/dh-pause-plan/references/handoff-template.md` with frontmatter (`handoff_version`, `plan_slug`, `plan_path`, `status`, `created`, `updated`, `paused_at`, `resumed_at`, `branch`, `base_commit`, `worktree_dirty`, `plan_sha256`, `phase_index`, `subtask_index`, `progress`, `next_action`, `blocked`, `tags`, `project`) and sections (`Snapshot`, `Current Position`, `Work Completed`, `Work In Flight`, `Uncommitted Changes`, `Decisions and Rationale`, `Blockers and Risks`, `Validation State`, `Next Steps`, `Resume Checklist`, `Pause History`); redaction and versioning rules; worked example.
- **Out of Scope for This Sub-Task:** Skill workflow prose, code, tests, inventory.
- **Instructions:** Mirror the style of `skills/dh-planning/references/phased-plan-template.md`; use ISO-8601 timestamps; use `null` for unavailable git data; document `handoff_version: 1` and that only breaking changes bump it; define Pause History columns.
- **Acceptance Criteria:** Every listed field and section is present; the example frontmatter parses as YAML; no secret-like values; reference ≤200 lines.
- **Cautionary Points (Risks & Edge Cases):** Do not copy diffs, file contents, or environment values; handoff is not a second plan; keep unknown values explicit rather than inventing them.
- **Implementation Suggestions:** Use a fenced markdown example plus a compact field table; keep the template copy-pasteable.
- **Testing Suggestions:** Parse the example with Node/Python; `rg` secret patterns; `wc -l`.
- **Done When:** Template is complete, self-consistent, and reviewed against this brief.

#### Sub-Task 1.2: Author dh-pause-plan

- **Status:** Completed
- **Objective:** Author a deterministic, read-only pause workflow that produces the handoff.
- **Related Requirements:** R1, R3, R4
- **Dependencies and Preconditions:** Sub-Task 1.1 (template).
- **In Scope for This Sub-Task:** `skills/dh-pause-plan/SKILL.md` frontmatter (name, description with triggers, license, compatibility, allowed-tools read/write/edit/bash, metadata), core rules, workflow steps 0–5, error handling, loop integration, references.
- **Out of Scope for This Sub-Task:** `dh-execute-plan`/task edits; inventory and docs.
- **Instructions:** Resolve the plan (argument, else active `In Progress` plan; multiple → ask; all `Completed` → suggest final-review). Read via `dh_plan_read` (manual fallback). Use execute-plan position priority; multiple active phases/sub-tasks → record ambiguity, do not guess. Collect read-only git evidence, `plan_sha256`, and open review findings. Compose per template preserving history, validate (frontmatter, required sections, slug, secret scan), report path and exact resume instruction.
- **Acceptance Criteria:** Triggers cover pause/suspend/stop/end-session/handoff; workflow covers resolution→evidence→write→validate→report; read-only and idempotent rules explicit; git-optional and secret-scan rules present; ≤250 lines.
- **Cautionary Points (Risks & Edge Cases):** Never change statuses, commit, stash, reset, checkout, or switch branches; do not guess an active plan/sub-task; do not claim validation results that were not observed.
- **Implementation Suggestions:** Reuse the position rules and status markers from `dh-execute-plan`; keep commands read-only.
- **Testing Suggestions:** Dry-run against a scratch phased plan; verify `plan.md` hash is unchanged and no commit is created.
- **Done When:** Skill is complete, valid, and consistent with the template.

#### Sub-Task 1.3: Author dh-resume-plan

- **Status:** Completed
- **Objective:** Author a validated resume workflow that rehydrates context and re-enters execution safely.
- **Related Requirements:** R2, R5, R6
- **Dependencies and Preconditions:** Sub-Tasks 1.1 and 1.2.
- **In Scope for This Sub-Task:** `skills/dh-resume-plan/SKILL.md` frontmatter (name, description with triggers, license, compatibility, allowed-tools read/write/edit/bash, metadata), core rules, workflow steps 0–5, error handling, loop integration, reference to the template.
- **Out of Scope for This Sub-Task:** Duplicating the execution loop; destructive git; plan status edits.
- **Instructions:** Resolve explicit slug or unique paused handoff; multiple → ask. Validate version, slug, required sections, and `status: paused`; invalid → stop and offer status-based `dh-execute-plan` only with explicit confirmation. Check branch, HEAD ancestry, worktree, plan hash, and merge conflicts; classify clean/explainable/material and ask on material. Reconcile plan truth, summarize context, mark `resumed` + `resumed_at` + history row when starting, then delegate to `dh-execute-plan`. Already resumed → report consumed. Non-git → degrade with a warning.
- **Acceptance Criteria:** All validation and drift checks are present; no destructive commands; delegation is explicit; history is preserved; ≤250 lines.
- **Cautionary Points (Risks & Edge Cases):** Do not silently continue on material drift; do not overwrite history; do not reimplement execution; do not edit plan statuses during rehydration.
- **Implementation Suggestions:** Reference `../dh-pause-plan/references/handoff-template.md`; keep the rehydration summary short and actionable.
- **Testing Suggestions:** Rehearse clean, drift, already-resumed, and non-git scenarios.
- **Done When:** Skill is complete and consistent with the pause workflow.

### Phase 2: Harness workflow integration

- **Status:** Completed

#### Sub-Task 2.1: Guard dh-execute-plan and reference pause on blockers

- **Status:** Completed
- **Objective:** Prevent execution from bypassing handoff rehydration and make pause the recommended blocker exit.
- **Related Requirements:** R7, R8
- **Dependencies and Preconditions:** Sub-Tasks 1.2 and 1.3.
- **In Scope for This Sub-Task:** `skills/dh-execute-plan/SKILL.md` Step 1 paused-handoff check before status-based resume, Core Rules, and Resume Mode; `skills/dh-execute-plan-task/SKILL.md` hard-blocker path recommends `dh-pause-plan`.
- **Out of Scope for This Sub-Task:** Changing execution semantics, status model, or inventory.
- **Instructions:** Add a priority-0 check that detects `handoff.md` with `status: paused`, stops, and directs to `dh-resume-plan`; allow bypass only on explicit user confirmation. Note pause at loop step 2.4 and in the task failure path.
- **Acceptance Criteria:** Guard is present and unambiguous; no auto-bypass; no-handoff execution path is unchanged; no status model change.
- **Cautionary Points (Risks & Edge Cases):** Do not force a pause on every interruption; do not break existing resume mode when no handoff exists.
- **Implementation Suggestions:** Keep edits near Step 1, Resume Mode, and Error Handling; use consistent wording with the new skills.
- **Testing Suggestions:** Read-through plus grep for the guard; run existing plan tests.
- **Done When:** Both skills integrate pause/resume coherently.

#### Sub-Task 2.2: Update AGENTS.md and skills index

- **Status:** Completed
- **Objective:** Present pause/resume as cross-cutting lifecycle skills in the harness contract and skill map.
- **Related Requirements:** R9, R12
- **Dependencies and Preconditions:** Sub-Task 2.1.
- **In Scope for This Sub-Task:** `AGENTS.md` (19 skills, names, cross-cutting pause/resume section, layout count) and `skills/index.md` (19-skill heading/table rows, mermaid nodes and edges).
- **Out of Scope for This Sub-Task:** README, `docs/LOADING.md`, example config (Sub-Task 3.3); code and tests.
- **Instructions:** Add both skills with roles; add graph edges `execute-plan --interrupt--> pause-plan --handoff.md--> resume-plan --rehydrate--> execute-plan`; state that pause/resume are lifecycle, not loop steps; keep mermaid valid.
- **Acceptance Criteria:** Both docs list 19 skills and link both new skills; the graph describes the handoff; no implication that `Paused` is a status.
- **Cautionary Points (Risks & Edge Cases):** Do not renumber loop steps; do not overstate automation; keep the existing graph readable.
- **Implementation Suggestions:** Mirror existing table/graph styling; keep descriptions one line.
- **Testing Suggestions:** Grep the names and counts; render/validate mermaid syntax.
- **Done When:** Harness contract and skill map are consistent.

### Phase 3: Inventory and automated enforcement

- **Status:** Completed

#### Sub-Task 3.1: Update runtime and script inventory to 19 skills

- **Status:** Completed
- **Objective:** Make every runtime and smoke-script expectation accept the two new skills.
- **Related Requirements:** R9
- **Dependencies and Preconditions:** Sub-Tasks 1.2 and 1.3.
- **In Scope for This Sub-Task:** `src/cli/plugin-artifact.ts` (`EXPECTED_SKILL_COUNT = 19`); `scripts/lib/shared.mjs` (`LOOP.skills`); `scripts/lib/install-smoke-checks.mjs`; `scripts/lib/pack-install.mjs`; `scripts/smoke-pack.mjs` and its comments; `scripts/docker-test.sh`; `scripts/lib/pack-contract.mjs` comment.
- **Out of Scope for This Sub-Task:** Test files (Sub-Task 3.2), documentation (Sub-Task 3.3), `dist/`.
- **Instructions:** Update explicit counts and lists in one pass; prefer shared constants where they exist; update labels and comments so failure messages stay truthful.
- **Acceptance Criteria:** No stale 17-skill expectation remains in these files; scripts lint; installer staging accepts 19.
- **Cautionary Points (Risks & Edge Cases):** One missed explicit check breaks installer or smoke; do not edit generated `dist/` assets.
- **Implementation Suggestions:** Use `rg` to enumerate every literal before editing; group edits by file family.
- **Testing Suggestions:** `rg` for `17` in the touched files; run targeted script dry runs.
- **Done When:** Runtime/script inventory is consistently 19.

#### Sub-Task 3.2: Update tests and add the handoff contract test

- **Status:** Completed
- **Objective:** Move test inventories to 19 and enforce the handoff contract automatically.
- **Related Requirements:** R9, R10
- **Dependencies and Preconditions:** Sub-Tasks 1.1–1.3 and 3.1.
- **In Scope for This Sub-Task:** `src/__tests__/registration.test.ts`, `assets.test.ts`, `frontmatter.test.ts`, `src/cli/__tests__/plugin-artifact.test.ts` (17→19, 24→26, names/messages); new `src/__tests__/handoff-contract.test.ts`.
- **Out of Scope for This Sub-Task:** Parser/status changes; changing existing plan behavior.
- **Instructions:** Update counts/name sets; add a contract test that reads the real template and skills and asserts required frontmatter keys, required sections, `handoff_version: 1`, pause/resume references, and that `PHASE_STATUSES` still has exactly three values.
- **Acceptance Criteria:** `pnpm test` passes; deleting a required template field/section fails the contract test; existing plan tests keep their behavior.
- **Cautionary Points (Risks & Edge Cases):** Assert structural markers, not exact prose, so future edits stay possible; keep the test under the file-size rule.
- **Implementation Suggestions:** Reuse existing frontmatter/asset helpers; use table-driven assertions for fields and sections.
- **Testing Suggestions:** Run the new test first, then the full suite.
- **Done When:** All tests pass and the contract is guarded.

#### Sub-Task 3.3: Update documentation counts and tables

- **Status:** Completed
- **Objective:** Remove stale 17-skill claims from the active documentation surface.
- **Related Requirements:** R9, R12
- **Dependencies and Preconditions:** Sub-Tasks 2.2 and 3.1.
- **In Scope for This Sub-Task:** `README.md` (count mentions, skill table rows, tree comment), `docs/LOADING.md` (count mentions and verification wording), `opencode.example.jsonc` comment, and any remaining `AGENTS.md`/`skills/index.md` count references; verify the `docs/plans/index.md` row.
- **Out of Scope for This Sub-Task:** Historical `docs/plans/**` records and `reports/**`.
- **Instructions:** Update counts to 19; add both skill rows/links; keep descriptions accurate; run the stale-count grep with exclusions for historical plans/reports.
- **Acceptance Criteria:** No stale 17-skill claim remains on the active surface; links resolve; historical records are untouched.
- **Cautionary Points (Risks & Edge Cases):** Do not rewrite old plans or reports; do not change unrelated counts.
- **Implementation Suggestions:** Edit tables and short prose only; keep the README workflow section aligned with `AGENTS.md`.
- **Testing Suggestions:** `rg -n "17 skills|17 bundled|17 skill|7 agents and 17"` with exclusions; link check.
- **Done When:** Active documentation is consistent at 19 skills.

### Phase 4: Validation and release readiness

- **Status:** In Progress

#### Sub-Task 4.1: Rehearse pause, drift, and resume end-to-end

- **Status:** Completed
- **Objective:** Prove the skills behave safely in a disposable git workspace.
- **Related Requirements:** R4, R5, R6, R11
- **Dependencies and Preconditions:** Phases 1–3 complete.
- **In Scope for This Sub-Task:** Create `/tmp/dh-pause-rehearsal` with a phased plan and SDD; follow `dh-pause-plan`; assert handoff fields, unchanged `plan.md`, and no commits; simulate plan-hash and branch/HEAD drift; verify resume stops; run a clean resume and verify `status: resumed` plus delegation; test a non-git workspace; record evidence in `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md`.
- **Out of Scope for This Sub-Task:** Production commits, destructive git, publishing.
- **Instructions:** Follow the skill text literally, record commands and observed results, and note any ambiguity for immediate fixes.
- **Acceptance Criteria:** Evidence covers clean pause, re-pause, plan-hash drift, branch/HEAD drift, already-resumed, and non-git; every expected stop/continue outcome is observed.
- **Cautionary Points (Risks & Edge Cases):** Never run reset/stash/checkout; clean the temp workspace; redact secrets from the transcript.
- **Implementation Suggestions:** Use a small shell script or numbered command log; keep the transcript concise.
- **Testing Suggestions:** Assertions on frontmatter, hashes, `git log`, and file presence.
- **Done When:** Evidence is committed and all scenarios pass.

#### Sub-Task 4.2: Run the full QA gate and grep gates

- **Status:** Pending
- **Objective:** Prove the change passes the repository's release gate with no stale contracts.
- **Related Requirements:** R9, R10, R11
- **Dependencies and Preconditions:** Sub-Tasks 3.1–3.3 and 4.1.
- **In Scope for This Sub-Task:** `pnpm qa:check:full` (lint, dup, depcruise, build, smoke-install, smoke-pack, test, typecheck, audit, smoke-load, smoke-mcp) plus grep gates for stale counts, a fourth status, secret patterns, and dead skill references.
- **Out of Scope for This Sub-Task:** The opt-in Docker suite unless a failure requires it.
- **Instructions:** Delegate commands to `@dh-executor`; run targeted checks first; capture failures with full output; fix in-scope failures without weakening gates.
- **Acceptance Criteria:** All gate steps pass; stale active-surface count grep is zero; no secret hits; no dead references.
- **Cautionary Points (Risks & Edge Cases):** The full gate is long; environment prerequisites (Docker/network) may block some scans—report blockers instead of skipping silently.
- **Implementation Suggestions:** Use the repo's existing scripts as-is; summarize each step with pass/fail.
- **Testing Suggestions:** Command output and exit codes.
- **Done When:** Full gate is green or a documented blocker is escalated.

#### Sub-Task 4.3: Final review, documentation, and release readiness

- **Status:** Pending
- **Objective:** Close the plan with the harness's sign-off and documentation steps.
- **Related Requirements:** R11, R12
- **Dependencies and Preconditions:** Sub-Task 4.2.
- **In Scope for This Sub-Task:** `dh-preflight` + `dh-artifact-check`, `dh-final-review`, `dh-create-documentation` for the new skills/contract, `dh-semver` recommendation, and `docs/plans/index.md` status update.
- **Out of Scope for This Sub-Task:** Publishing or tagging without explicit approval.
- **Instructions:** Follow loop steps 3–5; record the verdict and deferred findings; do not mark complete around open P0/P1 findings.
- **Acceptance Criteria:** Final review returns approve or approve-with-comments; docs are updated; a semver recommendation is recorded; the plans index is current.
- **Cautionary Points (Risks & Edge Cases):** No premature tag; keep historical plan records intact; report remaining P2/P3 findings.
- **Implementation Suggestions:** Use the bundled review/documentation/semver skills; keep the release note concise.
- **Testing Suggestions:** Review file verdict plus gate evidence.
- **Done When:** Plan is signed off and release-ready.

## Final Integration & Verification

- **System-Wide Test:** Rehearsal scenarios plus `pnpm qa:check:full`, the inventory grep gate, and the handoff contract test.
- **Completion Checklist:** 19 skills register; both skills link the handoff contract; execute-plan guard works; no parser/status/MCP change; docs and index consistent; rehearsal evidence committed; final review approved.

## Open Questions

- Should `handoff.md` be committed by default? Assumed yes (docs/plans is tracked); revisit if teams prefer local-only handoffs.
- Should clean resume always delegate immediately, or wait for confirmation? Assumed immediate delegation after the summary; ask only on material drift.
- Should `docs/plans/index.md` expose a paused value? Assumed no; the handoff status is the signal and the index schema stays unchanged.
