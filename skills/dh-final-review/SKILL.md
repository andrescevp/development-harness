---
name: dh-final-review
description: >
  Use this skill when performing final plan-level sign-off review — verify all
  sub-tasks are Completed, review the full diff against sdd.md requirements
  (falling back to plan.md if sdd.md is missing), delegate in-depth review to
  @dh-final-reviewer, run artifact-check and preflight for release readiness plus
  a semver bump recommendation on software projects, and produce a binding
  verdict (Approve / Approve with comments / Request changes) written to
  tasks/review.md. Use when the plan is fully implemented and individually
  reviewed, before merge, or when asked to 'final review', 'sign off', or
  'close the plan' — not for per-sub-task reviews (use review) or in-progress
  plans.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, bash
metadata:
  audience: developers
  workflow: development
---

Produce a comprehensive final sign-off review for a completed plan. Verify all sub-tasks are done, review the full diff against `sdd.md` requirements, delegate in-depth review to `@dh-final-reviewer`, and issue a binding verdict.

## Core Rules

- Read `./docs/plans/<plan-slug>/sdd.md` as the source of truth for requirements.
- Read the plan (via `dh_plan_read` when available; fallback: manual read of `./docs/plans/<plan-slug>/plan.md`) to verify sub-task AND phase completion.
- If any sub-task is not `Completed` (and therefore any phase is not `Completed`), stop and report which tasks remain — do not proceed to full review.
- This skill is loop step 4 (`dh-final-review`); the full loop 1–5 lives in repo-root AGENTS.md (pointer only, no duplication).
- Perform full-diff review against the entire scope, not just individual sub-tasks.
- Delegate in-depth code review to `@dh-final-reviewer` agent (which uses `dh-code-review` skill).
- Write the final report to `./docs/plans/<plan-slug>/tasks/review.md`.
- Use severity levels: P0 (blocking), P1 (high), P2 (medium), P3 (low).
- Do not modify any implementation files — this skill is review-only.
- If sdd.md does not exist, use plan.md's requirements snapshot as the fallback requirements source.
- **For software projects:** run `dh-artifact-check` and `dh-preflight` for release readiness validation, and recommend a `semver` version bump in the final report.

## Workflow

### Step 1: Verify plan completion

Read the plan (via `dh_plan_read` when available; fallback: manual read) and check every sub-task AND phase status:

- All sub-tasks must be `Completed` and every phase must be `Completed` (a phase is `Completed` only when all its sub-tasks are). If any sub-task is `Pending` or `In Progress`, list them, note their phase, and stop — do not proceed.
- If the plan has no sub-tasks at all, report that the plan is empty and stop.

### Step 2: Read the requirements

Read `./docs/plans/<plan-slug>/sdd.md` and extract:

- All requirements with their IDs (R1, R2, ...)
- Acceptance criteria (AC1, AC2, ...)
- Scope boundaries (in-scope and out-of-scope items)
- Constraints and edge cases

If sdd.md does not exist, fall back to the Requirements Snapshot section in plan.md.

### Step 3: Plan-level completion scan

Generate the full diff (`git diff main...HEAD` or `git diff $(git merge-base main HEAD)`) and perform a lightweight scan — do **not** deeply review code here. Check only:

- Are all files listed in each sub-task present?
- Are there any missing deliverables (empty files, stubs where real implementation was expected)?
- Are there cross-sub-task integration gaps (e.g., Sub-Task 2 expects a file Sub-Task 3 was supposed to create)?
- **Per-phase completion:** list each `Phase N` with its status and confirm no phase was marked `Completed` with open sub-tasks (blocker rule 2.4: never mark a phase around a blocker).
- Are there obvious scope violations (out-of-scope items implemented)?

### Step 4: Delegate in-depth review

Ask `@dh-final-reviewer` to perform the comprehensive final review using the `dh-code-review` skill — this is where requirements mapping, AC verification, and code-quality checks happen. Provide:

- The full requirements from sdd.md
- The plan's acceptance criteria
- The full diff context

The `@dh-final-reviewer` agent writes its findings to `./docs/plans/<plan-slug>/tasks/review.md` and returns a verdict.

After `@dh-final-reviewer` completes, read its findings from `./docs/plans/<plan-slug>/tasks/review.md`.

### Step 4a: Release readiness check (software projects only)

**For software projects only** — before producing the final verdict:

1. Run the `dh-artifact-check` skill to validate that production builds compile and deployment scripts pass.
2. Run the `dh-preflight` skill to execute the full test suite, linters, and static analysis as a formal release gate.
3. If either check fails with P0/P1 findings, mark the corresponding requirement as FAIL in the final report.
4. Determine the appropriate `semver` version bump based on the plan scope (major for breaking changes, minor for features, patch for fixes).
5. **For non-software projects:** skip this entire step.

### Step 5: Produce final verdict

Consolidate your own full-scope findings (Steps 1–3), the release readiness results (Step 4a), and the `@dh-final-reviewer`'s findings into a single final report:

```markdown
# Final Plan Review: [Plan title]

**Plan slug:** [plan-slug]
**Review against:** sdd.md requirements
**Overall risk:** High / Medium / Low
**Verdict:** Approve / Approve with comments / Request changes

## Plan Completion Status

| Phase | Sub-task | Status | Notes |
|---|---|---|---|
| [Phase 1] | [Sub-task 1.1] | Completed | [Brief note] |

Per-phase completion: [Phase 1: Completed — N/N sub-tasks; Phase 2: Completed — M/M sub-tasks; …]

## Requirements Verification

| Requirement | Status | Evidence |
|---|---|---|
| R1: [description] | PASS/FAIL | [Evidence] |
| AC1: [description] | PASS/FAIL | [Evidence] |

Any requirement marked FAIL must have a corresponding finding below with an appropriate severity level. A FAIL on a core requirement (R1–R5) is P0; a FAIL on an acceptance criterion is P1.

## Findings

### [P0] Blocking
### [P1] High
### [P2] Medium
### [P3] Low

## Integration Assessment

- Cross-sub-task integration issues: [none / list]
- Regression risk across the full scope: [low/medium/high]

## Release Readiness (software projects only)

- `dh-artifact-check` build validation: [pass/fail — details]
- `dh-preflight` test/lint gate: [pass/fail — details]
- Recommended `semver` bump: [major/minor/patch]
- Changelog generated: [yes/no]

## Sign-off Verdict

**Verdict:** [Approve / Approve with comments / Request changes]
**Recommendation:** [Merge / Fix P0/P1 findings and re-review / Rejected]
```

### Step 6: Return verdict

Return the sign-off verdict to the caller. If P0/P1 findings exist, recommend fixes before merge. If all clear, confirm plan readiness.

## References

- `dh-code-review` skill: the in-depth review methodology used by `@dh-final-reviewer`.
- `dh-artifact-check` skill: build validation for release readiness (software projects only).
- `dh-preflight` skill: full test/lint gate for release readiness (software projects only).
- `@dh-final-reviewer` agent: the agent that performs deep code review with a premium model.
