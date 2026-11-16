---
title: "Parallel Plan Execution and Orchestration — Fast Execution"
slug: parallel-plan-execution
description: "Fast execution mirror of plan.md; critical verification deferred to plan end."
source_plan: plan.md
source_sha256: 09f760691931b9e8c4442bbdbd70590f43f3ee849cce551253b2fa3b134f4d27
plan_version: fast-4
status: Completed
active: true
tags: [plan, fast]
project: "dev-harness-skills"
created: 2026-11-16
updated: 2026-11-16
---

# Plan: Parallel Plan Execution and Orchestration (Fast Execution)

## Fast Execution Policy

- No per-task `dh-review`, `dh-simplify`, `dh-code-review`, `dh-preflight`,
  `dh-artifact-check`, or `dh-domain-check` gates.
- Execution position and statuses are read from this file; every phase and
  sub-task status change is mirrored to `plan.md` in the same turn.
- A phase moves to `In Progress` when its first sub-task starts and closes only
  when ALL its sub-tasks are `Completed`; close pending phases in both files.
- Narrow validation (tests/lint for changed files) stays part of each sub-task;
  it is a sanity check, not a review gate.
- All critical verification runs once across plan end (see Final Verification).
- Hard blockers halt the loop; a blocked sub-task blocks its phase.

## Alignment Contract

- Same phases/sub-tasks as `plan.md`: count, IDs, titles, order, requirements,
  scope, dependencies, instructions, acceptance criteria, done-when.
- Allowed differences: this policy, this contract, `## Final Verification`, the
  omitted top-level sections, and status progression.
- Omits from `plan.md`: `## Objective`, `## Requirements Snapshot`, `## Scope`, `## Workspace Impact`, `## Assumptions and Constraints`, `## Risks and Areas Requiring Care`, `## Core concepts`, `## Visual Context`, `## Research`, `## Agent Selection`, `## Execution Record`, `## Open Questions`.
- Not allowed: missing/extra/reordered/renamed items; changed requirements,
  scope, or acceptance criteria. `plan.md` is the scope reference.
- Misalignment is fixed here; never rewrite `plan.md` scope.

## Phases

### Phase 1: Schema, scheduler contract, and readers

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** None

#### Sub-Task 1.1: Extend the phased plan schema, parser, scaffold, and fixture with parallel metadata

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** None
- **Files/Scope:** `skills/dh-planning/references/phased-plan-template.md`, `src/tools/plan-template.ts`, `src/tools/plan-lifecycle.ts`, `src/__tests__/fixtures/plans/phased-plan.md`, `src/__tests__/plan-lifecycle.test.ts`
- **Isolation:** shared
- **Objective:** Add the phase/sub-task parallel fields to the authoritative format and parser, with legacy defaults.
- **Related Requirements:** R1, R8, R10, AC1, AC8
- **Dependencies and Preconditions:** SDD approved; current parser/template understood.
- **In Scope for This Sub-Task:** Template marker rules and scaffold fields; `PlanPhase`/`PlanSubTask` types and regexes; parser defaults (`Parallelizable: no`, `Depends on: None`, `Files/Scope: None`, `Isolation: shared`); canonical fixture examples; parser tests for new/legacy plans.
- **Out of Scope for This Sub-Task:** Scheduler logic, orchestrators, TUI, docs.
- **Instructions:**
  1. Add phase fields after `Status`: `Parallelizable` (`yes|no`) and `Depends on` (comma-separated phase numbers or `None`).
  2. Add sub-task fields after `Delegated to agent`: `Parallelizable`, `Depends on` (comma-separated `N.M` or `None`), `Files/Scope` (comma-separated paths/globs or `None`), `Isolation` (`shared|worktree`).
  3. Update the template marker rules: status remains the first bullet; new fields are optional and default when absent; update the scaffold literal and fixture.
  4. Extend `parsePlan` to expose `parallelizable`, `dependsOn: string[]`, `filesScope: string[]`, `isolation` on phases/sub-tasks; legacy plans get empty arrays/defaults and still parse.
  5. Restrict parsing to the `## Phases` region (stop at the next top-level `##` or EOF) and ignore fenced code blocks, so phase/sub-task examples in `## Core concepts` or templates cannot create phantom phases; add a regression test.
  6. Keep `plan_create`/`buildPlanTemplate` compiling by adding optional metadata inputs; if changing its signature, update callers/tests.
