---
name: dh-execute-plan-task
description: >
  Execute a single sub-task from plan.md: select the active one (In Progress phase first), implement (TDD), validate via dh-executor, update status; project-type aware. Use for the next sub-task or continuing work — not orchestration.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Execute one self-contained sub-task from `./docs/plans/<plan-slug>/plan.md`.

## Core Rules

- Read the plan with the `dh_plan_read` tool (`{ slug }` → structured JSON: meta, phases[].title/status, subTasks[].phase/title/status) to find the active sub-task. Fallback when the tool is unavailable: read `./docs/plans/<plan-slug>/plan.md` manually, following the phased template markers (`## Phases` → `### Phase N: <title>` → `#### Sub-Task N.M: <title>` with `- **Status:**` bullets). If the plan does not exist, stop and report that no plan was found — suggest running the `dh-planning` skill first.
- Treat the sub-task entry in plan.md as the full implementation brief.
- **ALL sub-task execution is delegated to `@senior-engineer`** (the harness's task executor; bundled/registered in this plugin as `software-engineer` — same agent, alias per AGENTS.md). There is no complexity- or type-based builder split: simple, standard, complex, and non-software work ALL go to `@senior-engineer`.
- **Detect project type** before the post-steps: it determines whether `dh-domain-check`, `dh-simplify`, and `dh-create-documentation` run (software projects only) — it does NOT change who implements.
- For **software projects**: run `dh-domain-check` before complex implementation, `dh-simplify` after validation, and `dh-create-documentation` for new modules/APIs.
- For **non-software projects**: skip the `dh-simplify`, `dh-domain-check`, and `dh-create-documentation` steps entirely; implementation still goes to `@senior-engineer`.
- Delegate validation to `@dh-executor` for tests, linters, and builds.
- Delegate review to `@dh-reviewer` for code quality and acceptance criteria checks.
- Do not modify files outside the sub-task scope.
- Update the sub-task status only after review passes — via `dh_plan_update_status` (`target: "subtask"`, status `Completed`); fallback: manual plan.md edit per the marker rules.
- If the sub-task has dependencies on earlier sub-tasks, verify they are Completed before starting.

## Project Type Detection

Check the project root for software marker files to determine project type. This must be done before any agent delegation.

**Software project markers** (any of these files present in project root):
`package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, `CMakeLists.txt`, `setup.py`, `setup.cfg`, `Gemfile`, `project.clj`, `deps.edn`, `mix.exs`, `pubspec.yaml`, `Build.scala`, `build.gradle`, `*.csproj`, `*.sln`

**Detection logic:**
1. Run `ls <project-root>/` and check for any of the marker files above.
2. If a marker file is found → **software project** (run `dh-domain-check` before complex implementation, `dh-simplify` after validation, `dh-create-documentation` for new modules/APIs).
3. If no marker files found → **non-software project** (skip `dh-domain-check`, `dh-simplify`, and `dh-create-documentation`).
4. If uncertain (e.g., a `Makefile` with no other code), check for source code directories (`src/`, `lib/`, `app/`) as secondary indicators.

Implementation delegation is IDENTICAL for both types: **every sub-task is
implemented by `@senior-engineer`** (bundled as `software-engineer`).

> **Why this matters:** Non-software projects (docs repos, config repos, design assets) don't benefit from architecture/engineering agents or code-level simplification. Using the wrong agent type wastes context and produces irrelevant findings.

## Workflow

### Step 1: Select the active sub-task

Read the plan with the `dh_plan_read` tool (`{ slug }`) and find exactly one sub-task using this phase-aware order. Fallback when the tool is unavailable: read `./docs/plans/<plan-slug>/plan.md` manually per the marker rules:

1. Pick the FIRST phase marked `In Progress`; within it, pick its FIRST sub-task marked `In Progress` or `Pending`. If that sub-task is already `In Progress` (set by the orchestrator), skip marking and proceed directly to implementation.
2. If no phase is `In Progress`, take the first sub-task of the first `Pending` phase and mark it `In Progress` via `dh_plan_update_status` (`target: "subtask"`, status `In Progress`) — the phase follows the lifecycle (it becomes `In Progress` when its first sub-task starts). Fallback: manual plan.md edit per the marker rules.
3. If multiple phases are `In Progress`, or multiple sub-tasks within the active phase are `In Progress`, stop and ask which to continue.
4. If no `In Progress` or `Pending` sub-tasks remain, report that the plan has no remaining work.

### Step 2: Implement the sub-task

Follow the sub-task's instructions, in-scope list, and implementation suggestions. **Every sub-task is delegated to `@senior-engineer`** (bundled as `software-engineer`):

- Delegate the FULL sub-task brief to `@senior-engineer` — for complex work (multi-file, architectural decisions, new modules), run the `dh-domain-check` skill first and include its findings in the delegation.
- The implementation follows the `dh-coding` skill through `@senior-engineer` (test-first TDD; `CODE_RULES.md` at project root when present).
- **TDD**: the failing test is written first, then the minimal change to make it pass — performed inside the `@senior-engineer` implementation pass.
- Do NOT implement sub-task work directly and do NOT seek another builder: `@senior-engineer` is the single task executor in this harness.

**General rules:**
- Stay within the sub-task's in-scope boundaries. Do not widen scope.
- Never mark a phase `Completed` yourself while any sub-task in it is still open (phase coordination belongs to the orchestrator or the gated tool).

### Step 3: Run validation

Ask `@dh-executor` to run the smallest relevant validation for the changed code:

- Run tests related to the changed files.
- Run linters and static analysis.
- Fix any failures before proceeding. If validation fails 3 consecutive times, stop and report the failure with full error output — do not proceed to review.

### Step 3a: Simplify code (software projects only)

**For software projects only** — after validation passes and before requesting review:

Run the `dh-simplify` skill to review all changed code for reuse opportunities, quality issues, and efficiency improvements. This ensures code is clean before it reaches review.

1. Invoke the `dh-simplify` skill with the full diff context from the sub-task implementation.
2. Wait for all three simplify agents (code reuse, quality, efficiency) to report findings.
3. Fix all P0/P1 issues found by simplify. For P2/P3 findings, use judgment — fix if meaningful, defer if low impact.
4. If fixes were made, re-run validation via `@dh-executor` to ensure nothing broke.
5. **For non-software projects:** skip this entire step — the `dh-simplify` skill is code-focused and would produce irrelevant findings.

### Step 3b: Generate documentation (software projects only)

**For software projects only** — after `dh-simplify` and before requesting review:

Run the `dh-create-documentation` skill to generate or update API references, module docs, architecture overviews, or any documentation relevant to the new or changed code.

1. If the sub-task introduces new modules, APIs, public interfaces, or configuration schemas, invoke `dh-create-documentation` to produce the corresponding docs.
2. If the sub-task modifies existing documented interfaces, update the related documentation rather than creating from scratch.
3. If the sub-task has no public-facing changes (e.g., internal refactors, bug fixes), skip this step.
4. **For non-software projects:** skip this entire step — documentation needs for config/docs repos are handled differently.

### Step 4: Request review

(Orchestration note) When invoked from `dh-execute-plan` orchestrator, skip this step — the orchestrator runs the `dh-review` skill after this sub-task completes. When invoked standalone, ask `@dh-reviewer` to review the changes against the active sub-task's acceptance criteria, scope boundaries, and done-when conditions. The reviewer writes findings to `./docs/plans/<plan-slug>/tasks/review.md`.

### Step 5: Address review feedback

Read the review and address findings:

- For P0/P1 (blocking/high): fix immediately, then proceed to Step 5a.
- For P2/P3: use judgment — fix if meaningful, defer if low impact.
- After fixes, ask `@dh-executor` to re-run the relevant validation.
- Update `./docs/plans/<plan-slug>/tasks/review.md` marking each finding as `Addressed` or `Not Addressed` with a brief rationale.
- If re-validation fails 2 additional times after initial fixes, stop and report the failure with full error output — do not proceed.

### Step 5a: Confirm review resolution

- If the reviewer approved (no outstanding P0/P1 findings), proceed to Step 6.
- If P0/P1 findings remain unaddressed, fix them and request a re-review from `@dh-reviewer` (loop back to Step 4).
- If only P2/P3 findings remain and you have addressed or explicitly deferred them with rationale, proceed to Step 6.

### Step 6: Update plan status

1. (Orchestration note) When invoked from `dh-execute-plan` orchestrator, skip both status updates — the orchestrator marks Complete after its external review passes and handles sequencing. When invoked standalone, mark the current sub-task as `Completed` via `dh_plan_update_status` (`target: "subtask"`, status `Completed`); fallback: manual plan.md edit per the marker rules.
2. **Phase coordination:** after the sub-task is `Completed`, check whether ALL sub-tasks of its phase are now `Completed`. If so, tell the orchestrator (`dh-execute-plan`) that the phase is ready to close; when running standalone, close it via `dh_plan_update_status` (`target: "phase"`, status `Completed`). Never mark a phase `Completed` yourself while any sub-task in it is still open.
3. When standalone: if a next sub-task exists and is `Pending`, mark it as `In Progress`.
4. When standalone: update `./docs/plans/index.md` with the latest status if this was the final sub-task.

## Execution Delegation Guide

**Single executor policy:** every sub-task — software, non-software, simple,
standard, complex — is implemented by `@senior-engineer` (bundled as
`software-engineer`).

| Work | Delegate to | Post-steps |
|---|---|---|
| Software (complex, architectural) | `@senior-engineer` | `dh-domain-check` first, then `dh-simplify` + `dh-create-documentation` |
| Software (other) | `@senior-engineer` | `dh-simplify` after validation |
| Non-software | `@senior-engineer` | none (skip `dh-simplify`/`dh-domain-check`/`dh-create-documentation`) |

Validation always runs through `@dh-executor`; review through `@dh-reviewer`.

## Loop Integration (bundled)

This copy is bundled in the plugin; the harness runtime contract (full loop
1–5) lives in repo-root AGENTS.md and in `dh-execute-plan`'s Loop Integration
section. Executing a sub-task sits inside loop step 2:

- 2.1 delegate code implementation through the `dh-coding` skill (software
  work); run `dh-domain-check` before complex implementation.
- 2.2 run `dh-simplify` after validation (software projects only).
- 2.3 `dh-review` + `dh-code-review` verify the sub-task before it is marked `Completed`.
- 2.4 **Hard blockers halt automation.** Repeated validation failures (3
  consecutive strikes), unresolved P0/P1 review findings, or missing
  preconditions that cannot be worked around → STOP: report the blocker and
  ask the user for guidance. Never silently continue, never skip the blocked
  step, and never mark sub-tasks `Completed` around a blocker. A blocked
  sub-task also blocks its phase — do not mark the phase `Completed` around a
  blocker.

## References

- `dh-domain-check` skill: validates architecture against DDD bounded contexts and SOLID principles before complex implementation (software projects only).
- `dh-simplify` skill: reviews changed code for reuse, quality, and efficiency after validation (software projects only).
- `dh-create-documentation` skill: generates docs for new modules, APIs, and interfaces after simplify (software projects only).

## Doc search

- **Documentation management:** delegate create / update / delete / retrieve
  of generated documents (excluding docs/plans) to `@dh-documentor` — the
  main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"`
or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
Convention: AGENTS.md → Generated documentation search.
