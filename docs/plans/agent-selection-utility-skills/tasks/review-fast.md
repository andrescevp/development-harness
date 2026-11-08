# Plan Alignment Review (Fast Mode) — agent-selection-utility-skills

**Mode:** `dh-review` Plan Alignment Mode (`phase: pre-execution`)
**Date:** 2026-11-08
**Inputs:** `plan.md` (313 lines), `plan_fast.md` (279 lines), `plan_fast_skip_checks.md` (20 lines)
**Boundary:** comparison only — no sub-task selection, no diff review, no code review,
no `@dh-reviewer`/`dh-code-review`/`dh-domain-check`. `plan.md` and `plan_fast.md` were
read, not modified (only this report is new).

**Verdict:** Approve with comments — no P0/P1 findings. Resolves to **Approve** for gating.

---

## 1. Integrity hash (`source_sha256`)

| Item | Value |
|---|---|
| Recorded in `plan_fast.md` | `1982e54a735e807f9bfda7b69b6a89897ab0c0bf67574553ff7d36a1e69c1e2f` |
| Recomputed from `plan.md` body (text after closing frontmatter, every `- **Status:**` line removed) | `1982e54a735e807f9bfda7b69b6a89897ab0c0bf67574553ff7d36a1e69c1e2f` |
| Expected (caller) | `1982e54a735e807f9bfda7b69b6a89897ab0c0bf67574553ff7d36a1e69c1e2f` |
| Result | **MATCH** |

Details:

- Closing frontmatter delimiter is line 11; the body starts immediately after it.
- 19 `- **Status:**` lines (5 phase + 14 sub-task) exist in both plans; none are indented,
  so the trimmed-form rule and the `^-\s+\*\*Status:\*\*` rule select the same lines.
- The file is LF-only and ends with a single newline (no CRLF/trailing-blank-line drift).
- Cross-check: `plan.md` is byte-identical to `HEAD` (`739938b`,
  `sha256sum` = `4894b135fae4cfa318d7d3c91ec8f7ff16c6f16d7b90f7694c394649abf8d017`),
  so no post-mirror edit of the source plan is hiding behind the recorded hash.

**Operational note (see P2):** the repository's own
`computeSourceSha256` (`src/tools/plan-fast-template.ts:48-54`, identical in
`dist/mcp/stdio.js`) strips one leading newline in `planBody` before hashing and therefore
computes `776482f237fa9095b88f5151d14ee0de3a6ee19c1041151658b083deb3bbd4a4` for the current
`plan.md`. The recorded value matches the documented algorithm and the expected value, but
not that implementation.

---

## 2. Phase / sub-task comparison

`## Phases` regions are **byte-identical** (programmatic string equality, `diff` → no output).

| Metric | `plan.md` | `plan_fast.md` | Result |
|---|---|---|---|
| Phases | 5 | 5 | MATCH |
| Sub-tasks | 14 | 14 | MATCH |
| Phase IDs / titles / order | — | — | MATCH |
| Sub-task IDs / titles / order | — | — | MATCH |
| Phase + sub-task statuses | 19 | 19 | MATCH (all `Pending`) |
| Plan-level `status` | `Pending` | `Pending` | MATCH |
| Plan-level `active` | `true` | `true` | MATCH |

Inventory (same in both files):

| Phase | Sub-task | Title |
|---|---|---|
| Phase 1: Agent-selection contract | 1.1 | Author the agent-selection protocol |
| Phase 1 | 1.2 | Add `## Agent Selection` to the plan template |
| Phase 1 | 1.3 | Update `dh-planning` to select and record agents |
| Phase 2: Utility agent-to-skill migration | 2.1 | Create the `dh-execute-cli` skill |
| Phase 2 | 2.2 | Create the `dh-explore` skill |
| Phase 2 | 2.3 | Replace executor/explorer references |
| Phase 3: Delegation cleanup | 3.1 | Execution and review delegation |
| Phase 3 | 3.2 | Docs, setup, semver, preflight, artifact, and footers |
| Phase 3 | 3.3 | Update agent definitions and harness docs |
| Phase 4: Inventory, tests, and docs | 4.1 | Update inventory counts and smoke checks |
| Phase 4 | 4.2 | Add the agent-selection contract test |
| Phase 4 | 4.3 | Update documentation counts and tables |
| Phase 5: Validation and release | 5.1 | Run the full validation gates |
| Phase 5 | 5.2 | Final review and merge |