- **Acceptance Criteria:** Template/scaffold/fixture include the fields; parser exposes them with defaults; legacy fixture parses unchanged; fenced phase examples are ignored; invalid/unknown values either reject clearly or default documented; parser tests pass.
- **Cautionary Points:** Status must stay the first bullet; do not let new bullets break `findSections`; CRLF tolerance; no change to requirement IDs; keep the canonical fixture byte-stable relative to the template; do not parse headings inside fenced examples.
- **Implementation Suggestions:** Add regexes next to `RELATED_RE`/`DELEGATED_RE`; parse in the existing per-section loop; expose values as arrays; use `None` as the empty sentinel; scope `findSections` to the `## Phases` region and track fences.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/plan-lifecycle.test.ts src/__tests__/workspace-plan-contract.test.ts`; add legacy/new cases and a fenced-example phantom-phase regression.
- **Done When:** Parser/template/scaffold/fixture support the fields and legacy tests pass.

#### Sub-Task 1.2: Add the shared scheduler contract and validation helpers

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 1.1
- **Files/Scope:** `skills/dh-execute-plan/references/parallel-scheduler.md`, `src/__tests__/parallel-scheduler-contract.test.ts`, possibly `skills/dh-execute-plan-fast/references/parallel-scheduler.md`
- **Isolation:** shared
- **Objective:** Write one authoritative scheduler contract that both orchestrators follow, with validation rules and pseudocode.
- **Related Requirements:** R2, R5, R6, R8, AC2, AC4, AC6, AC8
- **Dependencies and Preconditions:** 1.1 parser fields.
- **In Scope for This Sub-Task:** DAG validation (missing refs, cycles, phase/task deps), readiness, concurrency (default 3, hard cap 8, override), scope-conflict policy, worktree policy reference, failure drain, resume rules, result envelope, pseudocode/examples.
- **Out of Scope for This Sub-Task:** Editing the orchestrators (3.1/3.2), parser code, docs.
- **Instructions:**
  1. Create `skills/dh-execute-plan/references/parallel-scheduler.md` as the single contract; `dh-execute-plan-fast` links to it (avoid duplicate prose).
  2. Define validation: every `Depends on` ref exists; no cycles; phase deps are phase ids; task deps are `N.M`; `Files/Scope: None` means unknown/serialize; `Isolation: worktree` requires a declared scope.
  3. Define readiness, concurrency, dispatch, fan-in, failure drain, phase closure, resume of multiple `In Progress`, and the worker result envelope.
  4. Include a compact pseudocode block and two examples: legacy sequential plan and parallel phase/sub-task plan.
  5. Add a contract test that asserts both orchestrator skills link the reference and contain the required scheduler keywords (worker mode, orchestrator-owned status, max concurrency, failure drain).
- **Acceptance Criteria:** One scheduler reference exists; validation/readiness/failure/resume rules are unambiguous; both orchestrators can link it; contract test passes.
- **Cautionary Points:** Do not duplicate the scheduler in two references; avoid implementation-specific TypeScript; keep Markdown <250 lines if it is a skill file (references can be longer).
- **Implementation Suggestions:** Put the algorithm in a table/flow plus pseudocode; call out `Parallelizable: no` default and `Files/Scope: None` serialization.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/parallel-scheduler-contract.test.ts`; `node scripts/check-links.mjs`.
- **Done When:** The scheduler contract is authoritative and linkable from both orchestrators.

