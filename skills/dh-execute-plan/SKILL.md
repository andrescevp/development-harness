---
name: dh-execute-plan
description: >
  Orchestrate full plan execution: read plan.md, iterate sub-tasks delegating execution and review, resume on interruption, final-review sign-off, update index.md. Use when the user says 'execute plan', 'run the plan', or 'finish all tasks'.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Orchestrate the complete execution of a plan from start to finish. Iterate through all phases and their sub-tasks in order, delegate execution and review, handle interruptions, and produce a final sign-off.

## Core Rules

- Create a feature branch per plan execution
  - Check you are in main branch and create the feature branch.
  - If not in feature branch, ask user permission to continue before any change.
  - if working in monorepos with git submodules create a branch per submodule along with the branch of the main repository to align and trace commints between repositories.
- Read the plan with the `dh_plan_read` tool (`{ slug }` → structured JSON: meta, phases[].title/status, subTasks[].phase/title/status). Fallback when the tool is unavailable: read `./docs/plans/<plan-slug>/plan.md` manually, following the phased template markers (`## Phases` → `### Phase N: <title>` → `#### Sub-Task N.M: <title>` with `- **Status:**` bullets). These tools are exposed by the project-scope `dh` MCP server; under Code Mode they are called as `tools.dh.<tool>`, and `dh_<tool>` is the tool's normalized name (permission actions match `dh_*`).
- If the plan file does not exist, stop and report — suggest running the `dh-planning` skill first.
- **Paused handoff guard:** if `./docs/plans/<plan-slug>/handoff.md` exists with `status: paused`, do not start execution from plan statuses. Stop and direct the user to `dh-resume-plan` for that slug (it rehydrates context and detects drift). Bypass only on an explicit user instruction to skip rehydration.
- **Scheduler:** use [`references/parallel-scheduler.md`](references/parallel-scheduler.md) as the authoritative readiness/concurrency/isolation contract. Legacy plans (missing fields) run sequentially; declared-ready work runs concurrently up to 3 workers (hard cap 8).
- Phase lifecycle: a phase becomes `In Progress` when its first sub-task starts; it becomes `Completed` only when ALL its sub-tasks are `Completed`.
- **Orchestrator owns state:** only this orchestrator writes plan statuses, commits, and reviews. Parallel workers return a result envelope and never edit plan files or commit in a shared worktree.
- Do not re-execute sub-tasks already marked `Completed`; on resume, reconcile **all** `In Progress` tasks, not just the first.
- Update statuses with `dh_plan_update_status` serially (`target: "phase"|"subtask"`); a phase cannot be `Completed` while any sub-task is open.
- After each sub-task execution, run the `dh-review` skill before proceeding to the next.
- If a review produces P0/P1 findings, stop and report — do not continue to the next sub-task (a blocked sub-task blocks its phase).
- After the final sub-task, run the `dh-final-review` skill for sign-off.
- **Execution record (T1/T3):** when the last sub-task completes and before
  `dh-final-review`, write `## Execution Record` in `plan.md` with every field
  (`Execution status: In progress`). After an `Approve` / `Approve with comments`
  verdict and before marking the plan `Completed`, finalize the record and add
  the `docs/plans/index.md` `## Execution Records` row. Field contract and
  timing: [`../dh-planning/references/execution-record.md`](../dh-planning/references/execution-record.md).
  Never record secrets, tokens, or full diffs.
- Update `./docs/plans/index.md` when the plan is fully complete.
- **Resolve the roster once per plan:** before the first delegation, read `## Agent Selection` in `plan.md` and validate its rows for the delegated, review, and final-review roles. If the section or a required row is absent or stale (a named agent no longer exists), run the selection protocol in [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md): discover the runtime agent list, then project config/agent directories, then global definitions; record the choices and generic fallbacks in the plan before continuing.
- **One delegated agent per sub-task:** the active sub-task's `Delegated to agent` is the single executor. Implementation sub-tasks normally name the selected implementation agent; documentation/test-only sub-tasks name the matching selected role. There is no complexity- or type-based builder split. If the field is missing/empty/unknown or the named agent is unavailable, stop and report the gap — never substitute one silently.
- **Project type awareness is delegated to `dh-execute-plan-task`.** The orchestrator does not re-detect project type — the task skill runs the software/non-software post-steps. Do not hardcode implementation, review, or final-review agent choices in the orchestration loop.
- **After plan completion (all projects):** invoke `dh-create-documentation` to update docs and create the plan's evolution + observation notes (see its Custom Directives). This ensures knowledge persists beyond the active session.
- **After plan completion (software projects only):** invoke `dh-semver` for determining the next version bump.

