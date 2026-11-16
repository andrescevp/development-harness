---
title: Parallel Plan Execution and Orchestration
slug: parallel-plan-execution
description: Explicit parallel metadata, DAG scheduling, hybrid worktree isolation, and orchestrator-owned status across standard and fast plan execution.
tags: [sdd, design, orchestration, parallelism]
project: dev-harness-skills
stack: Markdown harness skills + TypeScript MCP/TUI tooling
created: 2026-11-16
updated: 2026-11-16
status: proposed
---

# Software Design Document: Parallel Plan Execution and Orchestration

## Problem Statement

The harness executes plans strictly sequentially:

- `dh-execute-plan` iterates phases in order and sub-tasks in order, one at a
  time.
- `dh-execute-plan-task` selects exactly one active sub-task and treats multiple
  `In Progress` sub-tasks as an ambiguous state to stop on.
- `dh-execute-plan-fast` has the same single-task selection model and assumes
  one active phase.
- `dh-planning` has no way to declare that two sub-tasks are independent or that
  their file scopes do not overlap.

This leaves wall-clock time on the table for genuinely independent work and
makes “parallel” execution impossible without ad-hoc user orchestration. It also
means the plan format cannot express phase-level or sub-task-level dependencies,
so an orchestrator cannot safely decide what may run concurrently.

## Goals / Non-Goals

- **Goals:**
  - Let plans declare phase and sub-task parallelism explicitly: dependencies,
    parallel eligibility, file/scope ownership, and isolation mode.
  - Add a deterministic scheduler that preserves the current sequential
    behavior for legacy plans and runs declared-safe work concurrently (default
    3 workers, configurable cap).
  - Support both phase-level and sub-task-level parallelism with dependency
    gates and phase lifecycle preservation.
  - Isolate work safely: same worktree only for disjoint declared scopes;
    overlapping work is serialized or runs in per-task worktrees.
  - Keep the orchestrator as the sole writer of plan statuses and fast-mode
    ledger rows; workers return results only.
  - Support resume when multiple sub-tasks are `In Progress`.
  - Keep standard and fast execution behavior consistent.
- **Non-Goals:**
  - Distributed execution across machines or an external job queue.
  - Automatic discovery of file scope from diffs; plans must declare it.
  - Automatic merge-conflict resolution.
  - Changing the runtime’s subagent concurrency limits or agent/orchestrator
    implementation.
  - Executing independent plans in parallel; this is per-plan orchestration.

## Requirements

- **R1:** Extend the phased plan format with explicit parallel metadata:
  - phase: `Parallelizable: yes | no`, `Depends on: <phase ids | None>`
  - sub-task: `Parallelizable: yes | no`, `Depends on: <sub-task ids | None>`,
    `Files/Scope: <declared paths/globs | None>`, `Isolation: shared | worktree`
  - defaults preserve sequential behavior (`Parallelizable: no`,
    `Depends on: None`, `Isolation: shared` for legacy/missing fields).
- **R2:** Add a deterministic DAG scheduler shared by both orchestrators:
  - ready when phase dependencies are `Completed` and the phase is `Pending`;
  - sub-tasks ready when their phase is active, status `Pending`, dependencies
    `Completed`, and `Parallelizable: yes` (or the phase is sequential and this
    is its next listed sub-task);
  - default maximum 3 concurrent workers, with an explicit plan/orchestrator
    override and a hard cap;
  - multiple phases/sub-tasks may be `In Progress` simultaneously;
  - a phase closes only when all its sub-tasks are `Completed`.
- **R3:** Isolate concurrent work:
  - same worktree only when the declared `Files/Scope` sets are disjoint;
  - overlapping scopes are serialized unless a task declares
    `Isolation: worktree`;
  - worktree tasks run on dedicated branches/worktrees and are integrated back
    in dependency/plan order; conflicts block;
  - never run concurrent git index operations or concurrent same-worktree
    commits.
- **R4:** The orchestrator is the sole writer of plan statuses and fast-mode
  ledger rows. Parallel workers implement and validate only; they return a
  result envelope (status, files changed, validation, blockers, notes) and never
  edit plan files.
- **R5:** `dh-execute-plan` uses the scheduler: dispatch ready workers in
  parallel, review completed tasks as they finish (fan-in), stop scheduling new
  work after a blocking failure, drain in-flight work, and leave the plan
  resumable without false phase completion.
- **R6:** `dh-execute-plan-fast` uses the same scheduler with no per-task gates;
  the orchestrator writes ledger rows serially and runs the end gates once.
- **R7:** `dh-execute-plan-task` and `dh-execute-plan-task-fast` gain a parallel
  worker mode: no status writes, no review/finalization, result envelope return.
  Standalone/single-task behavior stays unchanged.
- **R8:** `dh-planning` teaches and validates the metadata: when to mark
  parallel, how to declare dependencies/scopes, and when to choose worktree
  isolation; template/scaffold/fixture updated.
- **R9:** MCP plan tools and readers expose the new fields (`plan_read`,
  `plan_create`, fast mirror render/sync) and tolerate multiple `In Progress`
  entries; the TUI shows multiple active tasks (or a clear aggregate) instead of
  assuming one.
- **R10:** Tests, docs, audit, build, and smokes cover the schema, scheduler,
  isolation policy, status ownership, resume, fast-mode mirroring, and legacy
  sequential behavior.
- **AC1:** Legacy plans without parallel metadata parse and execute exactly as
  before (sequential).
- **AC2:** A plan with explicit independent sub-tasks schedules them
  concurrently up to the limit while respecting dependencies and phase
  dependencies.
- **AC3:** Overlapping declared scopes never run concurrently in a shared
  worktree; worktree-isolated tasks are integrated in a defined order.
