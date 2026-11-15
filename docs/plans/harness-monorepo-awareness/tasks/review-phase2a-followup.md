# Code Review Summary — Phase 2a Follow-Up

**Scope**: Re-review of the fixes applied after
[`review-phase2a.md`](review-phase2a.md) returned **Request changes** for
Sub-Tasks 2.1 ("Add workspace impact to SDD and plan templates and planning
skills") and 2.5 ("Record execution provenance and architectural changes in
plan and index") of [`plan.md`](../plan.md).

Files re-reviewed:

- `docs/plans/index.md`, `docs/plans/harness-monorepo-awareness/workspace-contract.md`
- `src/tools/plan-io.ts`, `src/tools/plan-template.ts`, `src/tools/plan-fast-template.ts`
- `src/__tests__/workspace-plan-contract.test.ts`
- `skills/dh-planning/SKILL.md`, `skills/dh-planning/references/phased-plan-template.md`,
  `skills/dh-planning/references/execution-record.md`
- `skills/dh-review/SKILL.md`, `skills/dh-execute-plan/SKILL.md`,
  `skills/dh-execute-plan-fast/SKILL.md`,
  `skills/dh-execute-plan-fast/references/plan-fast-template.md`
- `skills/dh-final-review/SKILL.md`, `skills/dh-create-documentation/SKILL.md`,
  `skills/dh-grill-sdd/SKILL.md`, `skills/dh-setup/references/workspace-map.md`

**Overall risk**: Low
**Verdict**: Approve with comments

The prior P1 (plan-index corruption) is fixed with a valid approach and a
regression test that fails on the old layout. The P2 prose/discovery fixes are
present. The only remaining findings are one test-coverage gap (P2) and a set
of low-impact consistency/test-strength items (P3).

## Requested verification (follow-up matrix)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | P1 index-corruption fix | **Pass** | `docs/plans/index.md:3-10` — `## Execution Records` (3-8) precedes `## Plans` (10); the 7-column plan table runs to EOF (12-21, trailing newline present). Regression test `workspace-plan-contract.test.ts:192-211` seeds the real two-table index, appends via `appendPlanIndexRow`, asserts the new row falls after `## Plans` and the Execution Records slice is byte-identical. The earlier "plans before records" layout fails the `plans > execution` assertion at `:204`. Contract `§7.2` (`workspace-contract.md:213-215`) and `execution-record.md:49-52` now state the plans-table-last invariant. |
| 2 | `dh-review` fast omitted list includes both sections | **Pass (prose), test gap P2-1** | `skills/dh-review/SKILL.md:50-56` lists `## Workspace Impact` and `## Execution Record`; matches the renderer list (`plan-fast-template.ts:15-27`), the fast skill (`dh-execute-plan-fast/SKILL.md:35`) and the fast reference (`plan-fast-template.md:92-97`). No test asserts the `dh-review` copy. |
| 3 | Fast T1/T3 `source_sha256` refresh documented | **Pass (P3-3 caveat)** | `execution-record.md:68-75` requires recompute + `plan_version` bump after **T1 and after T3**; T1 is also restated in `dh-execute-plan-fast/SKILL.md:47-53, 152-155`. The "before the next alignment/equality gate" wording now matches Step 6's actual order (the plan-end equality gate runs at `:136-142`, the record write at `:152-155`, the next gate is the resume read). |
| 4 | Map discovery root/docs fallback consistent | **Fail — P3-1** | `workspace-map.md:3-10` accepts `docs/WORKSPACE.md` and tells other skills to read "root first, then `docs/`"; `dh-planning/SKILL.md:28-29, 95, 130, 148`, `phased-plan-template.md:176` and `dh-grill-sdd/SKILL.md:48, 143` still name only root `WORKSPACE.md`. |
| 5 | Planning lists the touched subset | **Pass on the rule; P3-2 for the missing question** | `dh-planning/SKILL.md:30-32` — "the affected packages (the subset touched, never the whole map)". The interview bank (`:75-83`) still has no affected-packages question. |
| 6 | Standard/fast close order T3 then T4 | **Pass (P3-4 duplication)** | Fast: Step 7 item 1 (T3) → item 2 (T4), `dh-execute-plan-fast/SKILL.md:164-173`. Standard: Step 4 item 1 (T3) → item 2 (T4), `dh-execute-plan/SKILL.md:100-106`. Standard also finalizes T3 a second time in Step 3 item 5 (`:91-94`). |
| 7 | All skills < 250 lines | **Pass** | `wc -l skills/*/SKILL.md` → max `dh-setup/SKILL.md` 248; `dh-create-documentation` 243, `dh-pause-plan` 246. New test file 262 lines (< 300). |
| 8 | Tests/lint/links/audit green | **Pass** | `npx vitest run`: 49 files / 815 tests. `pnpm lint:biome`: 116 files, no fixes. `pnpm typecheck`, `pnpm lint:knip`, `pnpm lint:dup` (0 clones), `pnpm lint:depcruise` (43 modules, 106 deps): clean. `node scripts/check-links.mjs`: 171 references, OK. `pnpm run audit`: exit 0, 0 FAIL findings, 0 secret failures, 0 junk/symlinks (warn-only prose tokens 272). |

## Prior-finding disposition

| Prior finding | Status |
|---|---|
| **P1-1** `dh_plan_create` appends into Execution Records | **Fixed** — option "move the section so the plan table is last", contract §7.2 updated, regression test added (`workspace-plan-contract.test.ts:192-211`). |
| **P2-1** `dh-review` fast omitted list | **Prose fixed; regression test extension missing** → follow-up **P2-1**. |
| **P2-2** fast `source_sha256` after T1/T3 | **Documented** (`execution-record.md:68-75`); remaining T4 ambiguity → **P3-3**. |
| **P3-1** planning does not ask for affected packages | **Not addressed** → **P3-2**. |
| **P3-2** only root `WORKSPACE.md` recognized | **Not addressed** → **P3-1** (the shared reference now carries the discovery order, which mitigates it only if the link is followed). |
| **P3-3** fast T3/T4 order inverted | **Fixed** (Step 7 T3 → T4); duplicate T3 in the standard skill → **P3-4**. |
| **P3-4** weak test assertions | **Partially** — exact index/impact headers are asserted; the `dh-review` copy and the "plans last" invariant remain unguarded → **P2-1**, **P3-5**. |

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

1. **The `dh-review` fast omitted-list copy is still untested**
   - **Location**: `src/__tests__/workspace-plan-contract.test.ts:27-34`
     (`SKILLS` map has no `review` entry) and `:242-249`
     (`it.each([FAST_REF, SKILLS.executeFast])`).
   - **Why it matters**: the prior P2-1 required the four fast-list copies to
     stay in sync and asked to extend this test to the three prose files that
     `src/__tests__/agent-selection.test.ts:111-120` already iterates
     (`dh-execute-plan-fast/SKILL.md`, its reference and `dh-review/SKILL.md`).
     The prose is now correct, but `dh-review` remains the only copy with no
     structural assertion, so the exact drift that produced the prior review
     finding can recur silently.
   - **Evidence**: `dh-review/SKILL.md:50-56` contains both sections. The new
     test's two `it` blocks never read that file; `SKILLS` (`:27-34`) omits it.
     The suite therefore passes even if the `dh-review` list is reverted.
   - **Fix**: add
     `review: path.join(REPO_ROOT, 'skills', 'dh-review', 'SKILL.md')` to
     `SKILLS` and include `SKILLS.review` in the `it.each` at `:244` (or reuse
     the three-file pattern from `agent-selection.test.ts`), asserting both
     `` `## Workspace Impact` `` and `` `## Execution Record` ``.

### [P3] Low

1. **Map discovery still names only root `WORKSPACE.md` in the planning skills**
   - **Location**: `skills/dh-planning/SKILL.md:28-29, 95, 130, 148`;
     `skills/dh-planning/references/phased-plan-template.md:176`;
     `skills/dh-grill-sdd/SKILL.md:48, 143`; versus
     `skills/dh-setup/references/workspace-map.md:3-10, 80-82`.
   - **Why it matters**: `dh-setup` may write the consented map at
     `docs/WORKSPACE.md` (interview item 12) and the reference tells other
     skills to read "root first, then `docs/`". A planning session that follows
     only its own skill text would silently skip `## Workspace Impact` for such
     a workspace — the same failure the prior P3-2 described, still unfixed.
   - **Evidence**: every planning-side mention is the bare string
     `WORKSPACE.md`; the only `docs/WORKSPACE.md` occurrences under `skills/`
     are in `workspace-map.md:6, 81`.
   - **Fix**: use one phrasing, e.g. "the workspace map (`WORKSPACE.md`, else
     `docs/WORKSPACE.md`)" in `dh-planning`, `dh-grill-sdd` and the template
     reference.