#### Sub-Task 1.3: Extend MCP plan tools and TUI readers for multiple active tasks

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 1.1
- **Files/Scope:** `src/mcp/server.ts`, `src/mcp/tool-results.ts` (only if metadata), `src/tools/plan-lifecycle.ts`, `src/tools/plan-template.ts`, `src/tools/plan-fast-template.ts`, `src/tui/plan-progress.ts`, `src/tui/plan-state.ts`, MCP/TUI tests
- **Isolation:** shared
- **Objective:** Expose parallel metadata through `plan_read`/`plan_create`, keep fast mirror/sync correct, and make TUI readers tolerate multiple active tasks.
- **Related Requirements:** R1, R9, R10, AC1, AC4, AC7, AC8
- **Dependencies and Preconditions:** 1.1 parser/template; 1.2 scheduler semantics.
- **In Scope for This Sub-Task:** `plan_read` payload fields; `plan_create` optional metadata inputs and scaffold; `plan_fast_read`/`plan_update_status`/`plan_fast_sync` status handling for multiple In Progress; TUI `activeSubTasks`/aggregate label; tests/fixtures.
- **Out of Scope for This Sub-Task:** Orchestrator scheduling, worker modes, worktree execution.
- **Instructions:**
  1. Ensure `plan_read` returns phase/sub-task metadata; add MCP schema fields where inputs need metadata.
  2. `plan_create` accepts optional metadata per phase/sub-task and renders it; keep required fields/backward compatibility.
  3. Verify `plan_update_status` allows multiple `In Progress` phases/sub-tasks (no uniqueness guard) and phase completion still requires all sub-tasks Completed.
  4. `plan_fast_update_status` must mirror multiple In Progress statuses without assuming one; `plan_fast_sync` compares sets of In Progress, not a single one.
  5. TUI: replace single `current`-only assumptions with `activeSubTasks`/aggregate label (e.g., “3 active — 2.1, 2.2, 2.3”); keep a deterministic primary for the sidebar.
  6. Add tests: plan_read metadata, plan_create metadata, multiple In Progress round-trip, fast sync with parallel statuses, TUI derivation with 2+ active.
- **Acceptance Criteria:** Tools expose metadata; fast mirror/sync handles multiple active tasks; TUI renders multiple active tasks without errors; 12-tool count unchanged; tests pass.
- **Cautionary Points:** Do not add a 13th MCP tool; keep `plan_fast` omitting non-phase sections; preserve current single-active output shape for legacy/one-active plans; TUI must remain read-only.
- **Implementation Suggestions:** Extend the parser types first; use arrays and an `activeSubTasks` list; keep the TUI's current primary selection deterministic (lowest index) for the sidebar.
- **Testing Suggestions:** `pnpm vitest run src/mcp/__tests__ src/tui/__tests__ src/__tests__/plan-lifecycle.test.ts`; `pnpm typecheck`.
- **Done When:** Tools and readers support the new fields and multiple active tasks.

### Phase 2: Planning guidance and worker modes

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** 1

#### Sub-Task 2.1: Teach dh-planning and the plan template parallel decomposition

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 1.1
- **Files/Scope:** `skills/dh-planning/SKILL.md`, `skills/dh-planning/references/phased-plan-template.md`, `src/__tests__/agent-selection.test.ts` (or a planning contract test)
- **Isolation:** shared
- **Objective:** Make parallel metadata part of planning: when to mark phases/tasks parallel, how to declare dependencies/scopes/isolation, and what to validate.
- **Related Requirements:** R1, R8, AC1, AC2, AC3, AC8
- **Dependencies and Preconditions:** 1.1 parser/template; 1.2 scheduler rules.
- **In Scope for This Sub-Task:** Planning Core Rules/Workflow and template guidance; decomposition checklist; examples; contract test for the fields.
- **Out of Scope for This Sub-Task:** Orchestrator logic, TUI/MCP code, docs.
- **Instructions:**
  1. Add a planning rule: default every phase/sub-task to `Parallelizable: no`, `Depends on: None`, `Files/Scope: None`, `Isolation: shared`.
  2. Mark `Parallelizable: yes` only when the task has no unmet dependency and its declared scope is disjoint from other concurrent tasks; use `Isolation: worktree` for overlapping or tooling-heavy work.
  3. Add a validation checklist: dependency refs exist, no cycles, phase/task order sane, shared-scope overlaps not marked parallel, worktree tasks declare scopes.
  4. Add one short example of a parallel phase with two disjoint sub-tasks and one worktree task.
  5. Update the template guidance (not just fields) and add a contract test asserting the planning skill mentions `Parallelizable`, `Depends on`, `Files/Scope`, `Isolation`.
