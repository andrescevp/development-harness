# plan_fast_skip_checks.md — Skipped-Check Ledger

Contract for `docs/plans/<slug>/plan_fast_skip_checks.md`, seeded by
`dh_plan_fast_create` and appended by `dh_plan_fast_skip_check` (or the manual
fallback below). It is **evidence** of every standard check the fast path did
not run; it never replaces a check or its report. Never delete rows.

## Path and roles

- Path: `docs/plans/<slug>/plan_fast_skip_checks.md` — same directory as
  `plan.md` and `plan_fast.md`.
- One ledger per plan; **append-only** for the whole plan lifecycle.
- Rows record skipped, deferred, or not-applicable checks only — never actual
  findings (those live in the relevant review/report file).
- No secrets, credentials, tokens, or full diffs.

## Frontmatter

```yaml
---
title: "<Plan title> — Fast Skipped Checks"
slug: <plan-slug>
description: Append-only ledger of standard checks skipped or deferred in fast mode.
tags: [plan, fast, checks]
project: <project>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

- `slug` matches the plan directory and the other two plan files.
- `created` is set when seeded; `updated` is refreshed on every append.
- `tags` is the fixed literal `[plan, fast, checks]`.

## Body

```markdown
# Fast Execution — Skipped Checks

Append-only evidence of standard checks the fast path skipped, deferred, or
found not applicable.

| Timestamp | Check | Scope | Reason | Disposition |
|---|---|---|---|---|
```

Column rules:

- **Timestamp:** ISO-8601 UTC (`2026-02-10T09:00:00Z`). One timestamp per call.
- **Check:** exact skill/tool name — `dh-review`, `dh-simplify`,
  `dh-code-review`, `dh-domain-check`, `dh-preflight`, `dh-artifact-check`.
- **Scope:** `Plan`, `End gates`, or `Sub-Task N.M` (for example `Sub-Task 2.1`).
- **Reason:** short factual cause; escape `|` as `\|` and newlines as spaces.
- **Disposition:** one of `deferred to end-of-plan`, `conditional at plan end`,
  `end-of-plan`, `not applicable (non-software)`, `not applicable`,
  `run: PASS`, `run: FAIL`.

## Seed rows (`scope: Plan`)

`dh_plan_fast_create` seeds the six standard checks. Each seed row uses the
creation timestamp, `scope: Plan`, reason
`fast mode defers per-task verification`, and the disposition below:

| Check | Disposition |
|---|---|
| `dh-review` | `deferred to end-of-plan` |
| `dh-simplify` | `deferred to end-of-plan` |
| `dh-code-review` | `deferred to end-of-plan` |
| `dh-domain-check` | `conditional at plan end` |
| `dh-preflight` | `deferred to end-of-plan` |
| `dh-artifact-check` | `deferred to end-of-plan` |

Use reason `fast mode defers per-task verification` for all six seed rows.
Manual creation must reproduce exactly these six rows.

## Per-task rows (`scope: Sub-Task N.M`)

After `dh-execute-plan-task-fast` selects a sub-task, it appends one row per
standard check in a single `dh_plan_fast_skip_check` call with
`checks: [...]`, `scope: "Sub-Task N.M"`, and
`reason: "fast mode defers per-task verification"`.

- Software projects: disposition `end-of-plan` for all six checks.
- Non-software projects: code-specific checks (`dh-simplify`,
  `dh-code-review`, `dh-domain-check`) use `not applicable (non-software)`;
  the rest use `end-of-plan`.

## End rows

When each deferred gate runs or is skipped, append an outcome row from the
orchestrator (`scope: End gates` or `Plan`):

- `run: PASS` or `run: FAIL` with the report path in the Reason column.
- `not applicable` with the concrete reason (non-software, no architectural
  scope, no artifact output, etc.).

At plan end every deferred/conditional check must have a matching **check-level
outcome row** (one row per check, not per sub-task); otherwise it is
**unresolved** and must be reported in Step 6/7. Never claim a gate ran without
an outcome row.

## Write contract — `dh_plan_fast_skip_check`

Input: `{ slug, checks: string[], scope, reason, disposition }`. One call
appends one row per check with the same timestamp, scope, reason, and
disposition; it returns the ledger path and row count.
Append-only: the tool never updates, reorders, or deletes existing rows, and it
refreshes `updated`.

## Manual fallback

Use only when the tool is unavailable:

1. Read the ledger; if missing, create the body and seed the six rows above.
2. Append new rows at the **end** of the table; preserve every prior row.
3. Refresh `updated`; escape `|` as `\|` and newlines as spaces.
4. A correction is a new row — never rewrite or delete history.
5. No secrets, credentials, tokens, or full diffs in any cell.

## Rules

- Append-only; the ledger is an audit trail, not a mutable checklist.
- The ledger is not a substitute for running the end gates.
- Ledger rows never change plan/sub-task statuses.
- Missing outcome rows at plan end are a reportable alignment finding.
- Keep the table machine-readable: exactly five columns and a header row.

## Verification checklist

- [ ] Path is `docs/plans/<slug>/plan_fast_skip_checks.md`.
- [ ] Frontmatter parses with `slug` and `tags: [plan, fast, checks]`.
- [ ] Body starts with `# Fast Execution — Skipped Checks` and the exact table header.
- [ ] Six seed rows with `scope: Plan` exist after creation.
- [ ] Every selected sub-task has its six per-task rows.
- [ ] Every deferred/conditional gate has an end outcome row.
- [ ] History is append-only; `updated` is fresh; pipes/newlines escaped.
- [ ] No secrets or full diffs; unresolved rows are reported.