2. **`dh-planning` still does not ask for affected packages**
   - **Location**: `skills/dh-planning/SKILL.md:75-83` (seven-question bank),
     rule at `:28-36`.
   - **Why it matters**: 2.1's acceptance says planning asks for affected
     packages when a map exists. The map lists every package and its commands,
     so "fill from the map" cannot decide scope; `dh-grill-sdd:48-51` asks, but
     a waived/legacy SDD relies on inference, and contract A8 says package
     scope is declared, never derived.
   - **Evidence**: the question bank has no workspace/affected-packages item;
     `:95` only says to read `WORKSPACE.md` and record the section.
   - **Fix**: add "Affected packages (when a workspace map exists)" to the
     interview bank and state that the map supplies the commands, not the
     affected set.

3. **Fast-mode T4 can edit the record after the last documented hash refresh**
   - **Location**: `skills/dh-create-documentation/SKILL.md:66-68`;
     `skills/dh-planning/references/execution-record.md:68-75`;
     `skills/dh-execute-plan-fast/SKILL.md:164-173`.
   - **Why it matters**: the reference refreshes `source_sha256` after T1 and
     T3 only. T4 says to "link the evolution note and the mirrored plan path
     from the plan's `## Execution Record`" without stating whether it writes
     the record. If T4 updates `References`/`Mirrored plan path` in `plan.md`,
     the finalized fast mirror goes stale after the T3 refresh and the next
     resume hits the "Mismatch → stop and ask" path for a sanctioned edit.
   - **Evidence**: records fields are not filtered by `computeSourceSha256`
     (`plan-fast-template.ts:39, 50-57` filters only `- **Status:**` lines), so
     any record edit changes the hash; Step 7 item 1 links the reference but
     does not restate the T3/T4 refresh.
   - **Fix**: state explicitly that T4 is read-only with respect to `plan.md`,
     or extend the refresh rule to "after every record write (T1, T3, T4)" and
     name the recompute step in Step 7.

