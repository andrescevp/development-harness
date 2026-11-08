# plan_fast.md Template (fast execution mirror)

Canonical contract for `docs/plans/<plan-slug>/plan_fast.md`, created by
`dh-execute-plan-fast` and consumed by `dh-execute-plan-task-fast`; the plan
tools parse it like `plan.md` with `path: "<plan-slug>/plan_fast.md"`.

## Purpose and roles

| File | Role | Mutability |
|---|---|---|
| `plan.md` | Source of truth for scope, requirements, acceptance criteria, and done-when | Content frozen in fast mode; only status markers are mirrored into it |
| `plan_fast.md` | Fast execution mirror: integrity hash, policy, verbatim phases, verification | Created once; statuses progress and realignment is explicit |

- One `plan_fast.md` per plan, in the same directory as `plan.md`.
- It is **never** a substitute for `plan.md`. Requirements and scope are not
  duplicated: the mirror's `## Phases` region is compared against `plan.md`.
- Neither file may contain secrets, tokens, credentials, or customer data.
- Skipped checks are recorded append-only in `plan_fast_skip_checks.md`
  ([`plan-fast-skip-checks.md`](plan-fast-skip-checks.md)).
- Fast tools: `dh_plan_fast_create` (mirror + ledger seed), `dh_plan_fast_read`
  (`source_sha256`, `stale`, ledger path), `dh_plan_fast_update_status` (both
  plans), `dh_plan_fast_sync` (reconcile), `dh_plan_fast_skip_check` (append).
  Manual fallback follows this reference and the skip-checks reference.

## Frontmatter

```yaml
---
title: "<Plan title> — Fast Execution"
slug: <plan-slug>
description: Fast execution mirror of plan.md; critical verification deferred to plan end.
source_plan: plan.md
source_sha256: <64-hex>
plan_version: fast-1
status: Pending
active: true
tags: [plan, fast]
project: <project>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

- `slug` must equal the plan directory name and `plan.md`'s slug.
- `source_plan` is always `plan.md`; any other value is a corrupt mirror.
- `source_sha256`: lowercase 64-hex SHA-256 of the `plan.md` **body** (text
  after the closing frontmatter `---`) with every line whose trimmed form
  starts with `- **Status:**` deleted (including its newline). Status-only
  changes therefore keep the hash stable. Compute with
  `sha256sum` / `shasum -a 256`. Missing or malformed → corrupt mirror.
- `plan_version` is `fast-1` at creation. Bump `<n>` on **any realignment**
  (source-plan change, confirmed transcription fix, verification-section
  change) — never for status updates.
- `status`: at creation match `plan.md` (`Pending` when new); `In Progress` in
  **both** plans when the first sub-task starts; `Completed` in both at close.
- `updated` is set at creation and refreshed on replacement/realignment; status edits leave it unchanged.

## Required sections (in order)

1. `# Plan: <title> (Fast Execution)`
2. `## Fast Execution Policy`
3. `## Alignment Contract`
4. `## Phases`
5. `## Final Verification`

## Fast Execution Policy

```markdown
## Fast Execution Policy

- No per-task `dh-review`, `dh-simplify`, `dh-code-review`, `dh-preflight`,
  `dh-artifact-check`, or `dh-domain-check` gates.
- Execution position and statuses are read from this file; every phase and
  sub-task status change is mirrored to `plan.md` in the same turn (retry once;
  on failure revert the first write and stop).
- A phase moves to `In Progress` when its first sub-task starts and closes only
  when ALL its sub-tasks are `Completed`; close pending phases in both files
  before selecting a sub-task, at resume, and before final verification.
- Narrow validation (the smallest relevant test/lint run) stays part of each
  sub-task; it is a sanity check, not a review gate.
- All critical verification runs once across Steps 6–7 (see Final Verification).
- Hard blockers still halt the loop; a blocked sub-task blocks its phase.
```

## Alignment Contract

```markdown
## Alignment Contract

- Compare against `plan.md`: phase/sub-task coverage, IDs, titles, order,
  `Related Requirements`, acceptance criteria, done-when, and scope boundaries.
- `plan_fast.md` intentionally omits these top-level sections (never findings):
  `## Objective`, `## Requirements Snapshot`, `## Scope`,
  `## Assumptions and Constraints`, `## Risks and Areas Requiring Care`,
  `## Core concepts`, `## Open Questions`. Use `plan.md` for those checks.
- Allowed fast sections: `## Fast Execution Policy`, `## Alignment Contract`,
  `## Final Verification`.
- Allowed status progression only; no other difference is allowed.
- Not allowed: missing, extra, reordered, or renamed phases/sub-tasks; altered
  requirements; widened or narrowed scope; changed acceptance criteria.
- `plan.md`'s `## Final Integration & Verification` is copied into
  `## Final Verification` (append), not replaced.
- Missing/extra/reordered/renamed items, altered requirements/criteria, or any
  scope change → P0/P1; pre-exec status P2 (plan.md ahead P1); plan-end P1.
- Misalignment is fixed in `plan_fast.md`; if `plan.md` itself is wrong, stop
  and ask. Fast mode never rewrites plan scope.
```

## Phases (verbatim copy)

Copy the entire `## Phases` region from `plan.md` — from the `## Phases` heading
to the next top-level `##` heading (or EOF) — **without retyping, reformatting,
renaming, or translating fields**.

Parser contract (unchanged from `plan.md`):

1. Each phase is `### Phase N: <title>`; its first `- **Status:**` bullet is the
   phase status and may be preceded only by blank lines.