- **Acceptance Criteria:** Planning guidance is actionable and consistent with the scheduler; template examples include parallel fields; contract test passes; plan creation still works.
- **Cautionary Points:** Do not force parallelism; default sequential. Do not mark tasks parallel merely because they touch different directories if build artifacts overlap. Keep plan file <250 lines? Skill file limit; keep concise.
- **Implementation Suggestions:** Put the detailed rules in the template/reference and a short pointer in `dh-planning` to avoid duplication.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/agent-selection.test.ts src/__tests__/parallel-scheduler-contract.test.ts`; `node scripts/check-links.mjs`.
- **Done When:** Planning produces valid parallel metadata and the template documents it.

#### Sub-Task 2.2: Add parallel worker mode to both per-task skills

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 1.2
- **Files/Scope:** `skills/dh-execute-plan-task/SKILL.md`, `skills/dh-execute-plan-task-fast/SKILL.md`, `src/__tests__/parallel-scheduler-contract.test.ts`
- **Isolation:** shared
- **Objective:** Add a worker mode where the orchestrator supplies the exact sub-task and the task skill implements/validates only, returning a result envelope with no plan/ledger writes.
- **Related Requirements:** R4, R7, AC5, AC8
- **Dependencies and Preconditions:** 1.2 result-envelope contract; 2.1 planning fields.
- **In Scope for This Sub-Task:** Worker-mode sections in both task skills; result envelope; no status/review/finalization in worker mode; standalone behavior unchanged; contract tests.
- **Out of Scope for This Sub-Task:** Orchestrator dispatch loop, worktree creation, docs.
- **Instructions:**
  1. Add a “Parallel worker mode” section activated when the orchestrator passes `parallel-worker` plus the exact `subTask` ID.
  2. In worker mode: read the plan for the brief, resolve the delegated agent, implement/TDD/validate, return `{subTask, agent, status, filesChanged, validation, blockers, notes}`, and STOP. Do not mark status, do not write plan/ledger, do not run `dh-review`/finalization, do not commit.
  3. Keep standalone mode exactly as today (status updates/review orchestration notes remain).
  4. In the fast task skill, worker mode skips the six ledger rows (orchestrator writes them) and the dual status writes.
  5. Add contract tests asserting the worker-mode keywords and absence of status write instructions in that section.
- **Acceptance Criteria:** Both task skills support worker mode; result envelope defined; worker mode has no plan/ledger writes; standalone behavior unchanged; tests pass.
- **Cautionary Points:** Do not accidentally remove the standalone status path; make the mode switch explicit and hard to confuse. Workers must not commit in shared worktrees.
- **Implementation Suggestions:** Use a dedicated `## Parallel Worker Mode` section with an explicit “do not” list; reference the scheduler contract for the envelope.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/parallel-scheduler-contract.test.ts src/__tests__/frontmatter.test.ts`; skill line limits.
- **Done When:** Worker mode is explicit and test-covered.

### Phase 3: Orchestrators and isolation

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** 2

#### Sub-Task 3.1: Implement the parallel scheduler in dh-execute-plan

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 1.2, 2.2
- **Files/Scope:** `skills/dh-execute-plan/SKILL.md`, `skills/dh-execute-plan/references/parallel-scheduler.md`, `src/__tests__/parallel-scheduler-contract.test.ts`
- **Isolation:** shared
- **Objective:** Replace the sequential loop with the ready-set scheduler, orchestrator-owned status writes, parallel worker dispatch, review fan-in, failure drain, and multi-active resume.
- **Related Requirements:** R2, R3, R4, R5, AC2, AC3, AC4, AC5, AC6, AC8
- **Dependencies and Preconditions:** 1.2 scheduler contract, 2.2 worker mode.
- **In Scope for This Sub-Task:** `dh-execute-plan` Core Rules/Workflow/Resume/Error Handling; dispatch up to 3 workers via the runtime agent tool; mark In Progress before dispatch; review completed tasks as they finish; stop new dispatch on P0/P1 or worker block; drain; close phases only when all complete; serialized commits and status writes.
- **Out of Scope for This Sub-Task:** Fast orchestrator, worktree mechanics (3.3), docs.
- **Instructions:**
  1. Replace “iterate phases/sub-tasks in order” with the scheduler: compute ready set each cycle, dispatch up to limit, fan in, repeat.
  2. Orchestrator-only writes: mark `In Progress` before dispatch, `Completed` only after review, phase `In Progress`/`Completed` serialized; workers never write.
  3. Standard review fan-in: run `dh-review` per completed worker; collect P0/P1; if any, stop new dispatch, drain in-flight, leave failed tasks In Progress.
  4. Resume: collect all In Progress tasks; revalidate/re-review or re-dispatch; never skip/duplicate; phase closure only when all Completed.
  5. Commits: workers do not commit; orchestrator commits completed shared-worktree work in a deterministic order (or after a batch) and worktree branches in dependency/plan order.
  6. Add a contract test for the scheduler keywords and a multi-active example.