## Workflow

### Step 1: Read plan and assess state

Read the plan (via `dh_plan_read`; fallback: manual read) and determine the starting point using this ordered priority:

0. Paused handoff: if `./docs/plans/<plan-slug>/handoff.md` exists with `status: paused`, stop and direct the user to `dh-resume-plan`. Do not apply priorities 1–4 until the handoff is `resumed` or the user explicitly bypasses it.
1. If all sub-tasks are `Completed` (every phase `Completed`), run `dh-final-review` skill only and proceed to Step 3. Skip the execution loop.
2. Resume mode: if one or more phases are `In Progress`, collect **all** `In Progress` sub-tasks (and their worktrees/branches) and hand that set to the scheduler; do not stop on multiple active tasks and do not restart completed work. If none is active, start from the first pending task of the first `In Progress` phase.
3. If all phases are `Pending` (all sub-tasks `Pending`), start from Phase 1's first sub-task.
4. If the plan has no phases/sub-tasks, or every phase/sub-task has an unrecognized status, report the ambiguous state and stop.

### Step 2: Execution loop (parallel scheduler)

Follow [`references/parallel-scheduler.md`](references/parallel-scheduler.md) exactly. At each cycle:

0. **Reconcile state**: run the phase-close sweep; validate every dependency ref/cycle; resolve the `## Agent Selection` roster and each ready sub-task's `Delegated to agent` (missing/unknown → stop). On resume, collect **all** `In Progress` tasks and their worktrees/branches before dispatching anything.

1. **Compute the ready set**: phases whose dependencies are `Completed`, then sub-tasks that are `Pending`, dependency-complete, `Parallelizable: yes` (or the next task of a sequential phase), and scope-compatible with running shared-worktree tasks.

2. **Dispatch up to the limit** (default 3, hard cap 8):
   - mark the sub-task `In Progress` (and its phase on first start) with `dh_plan_update_status` **before** dispatch;
   - invoke `dh-execute-plan-task` in `parallel-worker` mode with the exact sub-task ID and isolation mode;
   - never dispatch two overlapping shared-worktree scopes, and never let workers commit.
   - Dispatch order: phase order, sub-task order, dependency order.

3. **Fan in as workers finish**:
   - run `dh-review` (and `dh-code-review` through the selected reviewer) for the completed task;
   - P0/P1 → stop new dispatch, drain in-flight work, leave the task/phase open, preserve worktrees, and report (recommend `dh-pause-plan`);
   - no P0/P1 → mark `Completed` and close the phase only when all its sub-tasks are `Completed`.

4. **Isolation integration**: for shared worktrees, the orchestrator serializes commits; for worktree tasks, integrate branches/worktrees in dependency/plan order, preserving any conflict for inspection.

5. **Repeat** until all sub-tasks are `Completed`; then run Step 3. Any deadlock/no-ready state with pending work is a hard stop — report missing/cyclic metadata, do not guess.

### Step 3: Final sign-off

After all sub-tasks are completed and verified:

1. **Write the execution record (T1):** fill `## Execution Record` in `plan.md`
   after `## Final Integration & Verification` with the workspace root,
   repository kind/path, branch/worktree, provisional commit range, plan and
   mirrored plan paths, summary, architectural changes and references;
   `Execution status: In progress`
   ([`../dh-planning/references/execution-record.md`](../dh-planning/references/execution-record.md)).
2. Run the `dh-final-review` skill for the comprehensive final plan review.
3. Read the final review verdict from `./docs/plans/<plan-slug>/tasks/review.md`.
4. If the verdict is `Request changes`: report the findings — do not mark the plan complete.
5. If the verdict is `Approve` or `Approve with comments`: finalize the record
   (T3 — status `Completed` / `Completed with deferrals`, final `Executed at` and
   commit range) and add or update its `docs/plans/index.md`
   `## Execution Records` row; then proceed to Step 4.

### Step 4: Document evolution and close

After final sign-off passes and before marking the plan complete:

1. **Finalize the execution record (T3):** set `Execution status` to
   `Completed` or `Completed with deferrals`, finalize `Commit range` and
   `Executed at`, and add/update the `docs/plans/index.md` `## Execution
   Records` row per
   [`../dh-planning/references/execution-record.md`](../dh-planning/references/execution-record.md).

2. **Generate documentation (all projects):** Invoke the `dh-create-documentation` skill to update project docs and create `docs/evolution/<date>-<slug>.md` (evolution note) + `docs/evolution/observations/<date>-<hhmm>-<slug>.md` (observation note), following its Custom Directives. Link the finalized execution record (T4).

