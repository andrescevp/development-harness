---
name: final-review
description: >
  Use this skill when performing final plan-level sign-off review — verify all
  sub-tasks are Completed, review the full diff against task.md requirements
  (falling back to plan.md if task.md is missing), delegate in-depth review to
  @final-reviewer, run artifact-check and preflight for release readiness plus
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

Produce a comprehensive final sign-off review for a completed plan. Verify all sub-tasks are done, review the full diff against `task.md` requirements, delegate in-depth review to `@final-reviewer`, and issue a binding verdict.

## Core Rules

- Read `./docs/plans/<plan-slug>/task.md` as the source of truth for requirements.
- Read `./docs/plans/<plan-slug>/plan.md` to verify sub-task completion.
- If any sub-task is not `Completed`, stop and report which tasks remain — do not proceed to full review.
- Perform full-diff review against the entire scope, not just individual sub-tasks.
- Delegate in-depth code review to `@final-reviewer` agent (which uses `code-review` skill).
- Write the final report to `./docs/plans/<plan-slug>/tasks/review.md`.
- Use severity levels: P0 (blocking), P1 (high), P2 (medium), P3 (low).
- Do not modify any implementation files — this skill is review-only.
- If task.md does not exist, use plan.md's requirements snapshot as the fallback requirements source.
- **For software projects:** run `artifact-check` and `preflight` for release readiness validation, and recommend a `semver` version bump in the final report.

## Workflow

### Step 1: Verify plan completion

Read `./docs/plans/<plan-slug>/plan.md` and check every sub-task status:

- All sub-tasks must be `Completed`. If any are `Pending` or `In Progress`, list them and stop — do not proceed.
- If the plan has no sub-tasks at all, report that the plan is empty and stop.

### Step 2: Read the requirements

Read `./docs/plans/<plan-slug>/task.md` and extract:

- All requirements with their IDs (R1, R2, ...)
- Acceptance criteria (AC1, AC2, ...)
- Scope boundaries (in-scope and out-of-scope items)
- Constraints and edge cases

If task.md does not exist, fall back to the Requirements Snapshot section in plan.md.

### Step 3: Plan-level completion scan

Generate the full diff (`git diff main...HEAD` or `git diff $(git merge-base main HEAD)`) and perform a lightweight scan — do **not** deeply review code here. Check only:

- Are all files listed in each sub-task present?
- Are there any missing deliverables (empty files, stubs where real implementation was expected)?
- Are there cross-sub-task integration gaps (e.g., Sub-Task 2 expects a file Sub-Task 3 was supposed to create)?
- Are there obvious scope violations (out-of-scope items implemented)?

### Step 4: Delegate in-depth review

Ask `@final-reviewer` to perform the comprehensive final review using the `code-review` skill — this is where requirements mapping, AC verification, and code-quality checks happen. Provide:

- The full requirements from task.md
- The plan's acceptance criteria
- The full diff context

The `@final-reviewer` agent writes its findings to `./docs/plans/<plan-slug>/tasks/review.md` and returns a verdict.

After `@final-reviewer` completes, read its findings from `./docs/plans/<plan-slug>/tasks/review.md`.

### Step 4a: Release readiness check (software projects only)

**For software projects only** — before producing the final verdict:

1. Run the `artifact-check` skill to validate that production builds compile and deployment scripts pass.
2. Run the `preflight` skill to execute the full test suite, linters, and static analysis as a formal release gate.
3. If either check fails with P0/P1 findings, mark the corresponding requirement as FAIL in the final report.
4. Determine the appropriate `semver` version bump based on the plan scope (major for breaking changes, minor for features, patch for fixes).
5. **For non-software projects:** skip this entire step.

### Step 5: Produce final verdict

Consolidate your own full-scope findings (Steps 1–3), the release readiness results (Step 4a), and the `@final-reviewer`'s findings into a single final report:

```markdown
# Final Plan Review: [Plan title]

**Plan slug:** [plan-slug]
**Review against:** task.md requirements
**Overall risk:** High / Medium / Low
**Verdict:** Approve / Approve with comments / Request changes

## Plan Completion Status

| Sub-task | Status | Notes |
|---|---|---|
| [Sub-task 1] | Completed | [Brief note] |

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

- `artifact-check` build validation: [pass/fail — details]
- `preflight` test/lint gate: [pass/fail — details]
- Recommended `semver` bump: [major/minor/patch]
- Changelog generated: [yes/no]

## Sign-off Verdict

**Verdict:** [Approve / Approve with comments / Request changes]
**Recommendation:** [Merge / Fix P0/P1 findings and re-review / Rejected]
```

### Step 6: Return verdict

Return the sign-off verdict to the caller. If P0/P1 findings exist, recommend fixes before merge. If all clear, confirm plan readiness.

## References

- `final-review.md` command: `~/.agents/commands/final-review.md` — the final review pattern this skill formalizes.
- `code-review` skill: `~/.agents/skills/code-review/SKILL.md` — the in-depth review methodology used by `@final-reviewer`.
- `artifact-check` skill: `~/.agents/skills/artifact-check/SKILL.md` — build validation for release readiness (software projects only).
- `preflight` skill: `~/.agents/skills/preflight/SKILL.md` — full test/lint gate for release readiness (software projects only).
- `semver` skill: `~/.agents/skills/semver/SKILL.md` — version bump recommendation (software projects only).
- `@final-reviewer` agent: `~/.agents/agents/final-reviewer.md` — the agent that performs deep code review with a premium model.
