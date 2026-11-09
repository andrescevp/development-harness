---
name: dh-review
description: >
  Verify a plan sub-task against acceptance criteria, scope, done-when; review diff, validation, regression risk; structured verdict to tasks/review.md. Plan Alignment Mode (fast execution) is a separate mode: no sub-task selection, no diff review, no code review — it compares plan.md with plan_fast.md and writes tasks/review-fast.md (pre-execution) or tasks/review-fast-final.md (plan-end). Use after implementation, to review/verify the sub-task, or to check fast-plan alignment.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, bash
metadata:
  audience: developers
  workflow: development
---

Verify that a single sub-task implementation meets its plan-defined acceptance criteria, stays within scope, and passes code quality review. Write the findings to `./docs/plans/<plan-slug>/tasks/review.md`; Plan Alignment Mode writes to the caller-specified fast report instead (see below).

## Core Rules

- Read the plan to find the active sub-task and its criteria — via `dh_plan_read` (`{ slug }`) when available, else manual read of `./docs/plans/<plan-slug>/plan.md` following the phased marker rules. If the plan does not exist, stop and report that no plan was found. The plan tools are exposed by the project-scope `dh` MCP server; under Code Mode they are called as `tools.dh.<tool>`, and `dh_<tool>` is the tool's normalized name (permission actions match `dh_*`).
- This skill is loop step 2.3 (`dh-review` + `dh-code-review`); the full loop 1–5 lives in repo-root AGENTS.md (pointer only, no duplication).
- Do not review code outside the sub-task scope.
- **Resolve the review agent (standard review only):** read `## Agent Selection` in `plan.md` and use its Review row. If the section or row is absent or stale, run the selection protocol in [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md), record the row, and continue. A selected reviewer that is unavailable and has no capability fallback stops the run — never substitute silently.
- Delegate code quality checks to the selected review agent — do not duplicate the `dh-code-review` skill.
- Write all findings to `./docs/plans/<plan-slug>/tasks/review.md`. **Exception:** Plan Alignment Mode writes to the caller-specified path — default `tasks/review-fast.md` (pre-execution) or `tasks/review-fast-final.md` (plan-end).
- Use severity levels from the `dh-code-review` skill: P0 (blocking), P1 (high), P2 (medium), P3 (low).
- If no sub-task is In Progress, review the most recently Completed sub-task and state that assumption.
- **Graph-assisted impact (standard review only):** when the project graph is indexed, use the `dh-code-query` skill on changed symbols — `callers`/`callees` for untested call paths, `importers` for boundary impact, `implementors`/`overrides` for contract changes, and `tests-reaching` for coverage. Confirm each row in the diff or source; do not raise a finding from graph output alone. Plan Alignment Mode never uses this.

## Plan Alignment Mode (fast execution)

A **separate mode**, not a variant of the sub-task review. Trigger it when the
caller asks to compare `plan.md` with `plan_fast.md` for fast execution.

**Skip Workflow Steps 1–7 entirely.** In this mode there is no sub-task
selection, no diff review, no review-agent delegation, no `dh-code-review`, and
no `dh-domain-check`. This mode performs **no code review** and writes no
standard review report.

**Input:** `phase: pre-execution | plan-end`, plus the report path.

- `pre-execution` — validate a newly created or resumed mirror.
  `plan_fast.md` may be ahead of `plan.md` **only in statuses**; `plan.md` ahead
  of the mirror is a finding.
- `plan-end` — validate the final mirror. Phase/sub-task statuses must match
  **exactly** in both files.

Read `./docs/plans/<plan-slug>/plan.md` and
`./docs/plans/<plan-slug>/plan_fast.md` (`dh_plan_read`; manual fallback).

**Allowed differences** (never findings):

- `plan_fast.md` intentionally omits `## Objective`, `## Requirements Snapshot`,
  `## Scope`, `## Assumptions and Constraints`,
  `## Risks and Areas Requiring Care`, `## Core concepts`, `## Visual Context`,
  `## Agent Selection`, and `## Open Questions`. Compare the `## Phases` region
  and sub-task fields against `plan.md`, and use `plan.md` for
  requirements/scope checks. Do **not** flag those omitted top-level sections
  as missing.
- The fast sections `## Fast Execution Policy`, `## Alignment Contract`, and
  `## Final Verification`.
- Status progression (within the phase rules above).

**Compare:** phase/sub-task coverage, IDs, titles, and order; requirements
mapping (`Related Requirements`); acceptance criteria; done-when; scope
boundaries. Missing, extra, reordered, or renamed phases/sub-tasks, altered
requirements/criteria, or any scope change → **P0/P1**.

**Status findings**

- `pre-execution`: mismatch → P2; `plan.md` ahead of the mirror → P1.
- `plan-end`: any mismatch → P1 (the close is blocked until both are identical).