- **Acceptance Criteria:** Scheduler matches the reference; max 3 default; dependencies/phase gates; multiple In Progress; failure drain; resume; no phase close around a blocker; tests pass.
- **Cautionary Points:** Do not dispatch a task whose dependency is still In Progress; do not close a phase early; do not let two shared-worktree workers overlap scopes; do not run concurrent git writes.
- **Implementation Suggestions:** Use the reference pseudocode; keep a running set of `{subTask, isolation, worktree, agent}`; record results before scheduling the next cycle.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/parallel-scheduler-contract.test.ts`; `node scripts/check-links.mjs`.
- **Done When:** Standard orchestration runs ready work in parallel and remains resumable.

#### Sub-Task 3.2: Implement the parallel scheduler in dh-execute-plan-fast

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 3.1
- **Files/Scope:** `skills/dh-execute-plan-fast/SKILL.md`, `skills/dh-execute-plan-fast/references/plan-fast-template.md`, `src/__tests__/parallel-scheduler-contract.test.ts`
- **Isolation:** shared
- **Objective:** Apply the same scheduler to fast mode with no per-task gates, serialized ledger writes, and end gates once.
- **Related Requirements:** R2, R4, R6, AC2, AC5, AC7, AC8
- **Dependencies and Preconditions:** 3.1 standard scheduler; 2.2 fast worker mode.
- **In Scope for This Sub-Task:** `dh-execute-plan-fast` Core Rules/Workflow/Step 5/6; scheduler link; multiple In Progress mirror handling; orchestrator writes ledger rows per task; end gates once; failure drain.
- **Out of Scope for This Sub-Task:** Standard orchestrator, worktree mechanics (3.3), docs.
- **Instructions:**
  1. Replace the single-task selection loop with the shared scheduler; dispatch up to 3 fast workers in parallel; no per-task review/simplify/code-review.
  2. Orchestrator marks dual statuses serially; workers do not write plan/ledger.
  3. Append the six per-task ledger rows per completed task serially; never concurrently.
  4. Plan-end sync must accept multiple In Progress during run and exact equality at close; handle phase closures.
  5. Failure drain: stop new dispatch, drain, leave tasks In Progress; pause/resume.
  6. Add a contract test for fast scheduler keywords/ledger ownership.
- **Acceptance Criteria:** Fast mode schedules in parallel, mirrors statuses, writes ledger once per task, end gates once, failure drain works; tests pass.
- **Cautionary Points:** Do not let concurrent `dh_plan_fast_update_status` calls race; do not append ledger rows in workers; keep `source_sha256` alignment.
- **Implementation Suggestions:** Reuse the scheduler reference; keep a single `writeQueue`/serial promise in instructions; one ledger append per task after completion.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/parallel-scheduler-contract.test.ts src/mcp/__tests__/plan-fast-sync.test.ts`; `node scripts/check-links.mjs`.
- **Done When:** Fast orchestration is parallel, race-free, and aligned.

#### Sub-Task 3.3: Add hybrid shared/worktree isolation and integration rules

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 3.1
- **Files/Scope:** `skills/dh-execute-plan/SKILL.md`, `skills/dh-execute-plan/references/parallel-scheduler.md`, `skills/dh-create-worktree/SKILL.md`, `src/__tests__/parallel-scheduler-contract.test.ts`
- **Isolation:** shared
- **Objective:** Define and wire the hybrid policy: disjoint scopes share a worktree; overlaps serialize or use worktrees; worktrees integrate in order; conflicts block.
- **Related Requirements:** R3, AC3, AC8
- **Dependencies and Preconditions:** 3.1 scheduler; `dh-create-worktree` lifecycle.
- **In Scope for This Sub-Task:** Scope normalization/overlap algorithm (prefix/glob, `None` = serialize), `Isolation: worktree` execution, branch/worktree creation, integration order, conflict/cleanup rules, shared-worktree commit serialization.
- **Out of Scope for This Sub-Task:** Automatic scope discovery, automatic conflict resolution, remote pushes.
- **Instructions:**
  1. Add a scope-conflict table: exact path, directory prefix, glob overlap, `None` unknown; shared overlapping tasks serialize unless worktree.
  2. Worktree tasks: create a branch/worktree via `dh-create-worktree`; run the worker there; on completion integrate in dependency/plan order (merge/cherry-pick); conflicts stop with worktree preserved.
  3. Shared worktree: disjoint scopes only; workers never commit; orchestrator serializes commits; no concurrent git index ops.
  4. Cleanup: remove merged worktrees/branches only with confirmation; preserve failed/conflicted ones.
  5. Add contract tests/examples for overlap, disjoint, `None`, and worktree integration.