- **AC4:** Multiple `In Progress` phases/sub-tasks are valid and resumable;
  phases close only when all their sub-tasks are complete.
- **AC5:** Worker-mode task skills leave plan files untouched; the orchestrator
  performs every status and ledger write.
- **AC6:** A blocking worker failure stops new dispatch, drains in-flight work,
  leaves the failed sub-task open, and does not close its phase.
- **AC7:** Fast mode mirrors statuses for parallel tasks, keeps the mirror
  aligned, and records per-task/end-gate ledger rows without races.
- **AC8:** New tests cover parser metadata/defaults, scheduler readiness/limit,
  scope conflict/worktree policy, worker-mode isolation, failure drain, resume,
  and fast-mode mirroring; the full gate is green.
- **AC9:** README, AGENTS.md, LOADING, skills index, CHANGELOG, and close-out
  notes explain the parallel model, defaults, limits, isolation, and residual
  risks.

## Scope

- **In scope:**
  - Plan schema fields, parser, scaffold, canonical fixture, fast mirror
    rendering/sync.
  - Shared scheduler contract/reference and both orchestrators.
  - Worker mode in both per-task skills.
  - `dh-planning` decomposition guidance and template.
  - MCP plan tools + TUI reader compatibility for multiple active tasks.
  - Hybrid shared/worktree isolation and integration rules.
  - Resume/pause behavior with multiple active tasks (including handoff fields).
  - Tests, docs, changelog, audit, build, smokes, evolution/observation notes.
- **Out of scope:**
  - Distributed execution, external queues, or cross-plan parallelism.
  - Automatic scope discovery or automatic merge-conflict resolution.
  - Changing runtime subagent concurrency or agent definitions.
  - Replacing the phased model or the fast-mirror integrity contract.

## Workspace Impact

- **Workspace root:** `None — standalone repository`
- **Affected packages:** `None — standalone`
- **Shared paths:** `skills/`, `src/tools/`, `src/mcp/`, `src/tui/`, `src/__tests__/`,
  `docs/`, `AGENTS.md`, `README.md`, `CHANGELOG.md`

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| None — standalone repository | Markdown skills + TypeScript | `pnpm test` | `pnpm build` | `docs/` | fixed |

## Assumptions and Constraints

- Plans are executed on one machine in one repository/workspace; worktrees are
  local git worktrees.
- The plan author declares dependencies and file scopes accurately; the
  scheduler cannot infer semantic independence.
- The default concurrency is 3; the hard cap is a small constant (e.g. 8) to
  avoid runaway subagent usage.
- Legacy plans without the new fields remain valid and sequential.
- The orchestrator can spawn multiple subagents concurrently through the
  runtime’s agent capability; if the runtime serializes them, the scheduler
  still produces correct (slower) results.
- Same-worktree tasks are safe only when their declared file scopes are
  disjoint; build/test resource collisions remain a documented risk.
- Worktree integration uses the existing `dh-create-worktree` lifecycle and
  never pushes or deletes user work without confirmation.

## Risks and Edge Cases

- **False independence:** inaccurate `Files/Scope` can cause concurrent edits to
  the same file or generated artifact. Mitigation: explicit declaration,
  conservative overlap check (prefix/glob), serialization fallback.
- **Build/test interference:** shared worktree tasks may race on build outputs,
  ports, caches, or lockfiles even with disjoint source scopes. Mitigation:
  document; use `Isolation: worktree` for tooling-heavy tasks.
- **Git races:** concurrent commits/index operations in one worktree corrupt
  state. Mitigation: orchestrator serializes commits; workers never commit.
- **Status races:** concurrent plan writes lose updates. Mitigation:
  orchestrator-only writes, serialized by design.
- **Multiple In Progress:** resume and readers must reconcile all active tasks,
  not just the first; duplicate dispatch must be avoided.
- **Phase deadlock:** dependencies that can never be satisfied. Mitigation:
  validate DAG/refs at scheduling time; stop and report cycles/missing refs.
- **Worktree merge conflicts:** integration order and conflict handling must be
  explicit; conflicts block and preserve worktrees for inspection.
- **Fast mirror drift:** parallel status writes must update both plans and
  ledger serially; `source_sha256` unaffected by statuses but affected by record
  edits.
- **Over-parallelization:** token/cost/agent limits; default 3 and a hard cap.
- **Legacy plans:** missing fields must default to sequential to avoid
  surprising concurrency.

## Acceptance Criteria

- **AC1:** Legacy plan fixture executes sequentially with no field changes.
- **AC2:** A parallel fixture schedules independent tasks up to 3, respecting
  dependencies and phase gates.
- **AC3:** Overlapping scopes serialize; worktree tasks integrate in defined
  order; conflicts block without data loss.
- **AC4:** Multiple In Progress statuses are readable/resumable; no phase closes
  early.
- **AC5:** Workers do not write plan files; orchestrator status/ledger writes are
  authoritative.
- **AC6:** A blocking failure drains in-flight work and leaves the plan
  resumable and phase-open.
- **AC7:** Fast mirror remains aligned and ledger rows are recorded once per
  task/gate.
- **AC8:** Tests cover parser/scheduler/isolation/worker/resume/fast behavior;
  full gate green.
- **AC9:** Docs and close-out notes describe the model and limits.

## Open Questions

- Should the concurrency limit be plan-frontmatter (`parallelism: 3`) or only an
  orchestrator/CLI override? Planned: frontmatter optional + orchestrator
  override, hard cap constant.
- Should phase-level parallelism be enabled by `Parallelizable: yes` only, or
  also require `Depends on`? Planned: either field may enable; missing/`no`
  keeps sequential.
- Should worktree integration use merge or cherry-pick? Planned: merge each
  task branch in dependency/plan order; conflicts block.