Because the whole `## Phases` region is byte-identical, every sub-task field also matches:
`Objective`, `Related Requirements`, `Dependencies and Preconditions`,
`In Scope for This Sub-Task`, `Out of Scope for This Sub-Task`, `Instructions`,
`Acceptance Criteria`, `Cautionary Points`, `Implementation Suggestions`,
`Testing Suggestions`, `Done When`. No missing, extra, reordered, or renamed item and no
altered requirement, criterion, or scope line.

---

## 3. Allowed differences only

Top-level sections:

| `plan.md` | `plan_fast.md` | Classification |
|---|---|---|
| Objective | omitted | allowed omission |
| Requirements Snapshot | omitted | allowed omission |
| Scope | omitted | allowed omission |
| Assumptions and Constraints | omitted | allowed omission |
| Risks and Areas Requiring Care | omitted | allowed omission |
| Core concepts | omitted | allowed omission |
| Visual Context | omitted (not present in `plan.md`) | allowed omission (constant-level) |
| Open Questions | omitted | allowed omission |
| Phases | `## Phases` | compared byte-for-byte |
| Final Integration & Verification | folded into `## Final Verification` → `### Plan-specific verification` | allowed (content identical) |
| — | `## Fast Execution Policy` | allowed fast section |
| — | `## Alignment Contract` | allowed fast section |
| — | `## Final Verification` (fast gates) | allowed fast section |

- The `## Alignment Contract` omission list names exactly the nine
  `FAST_OMITTED_SECTIONS` from `src/tools/plan-fast-template.ts` (including
  `## Agent Selection`).
- `## Final Integration & Verification` content (`System-Wide Test`,
  `Completion Checklist`) is copied verbatim into the fast mirror's
  `### Plan-specific verification` (exact string match).
- Frontmatter differences are mirror metadata only: title suffix `— Fast Execution`,
  mirror `description`, `source_plan`, `source_sha256`, `plan_version: fast-1`,
  and `tags` adding `fast`.
- No status progression beyond parity: both plans are entirely `Pending`.
- No other differences were found.

---

## 4. `plan.md` scope / requirements untouched

- `plan.md` in the working tree equals `HEAD` commit `739938b`
  ("docs(plan): add agent selection and utility skills plan", 2026-11-08 15:25:20 +0100);
  the mirror (`15:27`) was added afterwards without touching `plan.md`.
- R1–R10, `## Scope`, `## Assumptions and Constraints`, `## Risks and Areas Requiring Care`,
  `## Core concepts`, `## Final Integration & Verification`, and `## Open Questions`
  are intact.
- The only new files in `docs/plans/agent-selection-utility-skills/` are
  `plan_fast.md` and `plan_fast_skip_checks.md` (untracked); no active-surface code,
  skill, or doc file was changed by this planning step.

---

## 5. `plan_fast_skip_checks.md`

- File exists (20 lines) with the exact header:
  `| Timestamp | Check | Scope | Reason | Disposition |` and separator
  `|---|---|---|---|---|`.
- Exactly the six seed rows, in canonical order, all `Scope = Plan`:
  `dh-review`, `dh-simplify`, `dh-code-review`, `dh-domain-check`, `dh-preflight`,
  `dh-artifact-check`.
- Seed rows carry one timestamp (`2026-11-08T14:27:23.048Z`) and end-of-plan dispositions
  (`deferred to end-of-plan`; `dh-domain-check` → `conditional at plan end`).
- Append-only preconditions hold: `dh_plan_fast_skip_check` appends rows without
  rewriting the header.

---

## Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.

### [P2] Recorded hash matches the documented algorithm but not the repository's `computeSourceSha256`

