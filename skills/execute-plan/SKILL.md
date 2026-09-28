---
name: execute-plan
description: >
  Use this skill when orchestrating the full plan-driven development lifecycle
  — read plan.md, iterate through sub-tasks in order delegating execution to
  execute-plan-task, verification to review, and final sign-off to final-review,
  handling mid-plan interruptions by resuming from the In Progress sub-task,
  then updating plan.md and index.md on completion. On completion, run evolve
  and state-sync for all projects, plus create-documentation and semver for
  software projects. Use when the user says 'execute plan', 'run the plan',
  'complete the plan', or 'finish all tasks' — not for single sub-task work
  (use execute-plan-task) or plans still in development.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Orchestrate the complete execution of a plan from start to finish. Iterate through all sub-tasks, delegate execution and review, handle interruptions, and produce a final sign-off.

## Core Rules

- Create a feature branch per plan execution
  - Check you are in main branch and create the feature branch.
  - If not in feature branch, ask user permission to continue before any change.
  - if working in monorepos with git submodules create a branch per submodule along with the branch of the main repository to align and trace commints between repositories.
- Read `./docs/plans/<plan-slug>/plan.md` to identify sub-tasks and their statuses.
- If the plan file does not exist, stop and report — suggest running the `planning` skill first.
- Do not re-execute sub-tasks already marked `Completed`.
- If a sub-task is marked `In Progress`, resume from it (don't restart from the beginning).
- After each sub-task execution, run the `review` skill before proceeding to the next.
- If a review produces P0/P1 findings, stop and report — do not continue to the next sub-task.
- After the final sub-task, run the `final-review` skill for sign-off.
- Update `./docs/plans/index.md` when the plan is fully complete.
- **Project type awareness is delegated to `execute-plan-task`.** The orchestrator does not re-detect project type — it relies on `execute-plan-task` to handle agent selection based on whether the project is software or non-software. Do not hardcode agent choices (e.g., `@software-engineer`) in the orchestration loop that would conflict with this.
- **After plan completion (all projects):** invokes `evolve` and `state-sync` to capture what was learned and update documentation. This ensures knowledge persists beyond the active session.
- **After plan completion (software projects only):** invokes `create-documentation` for generating/updating project docs, and `semver` for determining the next version bump.

## Workflow

### Step 1: Read plan and assess state

Read `./docs/plans/<plan-slug>/plan.md` and determine the starting point using this ordered priority:

1. If all sub-tasks are `Completed`, run `final-review` skill only and proceed to Step 3. Skip the execution loop.
2. If one or more sub-tasks are `In Progress`, start from the first `In Progress` sub-task (resume mode).
3. If all sub-tasks are `Pending`, start from the first sub-task.
4. If the plan has no sub-tasks, or every sub-task has an unrecognized status, report the ambiguous state and stop.

### Step 2: Execution loop

For each sub-task starting from the determined starting point:

0. **Mark In Progress**: Ensure the sub-task is marked `In Progress` in plan.md. If it is already `In Progress` (resume), leave the state. If it is `Pending`, mark it `In Progress` now. This ensures resume works if interrupted.

1. **Execute**: Follow the `execute-plan-task` skill to implement this sub-task. Since this is called from the orchestrator, `execute-plan-task` skips its internal review and completion steps (per its orchestration guard).

2. **Verify**: Run the `review` skill to verify the sub-task result against its acceptance criteria and produce findings in `./docs/plans/<plan-slug>/tasks/review.md`.

3. **Check findings**: Read the review output:
   - If P0/P1 findings exist: stop the execution loop and report the blocking issues. Do not mark this sub-task `Completed`. Recommend fixing findings and re-running.
   - If no P0/P1 findings: mark the sub-task `Completed` in plan.md.

4. **Repeat**: Continue to the next sub-task until all are completed.

### Step 3: Final sign-off

After all sub-tasks are completed and verified:

1. Run the `final-review` skill for the comprehensive final plan review.
2. Read the final review verdict from `./docs/plans/<plan-slug>/tasks/review.md`.
3. If the verdict is `Request changes`: report the findings — do not mark the plan complete.
4. If the verdict is `Approve` or `Approve with comments`: proceed to Step 4.

### Step 4: Capture learnings and close

After final sign-off passes and before marking the plan complete:

1. **Capture learnings (all projects):** Invoke the `evolve` skill to capture session observations — what patterns emerged, what worked, what didn't, what decisions were made. This feeds into the agent learning pipeline.

2. **Sync project state (all projects):** Invoke the `state-sync` skill to update knowledge management systems and relational documentation to reflect architecture changes, new modules, or configuration changes made during this plan.

3. **Generate documentation (software projects only):** Invoke the `create-documentation` skill to generate or update API references, architecture overviews, READMEs, or other technical docs based on the sub-task implementation.

4. **Version bump (software projects only):** Invoke the `semver` skill to determine the correct version bump from commit history, generate a changelog, and create a git tag.

5. **Mark plan complete** in `./docs/plans/index.md`:
   - Locate the row for `<plan-slug>` and update the Status to `Completed` and Updated timestamp columns. If the slug is not found, append a new row.
   - Set the plan status to `Completed`.

6. Report the plan completion with a summary:
   - Total sub-tasks completed
   - Final review verdict
   - Any deferred P2/P3 findings
   - Documentation generated (yes/no — details)
   - Version bump (if applicable)
   - Learnings captured (yes/no)
   - Plan ready for merge

## Resume Mode

The execution loop automatically handles interruptions:

- Step 2.0 explicitly marks the current sub-task as `In Progress` before delegating to `execute-plan-task`. If the tool is interrupted, the next invocation reads plan.md and finds this `In Progress` sub-task.
- Resume from Step 1, which detects the `In Progress` state (priority 2) and continues the loop from that sub-task.
- If interruption occurs after review but before the `Completed` mark, the sub-task remains `In Progress` on resume — re-run the review to verify before marking Complete.

## Error Handling

- **Sub-task execution fails** (validation keeps failing): `execute-plan-task` stops after 3 validation attempts and reports the failure. Do not proceed to the next sub-task.
- **Review produces blocking findings**: Stop the execution loop. Recommend fixing the findings (using the `address-review` pattern) and re-running `execute-plan`.
- **Final review fails**: Report the verdict — do not mark the plan complete until findings are addressed.

## References

- `execute-plan-task` skill: `~/.agents/skills/execute-plan-task/SKILL.md` — executes a single sub-task.
- `review` skill: `~/.agents/skills/review/SKILL.md` — verifies a single sub-task result.
- `final-review` skill: `~/.agents/skills/final-review/SKILL.md` — produces plan-level sign-off.
- `evolve` skill: `~/.agents/skills/evolve/SKILL.md` — captures learnings after plan completion (all project types).
- `state-sync` skill: `~/.agents/skills/state-sync/SKILL.md` — updates knowledge management docs after plan completion (all project types).
- `create-documentation` skill: `~/.agents/skills/create-documentation/SKILL.md` — generates docs after plan completion (software projects only).
- `semver` skill: `~/.agents/skills/semver/SKILL.md` — applies semantic versioning after plan completion (software projects only).
- `plan.md` command: `~/.agents/commands/plan.md` — for creating new plans.
- `next-subtask.md` command: `~/.agents/commands/next-subtask.md` — the single-task execution pattern.
- `address-review.md` command: `~/.agents/commands/address-review.md` — the pattern for addressing and re-reviewing findings.

## Loop Integration (bundled)

The full harness skills loop (1..5) lives in the repo-root `AGENTS.md`. Key
binding rules for this skill:

- **2.1 — `execute-plan-task` → use `coding`:** sub-task implementation is
  delegated through the `coding` skill (test-first TDD; reads project rules
  from `CODE_RULES.md` at the project root), with heavy work via
  `@software-engineer` and validation via `@executor`.
- **2.2 — `simplify`:** after a sub-task passes validation, run the
  `simplify` skill over the changed code (software projects only).
- **2.3 — `review` + `code-review`:** verify the sub-task against
  acceptance criteria (`review`) and review code quality (`code-review`),
  delegating the deep review to `@reviewer`.
- **2.4 — Hard blockers stop the loop:** on 3 consecutive validation failures,
  unresolved P0/P1 review findings, or missing preconditions, STOP, report the
  blocker, and ask the user for guidance — do not silently continue or mark
  sub-tasks Complete around a blocker.
- **Agent names:** delegation references resolve at runtime via the manifest
  mapping in the repo `AGENTS.md` — `@build`/`@senior-engineer` →
  `@software-engineer`, `@senior-architect`/`@plan` →
  `@software-architect`; `@reviewer`, `@final-reviewer`, `@executor`,
  `@explorer` unchanged.