2. Each sub-task is `#### Sub-Task N.M: <title>`; its first `- **Status:**`
   bullet is the sub-task status and may be preceded only by blank lines.
3. Valid statuses: `Pending`, `In Progress`, `Completed`.
4. Sub-task `N.M` belongs to Phase `N`; mis-numbered sub-tasks are format errors.
5. Keep every field bullet unchanged (`Objective`, `Related Requirements`,
   `Dependencies and Preconditions`, `In Scope for This Sub-Task`,
   `Out of Scope for This Sub-Task`, `Instructions`, `Acceptance Criteria`,
   `Cautionary Points (Risks & Edge Cases)`, `Implementation Suggestions`,
   `Testing Suggestions`, `Done When`).

Statuses start exactly as in `plan.md`; afterwards the mirror progresses first
and `plan.md` is mirrored in the same turn.

## Final Verification

```markdown
## Final Verification

### Plan-specific verification (copied from plan.md, unchanged)

- **System-Wide Test:** [copy every item from plan.md]
- **Completion Checklist:** [copy every item from plan.md]

### End gates (run once, Steps 6–7, in order)

1. `dh-review` Plan Alignment Mode `phase: plan-end` →
   `tasks/review-fast-final.md` (statuses must match exactly).
2. Execute the plan-specific System-Wide Test and Completion Checklist above;
   report each result.
3. `dh-simplify` + `dh-code-review` on the full plan diff (software only).
4. `dh-domain-check` only for architectural multi-module software plans;
   otherwise record **not applicable** (never claim it ran).
5. `dh-preflight` + `dh-artifact-check`.
6. `dh-final-review` — reuse items 1–5; do not re-run preflight,
   artifact-check, or semver.
7. `dh-create-documentation` (docs + evolution/observation notes).
8. Append every outcome to `plan_fast_skip_checks.md` via
   `dh_plan_fast_skip_check` (`run: PASS/FAIL` or `not applicable`).
9. `dh-semver` once (software only); backfill version/tag.

Any P0/P1 finding stops the close: fix it, re-run the failing gate, then every
downstream gate.
```

## Integrity, realignment, and phase-close sweep

- **Status writes:** `dh_plan_fast_update_status` updates both plans and reverts
  on mirror failure; `dh_plan_fast_sync` reconciles fast→plan only.
- **Validate `source_sha256`** (plus `slug` and `source_plan`) at startup,
  resume, pre-execution alignment, and plan-end alignment. Mismatch → stop and
  ask the user; **never auto-adopt** `plan.md` changes.
- **Transcription fix:** only before execution, only when the hash still
  matches `plan.md` but structure/field content disagrees (statuses excluded);
  confirm, fix, bump `plan_version`, recompute the hash, and re-run alignment.
- **Realignment** (user-approved after a hash mismatch): rebuild `## Phases`
  from `plan.md`, preserving `Completed` only for sub-tasks whose ID and title
  are unchanged; recopy the verification items; bump `plan_version`; recompute
  `source_sha256`; re-run alignment. Never merge silently.
- **Phase-close sweep** in both files before selecting a sub-task, at resume
  start, and before Step 6 final verification. The status tool refuses a phase
  close while any sub-task is open, so the sweep is safe.
- A stale or unparseable mirror is a hard stop, not a reason to fall back to
  `plan.md` alone.

## Worked example

> **Compact illustration — never copy this shape; use the canonical blocks
> above.**

```markdown
---
title: "Billing retries — Fast Execution"
slug: billing-retries
source_plan: plan.md
source_sha256: <64-hex>
plan_version: fast-1
status: In Progress
tags: [plan, fast]
---

# Plan: Billing retries (Fast Execution)

## Phases

### Phase 1: Retry policy

- **Status:** In Progress

#### Sub-Task 1.1: Add the backoff calculator

- **Status:** Completed
- **Related Requirements:** R1
- **Done When:** Unit tests pass.

#### Sub-Task 1.2: Wire retry into the client

- **Status:** In Progress
- **Related Requirements:** R2
- **Done When:** Integration test passes.

## Final Verification

- Plan-specific items copied from `plan.md`, then the canonical end gates.
```

## Rules

- No scope changes, no new/removed sub-tasks, no reordering, no rewording of
  requirements or acceptance criteria.
- Any `plan.md` edit after creation requires the integrity check and, when the
  hash changed, a confirmed realignment before any execution.
- `plan_fast.md` never replaces `plan.md` for scope questions; when they
  disagree on scope, stop and ask.
- Keep both files under version control and free of secrets.
- Status bullets follow the parser contract above — the MCP tools reject
  malformed markers.

## Verification checklist

- [ ] Frontmatter parses; `slug`, `source_plan: plan.md`, `source_sha256`, and `plan_version` are present.
- [ ] `source_sha256` recomputes to the recorded value from the current `plan.md`.
- [ ] Required sections exist in order.
- [ ] `dh_plan_fast_read` returns every phase/sub-task, `source_sha256`, `stale: false`, and the ledger path.
- [ ] `plan_fast_skip_checks.md` exists and is append-only with seed + per-task + outcome rows.
- [ ] Phase/sub-task IDs, titles, and order match `plan.md` exactly.
- [ ] Field bullets (requirements, scope, criteria, done-when) are unchanged.
- [ ] Plan-specific System-Wide Test and Completion Checklist items are copied verbatim.
- [ ] Statuses progress in the mirror and are copied to `plan.md` in the same turn; plan-level `status` lifecycle matches.
- [ ] No scope drift, no invented sub-tasks, no secrets.