4. **The standard execution skill finalizes T3 twice**
   - **Location**: `skills/dh-execute-plan/SKILL.md:91-94` (Step 3 item 5) and
     `:100-104` (Step 4 item 1).
   - **Why it matters**: two instructions edit the same record/index row.
     Idempotent today, but they are two sources of truth for T3 and can
     diverge on the next edit.
   - **Evidence**: both bullets set `Execution status`, `Executed at`,
     `Commit range` and the `## Execution Records` row, then Step 3 item 5 says
     "then proceed to Step 4", where Step 4 item 1 repeats it.
   - **Fix**: keep one T3 finalization step (preferably Step 3 item 5 before
     the T4 call) and have Step 4 item 1 reference it.

5. **The regression test guards section order but not "plan table is last"**
   - **Location**: `src/__tests__/workspace-plan-contract.test.ts:178-183,
     192-211`.
   - **Why it matters**: `appendPlanIndexRow` is an EOF append
     (`plan-io.ts:47`), so the real invariant is that `## Plans` is the final
     top-level section. The test only asserts `## Execution Records` <
     `## Plans`. A future third section appended after the plan table (e.g.,
     another records/release table) would silently capture plan rows again and
     the test would still pass.
   - **Evidence**: neither `it` computes the last top-level heading; the
     appended-row assertion only checks a substring after the `## Plans` index.
   - **Fix**: assert `index.indexOf('\n## Plans') === index.lastIndexOf('\n## ')`
     (Plans is the last section) or that the appended row is the last non-empty
     line after the final plan-table row.