- **Acceptance Criteria:** Isolation policy is explicit and consistent with the scheduler; overlapping shared scopes cannot run concurrently; worktree integration/conflict/cleanup rules documented and test-covered.
- **Cautionary Points:** Do not delete worktrees automatically; do not push; do not resolve conflicts silently; `Files/Scope` globs must be normalized safely.
- **Implementation Suggestions:** Put the algorithm in the scheduler reference; keep orchestrator steps short with a link.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/parallel-scheduler-contract.test.ts src/__tests__/worktree-skill.test.ts`; `node scripts/check-links.mjs`.
- **Done When:** Hybrid isolation is defined, wired, and reviewed for data safety.

#### Sub-Task 3.4: Support pause/resume and handoff with multiple active tasks

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 3.1, 3.3
- **Files/Scope:** `skills/dh-pause-plan/SKILL.md`, `skills/dh-resume-plan/SKILL.md`, `skills/dh-pause-plan/references/handoff-template.md` (if present), `src/__tests__/handoff-contract.test.ts`
- **Isolation:** shared
- **Objective:** Extend pause/resume to capture and reconcile multiple active workers, worktrees, and pending reviews.
- **Related Requirements:** R5, AC4, AC6, AC8
- **Dependencies and Preconditions:** 3.1 scheduler; 3.3 isolation.
- **In Scope for This Sub-Task:** handoff fields for `activeSubTasks[]` (id, isolation, worktree/branch, validation, pending review), resume reconciliation, no duplicate dispatch, fast mode.
- **Out of Scope for This Sub-Task:** Changing the handoff lifecycle or status model.
- **Instructions:**
  1. Extend the handoff contract with an `activeSubTasks` list; keep single-task plans backward compatible.
  2. Resume: collect all In Progress tasks, detect worktrees/branches, revalidate completed-but-unreviewed work, resume or re-dispatch safely, then re-enter the scheduler.
  3. Document how to resolve a partially completed parallel batch; never mark phase Completed.
  4. Update handoff contract tests/fixtures.
- **Acceptance Criteria:** Handoff captures multiple active tasks; resume does not duplicate or lose work; phase remains open; tests pass.
- **Cautionary Points:** Do not resume a worktree on the wrong branch; do not assume one active task; preserve failed worktrees.
- **Implementation Suggestions:** Reuse the existing handoff frontmatter; add a table/list rather than a new file.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/handoff-contract.test.ts`; `node scripts/check-links.mjs`.
- **Done When:** Pause/resume handles parallel batches and remains backward compatible.

### Phase 4: Documentation, verification, and close-out

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** 3

#### Sub-Task 4.1: Update project docs, changelog, and skill index for parallel execution

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Parallelizable:** no
- **Depends on:** 3.4
- **Files/Scope:** `README.md`, `AGENTS.md`, `docs/LOADING.md`, `skills/index.md`, `CHANGELOG.md`, `opencode.example.jsonc` (if config), docs examples
- **Isolation:** shared
- **Objective:** Document the parallel plan model, scheduler, limits, isolation, worker mode, and resume behavior.
- **Related Requirements:** R10, AC9
- **Dependencies and Preconditions:** Implementation complete.
- **In Scope for This Sub-Task:** README feature/section; AGENTS loop contract; LOADING operational guide; skills index rows; CHANGELOG Unreleased; example plan fields; concurrency override.
- **Out of Scope for This Sub-Task:** `docs/plans/**`, historical notes, source code.
- **Instructions:**
  1. Document defaults: `Parallelizable: no`, `Depends on: None`, `Files/Scope: None`, `Isolation: shared`; max 3 default/hard cap.
  2. Explain phase vs sub-task parallelism, readiness, multiple In Progress, orchestrator-owned status, worker envelope.
  3. Explain hybrid isolation: disjoint shared, overlap serialize/worktree, merge order/conflict/cleanup.
  4. Update AGENTS/skills index/README/LOADING/CHANGELOG; keep 6/27/12 counts.
- **Acceptance Criteria:** Docs match code/contract; no overclaiming; links resolve; counts stay.
- **Cautionary Points:** Do not claim automatic file-scope discovery or auto conflict resolution; do not claim workers update status.
- **Implementation Suggestions:** Link the scheduler reference as the detailed source; keep README to a headline + link.
- **Testing Suggestions:** `node scripts/check-links.mjs`; `rg` stale sequential claims.
- **Done When:** Docs describe the parallel model accurately.