**Report:** always write to the caller-specified path; default
`./docs/plans/<plan-slug>/tasks/review-fast.md` for `pre-execution` and
`./docs/plans/<plan-slug>/tasks/review-fast-final.md` for `plan-end` (a distinct
file from the pre-execution report). Never overwrite `tasks/review.md` or the
pre-execution report. Keep the standard verdict shape
(`**Verdict:** Approve / Approve with comments / Request changes`).

**Verdict:** `Request changes` when any P0/P1 remains; `Approve with comments`
for P2/P3 only; `Approve` when fully aligned. Misalignment is fixed in
`plan_fast.md`; this mode never authorizes editing `plan.md` scope.

## Review Dimensions

Review the implementation against these dimensions, in order:

### 1. Acceptance criteria fulfillment
- Does the implementation meet every acceptance criterion from the sub-task?
- Are there any missing features or partial implementations?
- Are the done-when conditions satisfied?

### 2. Scope compliance
- Does the implementation stay within the sub-task's in-scope boundaries?
- Has it introduced work explicitly listed as out of scope?
- Have unrelated files been modified?

### 3. Validation and testing
- Does the implementation include appropriate tests (unit, integration) as suggested?
- Can the validation commands from the sub-task be run successfully?
- Are edge cases from the sub-task's cautionary points handled?
- use MCP Chrome tools if possible to validate the work via web and include the results in the review report.

### 4. Regression risk
- Could the changes break existing functionality outside the sub-task scope?
- Are there API, config, or interface changes that affect other parts of the system?

### 5. Architecture and domain integrity (software projects only)
- For cross-module or architectural changes: delegate to `dh-domain-check` skill to validate the implementation still respects DDD bounded contexts and SOLID principles.
- Are the module boundaries, dependencies, and interfaces consistent with the architecture defined during planning?

### 6. Code quality (delegated)
- Delegate to the plan's selected review agent for detailed code quality review using the `dh-code-review` skill.
- Incorporate the reviewer's findings into the final report.

## Workflow

### Step 1: Read plan context

Read the plan (via `dh_plan_read` when available; fallback: manual read of `./docs/plans/<plan-slug>/plan.md`) and extract:
- The active sub-task: the one marked `In Progress` within the first `In Progress` phase. If none is In Progress, use the most recently Completed sub-task and explicitly state that assumption in the review report.
- The sub-task's phase (`Phase N`), which the review report may note to support the orchestrator's phase-completion tracking
- Its acceptance criteria, done-when conditions, and scope boundaries
- Any testing suggestions or validation commands

### Step 2: Review diff against criteria

Examine the implementation changes (via `git diff` against base branch) and evaluate against the first four review dimensions (acceptance criteria, scope, validation, regression).

### Step 3: Delegate architecture validation (software projects only)

If the sub-task involves cross-module changes, architectural decisions, or interface definitions that affect bounded contexts, delegate to `dh-domain-check` skill to validate the implementation against DDD principles and SOLID compliance. Incorporate findings into the review report.

### Step 4: Delegate code quality review

Ask the plan's selected review agent to perform a detailed code review using the `dh-code-review` skill. Provide the active sub-task's context and acceptance criteria for awareness. Instruct the reviewer to focus on code-level correctness, security, and robustness. The plan-level acceptance criteria verification (does the feature exist and behave as specified?) is handled directly in Steps 1-2 and should not be duplicated.

### Step 5: Consolidate findings

Combine your plan-level review (steps 1–2), the `dh-domain-check` architecture findings (step 3), and the selected review agent's code quality findings (step 4) into a single structured report.

### Step 6: Write review report

Write findings to `./docs/plans/<plan-slug>/tasks/review.md` using this format:

```markdown
# Sub-Task Review: [Sub-task title]

**Reviewed against:** Sub-task from plan.md  
**Overall risk:** High / Medium / Low  
**Verdict:** Approve / Approve with comments / Request changes

## Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| [AC 1 description] | PASS/FAIL | [Evidence] |

## Findings

### [P0] Blocking
### [P1] High
### [P2] Medium
### [P3] Low

## Validation Results

- Tests present: [yes/no — details]
- Validation commands: [pass/fail — evidence]
- Edge cases from sub-task: [handled/missed — details]

## Regression Risk Assessment

- Breaking changes detected: [none / list with impact]
- Interface/config changes affecting other components: [none / list]

## Scope Compliance

- In scope: [verified]
- Out of scope detected: [none / list]

## Suggested Next Steps

- [ ] Action items from findings
```

### Step 7: Return verdict

Return the review verdict to the caller. If P0/P1 findings exist, recommend fixes before proceeding.

## References

- [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md): review-role resolution and re-validation.
- `dh-code-review` skill: the detailed code review methodology delegated to the selected review agent.
- `dh-domain-check` skill: architecture validation for cross-module changes (software projects only).

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