## Validation results

- Tests: `npx vitest run` → 49 files / 815 tests passed (includes
  `workspace-plan-contract.test.ts` and `workspace-anchor.test.ts`).
- Lint/format: `pnpm lint:biome` → 116 files checked, no fixes.
- Typecheck: `pnpm typecheck` → clean.
- Extra lint gates: `pnpm lint:knip` clean; `pnpm lint:dup` 0 clones;
  `pnpm lint:depcruise` 43 modules / 106 deps, no violations.
- Links: `node scripts/check-links.mjs` → 171 references, no dead references.
- Audit: `pnpm run audit` → exit 0, 0 FAIL findings, 0 secret failures,
  0 junk files/symlinks; 272 warn-only prose deviations (`execution-record`
  kebab tokens are the new expected ones). Re-running the audit regenerated
  `reports/audit.json` / `reports/audit.md` with the current code; no code or
  skill file was changed by this review.
- No secrets, tokens, credentials or environment values in the reviewed diff.
- Determinism: the new tests are static reads plus the real two-table index
  seeded into a temp directory and a fixed-timestamp `renderFastPlan`; no
  network/time-dependent assertions.

## Verified (no finding)

- Index reorder preserved every pre-existing plan row and the 7-column
  `| Title | Slug | Description | Created | Updated | Status | Active |` header;
  the two-table shape is now `Execution Records` then `Plans` to EOF.
- `appendPlanIndexRow` still escapes backslashes, pipes and line breaks and
  keeps `O_NOFOLLOW`/`O_APPEND`; only the file layout changed, not the append
  code (`plan-io.ts:43-64`).
- The Execution Records header is byte-identical in
  `docs/plans/index.md:7`, `execution-record.md:45` and `workspace-contract.md:210`.
- `dh-review`'s 11-section omitted list is identical (order included) to the
  renderer's `FAST_OMITTED_SECTIONS` and the other two prose copies.
- T2/T4 instructions are present (`dh-final-review/SKILL.md:28-33, 67`;
  `dh-create-documentation/SKILL.md:66-68`), and the four execution/review/doc
  skills link `execution-record.md`; every link resolves.
- `## Workspace Impact` and `## Execution Record` remain outside `## Phases` in
  the template, scaffold and generated plan; the parser still ignores both and
  legacy fixtures parse unchanged.
- All 26 `skills/*/SKILL.md` files are under 250 lines (max 248); changed code
  files are under 300 lines.

## Scope note

- The working tree also contains Sub-Tasks 1.2/1.3 work
  (`skills/dh-setup/**`, `workspace-map.md`, `workspace-anchor.test.ts`,
  `reports/audit.*`) and the Phase 1 status changes; those are outside this
  re-review.
- Plan state: `plan.md` still shows **2.1 `In Progress`** and **2.5
  `Pending`** (`plan.md:246, 365`) while the 2.5 implementation is present in
  the working tree. Per the phase model, 2.5 should be moved to `In Progress`
  before/while its work is reviewed and to `Completed` once accepted.

## Suggested Next Steps

- [ ] Add the `dh-review` copy to the fast-omitted-list test (P2-1).
- [ ] Use one map-discovery phrasing (root `WORKSPACE.md`, else
      `docs/WORKSPACE.md`) in `dh-planning`, `dh-grill-sdd` and the template
      reference (P3-1).
- [ ] Add the affected-packages interview question (P3-2).
- [ ] Clarify whether T4 writes the record and cover it in the hash-refresh
      rule (P3-3).
- [ ] Remove the duplicate T3 step in `dh-execute-plan` (P3-4).
- [ ] Assert "plans table is last" in the index test (P3-5).
- [ ] Re-run `npx vitest run`, `node scripts/check-links.mjs` and
      `pnpm run audit` after the test change.