#### Sub-Task 4.2: Run packaging and the full verification gate

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 4.1
- **Files/Scope:** build/test/lint/audit/smoke commands; `reports/audit.*`
- **Isolation:** shared
- **Objective:** Prove parser/tools/TUI/skills changes are release-ready.
- **Related Requirements:** R10, AC8
- **Dependencies and Preconditions:** Implementation/docs complete.
- **In Scope for This Sub-Task:** build, tests, typecheck, Biome, knip, jscpd, dependency-cruiser, links, audit, smokes, Docker scans; fix in-scope failures.
- **Out of Scope for This Sub-Task:** Release tagging/pushing.
- **Instructions:** Run the standard gate in order; confirm 12 tools/6 agents/27 skills; verify legacy and parallel fixtures; fix in-scope failures; regenerate audit reports.
- **Acceptance Criteria:** Full gate green; no weakened tests; audit PASS; smokes pass.
- **Cautionary Points:** `pnpm audit` vs `pnpm run audit`; build before registration/smoke tests; don’t skip failing tests.
- **Implementation Suggestions:** Use `dh-execute-cli`; capture log paths.
- **Testing Suggestions:** The gate itself.
- **Done When:** Gate green and audit reports regenerated.

#### Sub-Task 4.3: Write evolution and observation close-out notes

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Parallelizable:** no
- **Depends on:** 4.2
- **Files/Scope:** `docs/evolution/<date>-parallel-plan-execution.md`, `docs/evolution/observations/<date>-<hhmm>-parallel-plan-execution.md`, `docs/evolution/index.md`
- **Isolation:** shared
- **Objective:** Record the parallel orchestration evolution, validation, limits, and session learnings.
- **Related Requirements:** R10, AC9
- **Dependencies and Preconditions:** Gate complete.
- **In Scope for This Sub-Task:** Evolution + observation notes and index rows.
- **Out of Scope for This Sub-Task:** `docs/plans/**`, `docs/evolve/**`, source.
- **Instructions:** Capture design decisions (explicit metadata, orchestrator ownership, hybrid isolation), gate results, residual risks (scope false independence, build interference, worktree conflicts), and follow-ups.
- **Acceptance Criteria:** Both notes exist with frontmatter; index rows resolve.
- **Cautionary Points:** Do not claim distributed execution or automatic conflict resolution.
- **Implementation Suggestions:** Follow `dh-create-documentation/references/evolution-notes.md`.
- **Testing Suggestions:** `node scripts/check-links.mjs`.
- **Done When:** Notes and index rows are complete.

## Final Verification

### Plan-specific verification (copied from plan.md, unchanged)

- **System-Wide Test:** Parse a legacy plan (sequential) and a parallel fixture; assert the scheduler readiness set, max concurrency, scope conflict/worktree policy, multiple In Progress handling, worker envelope, failure drain, resume, and fast mirror/ledger behavior. Run the full gate, plan tools/TUI tests, and smokes; confirm 12 tools/6 agents/27 skills.
- **Completion Checklist:**
  - [ ] Plan metadata fields and defaults are parsed/scaffolded/rendered.
  - [ ] Legacy plans remain sequential.
  - [ ] Scheduler respects phase/task deps, max 3, scope conflicts, worktrees.
  - [ ] Multiple In Progress/resume supported; phases close only when complete.
  - [ ] Workers never write plan/ledger; orchestrator owns writes.
  - [ ] Failure drain/pause/resume safe.
  - [ ] Fast mirror/ledger aligned with parallel statuses.
  - [ ] MCP/TUI readers support metadata and multiple active tasks.
  - [ ] Docs/CHANGELOG/notes updated; full gate green.

### End gates (run once across plan end)

1. `dh-review` Plan Alignment Mode `phase: plan-end` → `tasks/review-fast-final.md`.
2. Execute the plan-specific System-Wide Test and Completion Checklist above.
3. `dh-simplify` + `dh-code-review` (software only).
4. `dh-domain-check` (architectural software plans only; otherwise not applicable).
5. `dh-preflight` + `dh-artifact-check`.
6. `dh-final-review` (reuse results; do not re-run preflight/artifact/semver).
7. `dh-create-documentation` + `dh-semver` (software only).
8. Append every outcome to `plan_fast_skip_checks.md` via `dh_plan_fast_skip_check`.