3. **Version bump (software projects only):** Invoke the `dh-semver` skill to determine the correct version bump from commit history, generate a changelog, and create a git tag. **Backfill:** after `dh-semver` determines the version/tag, update the evolution note's `version` and the index `Plan/Release` entry with the new version/tag.

4. **Mark plan complete** in `./docs/plans/index.md`:
   - Locate the row for `<plan-slug>` and update the Status to `Completed` and Updated timestamp columns. If the slug is not found, append a new row.
   - Set the plan status to `Completed`.

5. Report the plan completion with a summary:
   - Total sub-tasks completed
   - Final review verdict
   - Any deferred P2/P3 findings
   - Documentation generated (yes/no — details)
   - Version bump (if applicable)
   - Evolution & observation notes (paths)
   - Plan ready for merge

## Resume Mode

The execution loop automatically handles interruptions:

- A paused handoff takes precedence over status-based resume: run `dh-resume-plan` first. If the handoff is absent or already `resumed`, continue with the phase-aware priority in Step 1.
- Step 2.1 marks each dispatched sub-task as `In Progress` before delegating. If interrupted, the next invocation reads the plan and reconciles **all** `In Progress` tasks and their worktrees/branches.
- Resume from Step 1 priority 2: build the active-task set, revalidate completed-but-unreviewed work, and hand it to the scheduler without duplicate dispatch.
- If interruption occurs after review but before the `Completed` mark, the sub-task remains `In Progress` on resume — re-run the review to verify before marking Complete.

## Error Handling

- **Paused handoff present:** do not execute around it — redirect to `dh-resume-plan` or get explicit confirmation to bypass.
- **Sub-task execution fails** (validation keeps failing): `dh-execute-plan-task` stops after 3 validation attempts and reports the failure. Do not proceed to the next sub-task — the blocked sub-task blocks its phase (loop rule 2.4: never mark the phase `Completed` around a blocker).
- **Missing or invalid `Delegated to agent`:** stop before any delegation and report the sub-task; the plan must be fixed rather than executed under a guessed owner.
- **Review produces blocking findings**: Stop the execution loop. Recommend fixing the findings (using the `address-review` pattern) and re-running `dh-execute-plan`.
- **Final review fails**: Report the verdict — do not mark the plan complete until findings are addressed.

## Loop Integration (bundled)

This copy is bundled in the plugin; the loop below is the harness runtime
contract (full text in repo-root AGENTS.md). Plan execution follows it in
order — do not skip steps and never silently continue past a blocker:

1. `dh-planning` (use `dh-domain-check` while planning)
2. `dh-execute-plan`
   2.1 `dh-execute-plan-task` (delegate code implementation through the `dh-coding` skill)
   2.2 `dh-simplify`
   2.3 `dh-review` + `dh-code-review`
   2.4 IF hard blockers → stop and ask guidance; otherwise keep the `dh-execute-plan-task` loop
3. `dh-preflight` + `dh-artifact-check`
4. `dh-final-review`
5. `dh-create-documentation` (also writes the evolution and observation notes)

**Step 2.4 halts automation.** When `dh-execute-plan-task` (or any loop step)
hits a hard blocker — repeated validation failures (3 consecutive strikes),
unresolved P0/P1 review findings, or missing preconditions that cannot be
worked around — the loop STOPS: report the blocker and ask the user for
guidance. Never silently continue, never skip the blocked step, and never mark
sub-tasks Complete around a blocker. The rule applies at phase boundaries
too: a blocked sub-task blocks its phase — do not mark the phase `Completed`
around a blocker. Before stopping for a hard blocker or ending the session,
run `dh-pause-plan` to preserve the phase/sub-task, git state, decisions,
blockers, and next steps in `handoff.md`; resume later with `dh-resume-plan`.

## References

- [`references/parallel-scheduler.md`](references/parallel-scheduler.md): authoritative parallel scheduler contract (readiness, worker mode, isolation, failure drain).
- Fast variant: `dh-execute-plan-fast` executes from `plan_fast.md` with no per-task gates and defers critical verification to plan end; `plan.md` stays the scope truth.
- [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md): discovery, ranking, recording, and re-validation protocol for every delegated role.
- `dh-execute-plan-task` skill: executes a single sub-task.
- `dh-review` skill: verifies a single sub-task result.
- `dh-final-review` skill: produces plan-level sign-off.
- `dh-create-documentation` skill: updates docs and writes the evolution/observation notes after plan completion (all projects).

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