- **Location:** `plan_fast.md:6` (`source_sha256`).
- **Evidence:** the recorded value `1982e54a…` is the SHA-256 of the `plan.md` text taken
  after the closing `---` (delimiter newline + blank line included) with the 19 status lines
  removed. The repo implementation (`src/tools/plan-fast-template.ts:40-54`, mirrored in
  `dist/mcp/stdio.js:6437-6446`) first strips one leading newline in `planBody`, so it
  computes `776482f237fa9095b88f5151d14ee0de3a6ee19c1041151658b083deb3bbd4a4`.
- **Impact:** with the repository build, `dh_plan_fast_read` would return `stale: true`
  (and `dh_plan_fast_sync` would return the same `sourceSha256` plus `stale: true`).
  `dh-execute-plan-fast` Step 3 and `dh-execute-plan-task-fast` treat a stale mirror as a
  hard stop ("stop and ask"), so a fast run could halt on its first read. If the `dh` MCP
  server is not connected (documented manual fallback), the mirror is valid as written.
- **Recommendation (pre-execution check, no `plan.md` change):** run `dh_plan_fast_read`
  for the slug before starting the loop and require `stale: false`. If it reports stale,
  recompute the recorded hash with the repository tool (`776482f2…`) and bump
  `plan_version` to `fast-3` as a realignment (content change), or confirm which server
  build the runtime uses. The durable fix — aligning `computeSourceSha256`/`planBody` with
  the reference's "text after the closing `---`" wording, or tightening that wording — is
  outside this plan's scope (`## Scope` excludes MCP tools/server changes).

### [P3] Ledger prose/reasons differ from `renderSkipLedger` defaults

- **Location:** `plan_fast_skip_checks.md:4`, `13-20`.
- **Detail:** the header and six rows are exact in shape, but the `description`, the
  preamble paragraph, and the per-check `Reason` text are tailored rather than the
  renderer defaults ("fast mode defers per-task verification" for all but
  `dh-domain-check`). Cosmetic only; `appendSkipRows` appends after the existing rows, so
  no functional impact.

### Observations (not findings)

- The `## Alignment Contract` omission list does not yet name `## Agent Selection`. This is
  correct today because `plan.md` has no such section; Sub-Task 1.2 is the step that adds
  the section plus the fast omit lists (also required by the `plan.md` Risks bullet about
  fast-plan alignment).
- `plan_fast.md` and `plan_fast_skip_checks.md` are untracked at review time; commit them
  with the plan so the mirror is reviewable from history.
- No secrets, tokens, credentials, or secret-like values are present in either new file
  (the only matches for "secrets" are instructional prose in Sub-Tasks 2.2).

---

## Evidence

```text
# frontmatter split → body hash (status lines removed)
plan body starts: "# Plan: Agent Selection and Utility Skills"
raw-body recomputation : 1982e54a735e807f9bfda7b69b6a89897ab0c0bf67574553ff7d36a1e69c1e2f  ← recorded/expected
repo computeSourceSha256: 776482f237fa9095b88f5151d14ee0de3a6ee19c1041151658b083deb3bbd4a4  ← P2

# phases region
phases identical: true
counts plan: 5 phases, 14 subtasks | fast: 5 phases, 14 subtasks
statuses: 19 × Pending in both

# final integration & verification
FIV match: true   (verbatim copy)

# source plan untouched
git show HEAD:.../plan.md | sha256sum = 4894b135… = sha256sum docs/plans/agent-selection-utility-skills/plan.md
git status --porcelain → only `?? plan_fast.md`, `?? plan_fast_skip_checks.md`
```

---

**Verdict:** Approve with comments (no P0/P1; one P2 operational note to check before the
fast loop starts). No code review and no sub-task selection were performed.

## P2 Resolution — Source Hash

- Corrected `source_sha256` to the runtime `computeSourceSha256(plan.md)` value:
  `776482f237fa9095b88f5151d14ee0de3a6ee19c1041151658b083deb3bbd4a4`.
- Bumped `plan_version` to `fast-3` (pre-execution realignment with the nine-section
  omit list, including `## Agent Selection`).
- All structural/status alignment checks remain unchanged; the mirror is now
  expected to report `stale: false`.
