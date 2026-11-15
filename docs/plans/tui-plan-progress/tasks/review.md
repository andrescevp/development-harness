# Final Plan Review: TUI Plan Progress

**Plan slug:** `tui-plan-progress`
**Reviewed against:** [sdd.md](../sdd.md) (R1–R8, AC1–AC8), [progress-contract.md](../progress-contract.md), [plan.md](../plan.md), [plan_fast.md](../plan_fast.md)
**Reviewer:** `dh-final-reviewer` (T2 sign-off, `dh-final-review`)
**Date:** 2026-11-15
**Branch / HEAD:** `feature/tui-plan-progress` @ `5dd085f`
**Diff reviewed:** `git diff 1318206...HEAD` — 85 files, +11,470 / −251
**Overall risk:** Low
**Verdict:** **Approve with comments** — no P0. Two P1 close-gate bookkeeping items (fast-mirror integrity and the plan-end ledger outcomes) MUST be completed at T3 before the plan is marked `Completed`. No implementation changes are requested.

> This review did not modify code, `plan.md`, `plan_fast.md`, `sdd.md` or
> `progress-contract.md`. The only file written is this report. Verification
> rebuilt `dist/` (git-ignored) and re-ran `pnpm run audit`; the regenerated
> `reports/audit.{json,md}` were restored to HEAD, so the working tree is clean.

## Review Method

- Read the SDD, progress contract, plan, fast mirror, API notes, the pre-execution
  and plan-end alignment reviews, the code-review/simplify report and the T1
  Execution Record.
- Inspected the full diff for code, build/package, managed installer, docs/tests
  and dependency wiring.
- Re-ran every release gate locally (table in [Release Readiness](#release-readiness)).
- Re-ran the fast-plan integrity and alignment tools:
  `dh_plan_fast_read` and `dh_plan_fast_sync { phase: "plan-end", apply: false }`.
- Mapped every change back to R1–R8 / AC1–AC8 and looked for regressions,
  missing edge cases, packaging impact and standalone/workspace resolution.

## Plan Completion Status

| Phase | Sub-tasks | Status | Notes |
|---|---|---|---|
| Phase 1: API and Build Contract | 1.1, 1.2, 1.3 | Completed | 3/3 sub-tasks `Completed` |
| Phase 2: Progress Data Layer | 2.1, 2.2, 2.3, 2.4 | Completed | 4/4 sub-tasks `Completed` |
| Phase 3: TUI Components and Commands | 3.1, 3.2, 3.3 | Completed | 3/3 sub-tasks `Completed` |
| Phase 4: Packaging, Installer, Docs and QA | 4.1, 4.2, 4.3, **4.4** | In Progress | 4.1–4.3 `Completed`; 4.4 is the close gate and remains `In Progress` by design |

Per-phase completion: Phase 1 `Completed` (3/3), Phase 2 `Completed` (4/4),
Phase 3 `Completed` (3/3), Phase 4 `In Progress` (3/4 — 4.4 is the close gate,
which owns the end gates including this review). 13 of 14 sub-tasks are
`Completed`; no `Pending` sub-tasks. No phase was closed around an open
sub-task.

Delegation: all 13 implemented sub-tasks name a valid agent from
`## Agent Selection` — 11 × `dh-software-engineer`, 1.2 `dh-software-architect`,
4.3 `dh-documentor`. 4.4 names `dh-software-engineer`. No empty or unknown
delegation was found. The plan-end alignment review independently confirmed
`plan.md` ↔ `plan_fast.md` structural and status parity at its run time.

## T1 Execution Record Verification

| Field | Recorded | Verified against diff | Result |
|---|---|---|---|
| Execution status | `In progress` | T1 timing (execution loop ended, final review not yet passed) | PASS |
| Executed at | `2026-11-15` | Current review date; T1 first-written date | PASS |
| Workspace root | `/home/andres/workspace/dev-harness-skills` | `git rev-parse --show-toplevel`; standalone repo root | PASS |
| Repository kind | `workspace` | Standalone workspace root; matches the prior plan's convention | PASS |
| Repository path | `.` | Commits landed at the repo root | PASS |
| Branch / worktree | `feature/tui-plan-progress` (main checkout) | `git branch --show-current`; no worktree | PASS |
| Commit range | `814a8b7..uncommitted` (finalized at T3) | Base `814a8b7` is the plan/SDD commit; implementation is `5dd085f`; range is provisional at T1 by contract | PASS at T1 — T3 must finalize to `814a8b7..5dd085f (implementation; close-out commit follows)` |
| Plan path | `docs/plans/tui-plan-progress/plan.md` | File exists, authoritative copy | PASS |
| Mirrored plan path | `docs/plans/tui-plan-progress/plan_fast.md` | Mirror exists, `source_plan: plan.md`; but now stale (P1-1) | PASS at T1 — realignment required at T3 |
| Summary | 4 bullets (TUI part, data layer, packaging/installer `2.2.7` alignment, full gate + blocked pixel check) | Matches the diff and the re-run gates | PASS |
| Architectural changes | TUI part beside the server part; read-only pipeline; slot architecture; host-singleton peers with bundled `yaml`; managed layout ships `dist/tui.js` + `./tui`; `@opencode/plugin` 2.2.7 | All present in the diff | PASS |
| References | SDD, contract, API notes, alignment, code review | All five files exist and are committed | PASS |

The record is complete, consistent with the implementation and correctly left
`In progress` at T1. Two follow-ups belong to T3: finalize the commit range and
set the final execution status (see [T3 Actions](#t3-actions)).

## Requirements Verification

| Requirement | Status | Evidence |
|---|---|---|
| R1 — TUI part (`./tui`, prefixed id, cleanup) | PASS | `package.json` `exports["./tui"]`; `src/tui/index.tsx` `Plugin.define({ id: 'dev-harness-skills.tui', setup })`; cleanup removes both slot claims and disposes the store (idempotent). `test/tui-bundle.test.ts` imports the built bundle, checks the id/claims/command/disposer, and resolves the package self-reference `dev-harness-skills/tui`. |
| R2 — Sidebar progress | PASS (model/bundle level) | `src/tui/components/SidebarPlan.tsx` + `sidebar-model.ts` + `format.ts`: title/slug, `Phase N · N.M`, completed/total + text bar, delegated agent, status, one-line activity; width-clamped 20–38 columns, `[█░]`/ASCII bars, symbol **and** word for status (never color-only); theme tokens. 18 view-model tests cover S1–S8. |
| R3 — Session panel | PASS (model/bundle level) | `PlanPanel.tsx`, `panel-model.ts`, `panel-sections.ts`: every phase/sub-task with status/agent, criteria (Done When/Acceptance), checkboxes, plan + final-verification checklists, review verdict with source label, fast mirror/ledger state, last update; keymap `r`/`f`/`esc` + scroll + `1…9` pin; `panel.name` filter; read-only. Windowed scrolling and cursor clamping tested. |
| R4 — Progress model | PASS | Pure `derivePlanState` + read layer (`plan-state`, `plan-select`, `plan-candidate`, `plan-progress`, `plan-checklists`, `plan-review`, `plan-sidecars`); frontmatter selection with index fallback, pinned override, stale-pin fallthrough, multiple/none/malformed states; **no `fs` write API and no `storage.store`** anywhere in `src/tui` (grep-verified), enforced by the new `tui-read-only` dependency-cruiser rule. Fixtures + 65 test files. |
| R5 — Refresh | PASS | `plan-watch.ts`: recursive `fs.watch` with per-directory fallback and a 2 s poll; 300 ms trailing debounce, 1,000 ms max wait, `(mtimeMs,size)` fingerprint, single-flight; `unsubscribe` closes watchers/timers and is idempotent; `plan-store.dispose` releases watcher + activity feed. Tests cover debounce, burst coalescing, max wait, unchanged fingerprint, poll fallback, re-entrancy, disposal and a real file change. |
| R6 — Current activity | PASS | `activity-adapter.ts` is the only raw-event reader and allowlists 11 event types/fields; `session-activity.ts` validates agent/tool ids and emits fixed summary templates; `activity-feed.ts` throttles to 10 Hz, ignores foreign sessions/locations and disposes subscriptions. Tests assert message bodies, tool input/output, provider errors and secrets are dropped, and that the summary is single-line/≤120 chars. Fallback to the active sub-task + delegated agent is tested. |
| R7 — Packaging/build | PASS | tsdown 4th single-entry build → `dist/tui.js` (291,965 B); `tsconfig` automatic JSX via `@opentui/solid`; `exports["./tui"]` with types → `dist/tui/index.d.ts`; optional peers `@opentui/core`, `@opentui/solid`, `solid-js`; `@opencode/plugin` pinned `2.2.7` with `@opencode/theme` in lockstep; managed installer copies/verifies `dist/tui.js`, publishes `./tui`, lists it in the manifest; pack contract/install smokes require it. Server entries unchanged. |
| R8 — Docs and tests | PASS | README, `docs/LOADING.md` (loading, usage, table, local-only v1 limit, manual verification note), `AGENTS.md` pointer, CHANGELOG Unreleased; 65 test files / 1,085 tests; TUI bundle contract test; full QA gate green; **5 agents + 26 skills unchanged** (no changes under `agents/` or `skills/`, audit PASS). |

## Acceptance Criteria Verification

| AC | Status | Evidence |
|---|---|---|
| AC1 — Sidebar card with active plan; clean none state | PASS (model/bundle); live pixels deferred | Card view model covers ready/selector/empty/error states; `S5` `No active plan`, `S6` `No docs/plans here`, `S6b` `No local workspace`. Live pixel check blocked by no TTY/session (P2 deferral note below). |
| AC2 — Card fields + short-debounce refresh | PASS (model/tests); live refresh deferred | All fields present in `sidebar-model`; watcher tests prove one refresh after 300 ms and real file-change detection. Live card refresh is part of the deferred manual check. |
| AC3 — `/plan-progress` panel, keys, read-only | PASS (model/bundle); live keys deferred | Panel model lists every phase/sub-task/criterion/checklist/review/ledger/update; command opens `dev-harness-skills.plan`; `r`/`f`/`esc` bound; no write path. |
| AC4 — Exactly one active plan, multiple selector, malformed handling, never writes | PASS | Selection algorithm + tests (single, multiple with newest suggestion, pin, stale pin, index fallback, never auto-promote completed/inactive); malformed/none/scan-error states; no writes (grep + depcruise + `O_NOFOLLOW`). |
| AC5 — Activity reflects session, safe fallback, no secrets/content | PASS | Adapter/mapper/feed + tests asserting serialized payloads contain no message/tool content; fixed templates; plan fallback. |
| AC6 — Workspace-root resolution, standalone + monorepo | PASS | `resolvePlanRoot` uses only the injected TUI location; no upward probing; never creates a package-local `docs/plans`; empty state for no workspace/no plans dir; `DH_WORKSPACE_ROOT` mismatch produces a warning (rendering gap = P2-1). |
| AC7 — Source/tarball/managed modes load; installer includes `dist/tui.js`; server smokes green | PASS | Build emits the artifact + declarations; managed install publishes `./tui` and copies `dist/tui.js`; `smoke-install` (4 TUI checks) and `smoke-pack` (3 TUI checks, 388 files) pass; `smoke-load`/`smoke-mcp` pass. Host load of the `./tui` export through the `opentui:runtime-module:*` rewrite was proven at 2.2.7 by the 1.3 probe (API notes §16.2); the final larger artifact is not re-loaded live (deferred manual check). |
| AC8 — Tests + full QA + docs | PASS | All gates in [Release Readiness](#release-readiness) green; docs describe usage/loading/limitation; counts stay 5 + 26. |

## Findings

### [P0] Blocking

None.

### [P1] High — close-gate bookkeeping (no code change requested)

#### P1-1. `plan_fast.md` integrity is stale after the T1 record edit, and its "unchanged" verification copy now differs

- **Location:** `docs/plans/tui-plan-progress/plan_fast.md:6` (`source_sha256: 24ac9a5e…`), `:7` (`plan_version: fast-1`), final-verification block; `docs/plans/tui-plan-progress/plan.md:492-496` (four checkboxes flipped to `[x]` after the mirror was written).
- **Evidence:** `plan.md` was last written at 23:15 (T1 record), `plan_fast.md` at 22:46. `dh_plan_fast_sync { phase: "plan-end", apply: false }` returns `aligned: true`, `differences: []`, **`stale: true`**, with a recomputed hash of `2238f16e517b10d6878d0c2e3c969da3274082afe90a20572b9855ba99351804` vs the declared `24ac9a5e…`. The mirror's copied plan-specific verification still shows all seven items unchecked while `plan.md` now has four checked (`Data-layer tests…`, `pnpm qa:check:full green`, `No new skills/agents…`, `Standalone and workspace plan resolution respected`).
- **Why it matters:** the fast-mode contract treats a stale mirror as a hard stop, and the plan-end alignment evidence in [review-fast-final.md](review-fast-final.md) was produced before the record edit, so it no longer describes the current `plan.md`. The mirror's own claim ("copied from plan.md, unchanged") is currently false.
- **Fix (T3, after all `plan.md` edits):** recopy the plan-specific verification block, bump `plan_version: fast-2`, set `source_sha256` to the recomputed value, then require `dh_plan_fast_sync { phase: "plan-end", apply: false }` → `aligned: true`, `stale: false`. This is the documented record/close-out realignment, not a content change.

#### P1-2. Plan-end gate outcomes were never appended to the fast ledger (end gate 8 unmet)

- **Location:** `docs/plans/tui-plan-progress/plan_fast_skip_checks.md` (only per-task deferral rows plus the six seed rows); [plan_fast.md](../plan_fast.md) Final Verification → End gates item 8.
- **Evidence:** no `run: PASS`, `run: FAIL` or `not applicable` row exists for `dh-review`, `dh-simplify`, `dh-code-review`, `dh-domain-check`, `dh-preflight` or `dh-artifact-check`. The ledger's `unresolved` definition therefore lists all six standard checks, and this plan's own `/plan-progress` panel would display six unresolved checks after close.
- **Why it matters:** Sub-Task 4.4's acceptance criteria include the gate record, and end gate 8 explicitly requires appending every outcome. Leaving them unresolved makes the ledger contradict the green gates in this report.
- **Fix (T3):** append one outcome row per gate via `dh_plan_fast_skip_check` (see [T3 Actions](#t3-actions) for the exact rows).

### [P2] Medium — non-blocking, recommended follow-ups

#### P2-1. `PlanState.warnings` and `selection.truncated` are derived but never rendered

- **Location:** populated in `src/tui/plan-state.ts:76-84`, `src/tui/plan-read.ts:125-130`; consumers absent in `src/tui/components/sidebar-model.ts:148-160`, `src/tui/components/panel-model.ts:139-189`, `src/tui/components/panel-sections.ts:99-113`. Only `state.errors` (error states) and `plan.warnings`/`plan.errors` (ready panel) are rendered.
- **Impact:** `pin-stale` (§11 S9 footnote), `workspace-root-override` (S6b warning), `scan-truncated`, `completed-plan-active`, `slug-mismatch`, `index-malformed`/`index-orphan` can be silently dropped in the ready/selector/empty states (the `no-plans-dir` warning is separately conveyed by the S6 empty-state copy). The worst case is the workspace-root override: the card can show a different plan tree than the `dh` tools use with no visible warning.
- **Fix:** append a compact `Warnings (N)`/`Errors (N)` block (or one-line footnote) to the ready/selector/empty panel, add a one-line hint to the sidebar when `state.warnings.length > 0`, and surface `selection.truncated`.

#### P2-2. Fast-ledger detail rows are parsed but never displayed

- **Location:** `src/tui/plan-review.ts:204-205` (`rowsShown` last 20, `truncated`); `src/tui/components/panel-sections.ts:74-86` prints only `Ledger — N rows · M deferred` and the deferred check names.
- **Impact:** the contract's display budget (§9.3 "Ledger rows displayed 20", §7.3) is dead code; users cannot see a deferred check's scope/reason/disposition, which is the ledger's actual content.
- **Fix:** render up to 20 rows (`check · scope · disposition`, reason clipped) with a `… truncated` marker.

#### P2-3. Binding contract §2/§10.2 says `src/tui` MUST NOT import `plan-io.ts`, but it does

- **Location:** `src/tui/plan-candidate.ts:11` and `src/tui/plan-read-files.ts:8` import `readPlanFile` from `src/tools/plan-io.js`; `.dependency-cruiser.json` deliberately allows `plan-io` with an explanatory comment; [progress-contract.md](../progress-contract.md) §2 and §10.2 still forbid it.
- **Impact:** no runtime impact and no write path (the artifact contains no `appendPlanIndexRow`/`writeFileSync`), but the binding design document and the code disagree, and a future reviewer would read it as a read-only violation. It was P3 in the earlier code review; T2 elevates it because the contract uses MUST NOT and says it is verified by review.
- **Fix (documentation reconciliation preferred, T4):** amend §2/§10.2 to record the reviewed exception (`readPlanFile` only, `O_NOFOLLOW`), or move `readPlanFile` into a read-only helper and point both the tools and the TUI at it.

### [P3] Low

1. **300-line rule:** `src/cli/__tests__/plugin-artifact.test.ts` is **302 lines** (CODE_RULES: "Files stay at or below 300 lines"); trim two lines or split the fixture helpers.
2. **Absolute paths can reach renderers:** `messageOf(fsError)` includes the full path (`plan-read-files.ts:15-17`, used at `plan-read.ts:91,117`, `plan-details.ts:18,44`) and `workspace-root-override` embeds both roots (`plan-read.ts:44-51`), contradicting the invariant in `plan-issue.ts:4-6` and the `ui.format.path` convention.
3. **Alignment verdicts disappear without a ledger:** `panel-sections.ts:75-78` returns before the `fast.alignment` loop when `plan_fast_skip_checks.md` is absent, hiding the pre-execution/plan-end verdicts.
4. **Quoted YAML dates:** `plan-review.ts:59-76` hand-regexes frontmatter; `updated: "2026-11-14"` yields an invalid `Date` and silently falls back to mtime. Use `splitFrontmatter`/`parseYaml` (already bundled).
5. **Refresh telemetry incomplete:** `refresh.pending` is never `true`, manual refresh records `mode: 'none'`, and `durationMs` is never checked against the 250 ms warning (`plan-store.ts:132`, `plan-state.ts:80`, `plan-render-model.ts:77`).
6. **Suggested-plan ordering loses the mtime tie-break:** `selectPlan` re-sorts with `sortCandidates` (updatedAt, slug) after the scan's `updatedAt → mtimeMs → slug` sort (`plan-read.ts:158-162`, `plan-select.ts:98-103,136`), so same-day plans suggest the alphabetically-first rather than the newest. Also a duplicate sort and a per-candidate re-resolve/re-stat (`plan-read.ts:134-147`).
7. **Stale docs:** `tui-api-notes.md` §16.1/§16.2 still records the 966 B spike artifact with two imports, `alwaysBundle: []`, no yaml, and `@opencode/theme@2.0.20` (delivered: 291,965 B, three host imports, bundled `yaml`, 2.2.7); `AGENTS.md` repository layout omits `src/tui/`; `docs/LOADING.md:246,256` still says "opencode v2.0.18" while the version-skew note requires ≥ 2.2.7; the Docker image stays pinned to 2.0.18 and only exercises the server part.
8. **Dependency hygiene:** two `@opentui/core` copies remain (0.8.1 via `@opencode/theme@2.2.7`, 0.9.0 direct) although API notes §16.3 item 5 recommended an override; the `glob`/`minimatch` override widening (`pnpm-workspace.yaml:22-23`, now `glob@>=9.0.0`, `minimatch@>=8.0.0`) is a major jump with no recorded rationale. Build-time only.
9. **`pnpm test` requires `dist/`:** `test/tui-bundle.test.ts` fails on a clean tree (`pnpm clean && pnpm test`) unless built; the full gate orders build before test, and `pnpm install`'s `prepare` builds, so the gate is unaffected — document or add a skip when `dist/tui.js` is absent.
10. **Recompute/duplication:** `PlanPanel` rebuilds the whole body four times per update and `SidebarPlan` computes the card twice (`PlanPanel.tsx:42-49,129-132`, `SidebarPlan.tsx:26,30-31`) — wrap in `createMemo`; `effectiveVerdict`/`currentSubTask` and the date/title/issue/clamp helpers are dead or duplicated (`plan-state.ts:135-148`, `panel-sections.ts:46`, `format.ts:26-39`).
11. **Non-blocking observations:** the 2 s poll also runs while `fs.watch` is attached (`plan-watch.ts:196-197`); the plan root is resolved once at setup, so a session moved elsewhere keeps the original tree (matches the v1 limit); sidebar width reads `renderer.width` through a plain accessor, so a resize may not refresh until the next store change; final-verification checkboxes appear twice (plan checklist + final verification), contract-consistent.
12. **Bookkeeping:** the `docs/plans/index.md` Plans row still reads `Pending`/`Active Yes` while the plan is `In Progress`; finalize at T3 (see below).

## Integration Assessment

- **Cross-sub-task integration:** complete and coherent. 1.1 → API notes; 1.2 → contract; 1.3 → build/peer decisions; 2.1/2.2/2.3 → parser/watcher/activity; 2.4 → fixtures/tests; 3.1/3.2 → view models/components; 3.3 → store/slots/commands/cleanup; 4.1 → tsdown/exports/peers; 4.2 → installer/pack; 4.3 → docs/CHANGELOG. No missing deliverables, no stubs, no orphan modules (dependency-cruiser 71 modules / 167 deps, no violations).
- **Server packaging impact:** none observed. `src/plugin.ts` and `index.ts` changes are comments only; the tsdown base config is untouched; the four entries are built from the same base; `dist/plugin.js` is 200,961 B (same size recorded in the 1.3 spike), and `smoke-load`/`smoke-mcp` are green. The managed installer still imports/scans only the server bundle and size-checks the host-linked TUI artifact; a missing/zero-byte `dist/tui.js` aborts the install **before** staging is swapped in, with an actionable error.
- **Standalone/workspace plan resolution:** `resolvePlanRoot` uses only `context.location.directory`; it never probes upward and never creates `docs/plans`; a package-scoped session shows the empty state (documented v1 limit). This matches AC6 and the workspace contract.
- **Regression risk:** Low. The feature is additive and read-only; optional peers keep server-only installs unchanged; the TUI part cannot mutate `docs/plans`; the full gate is green. Residual risk is the unobserved live pixels (see below) and the P2 visibility gaps.
- **Rollback / recovery:** no migrations or persisted state (`storage.memory` only). Reverting `5dd085f` (and the plan-docs commit `814a8b7`) restores the previous state; `dist/` is generated. A broken TUI part is isolated: the host logs a plugin-operation failure and the server part continues to load (proven by the 1.3 probe), and the installer refuses an empty/missing TUI bundle before touching the target.
- **Secrets:** none in the diff (source, docs, lockfile, reports); the audit reports 0 high-signature secret findings; no `.env`/credential files changed; the activity path is allowlisted and tested against raw-content leaks. Local absolute paths can appear in issue messages (P3-2) but are not secrets.

## Release Readiness

| Gate | Result | Evidence (re-run 2026-11-15) |
|---|---|---|
| `pnpm test` | **PASS** | 65 files / **1,085 tests** passed (also after a fresh build) |
| Typecheck (`tsc --noEmit`) | **PASS** | exit 0; `tsc --emitDeclarationOnly` in the build also passed |
| Biome (`biome check src scripts`) | **PASS** | 161 files, no findings |
| Knip | **PASS** | no unused deps/exports |
| jscpd | **PASS** | 155 files, 0 clones |
| dependency-cruiser | **PASS** | 71 modules / 167 deps, no violations (new `tui-read-only` rule) |
| Link check | **PASS** | 307 references, no dead links |
| OSV-Scanner (Docker) | **PASS** | 668 packages, "No issues found" |
| Semgrep (Docker) | **PASS** | 90 rules, 191 targets, 0 findings |
| `pnpm run audit` | **PASS** | exit 0; 5 agents + 26 skills; 0 secret-high, 0 junk, 0 symlinks |
| `pnpm build` | **PASS** | `dist/plugin.js` 200,961 B; `dist/cli.js` 170,439 B; `dist/mcp/stdio.js` 254,173 B; **`dist/tui.js` 291,965 B**; `dist/tui/index.d.ts` 723 B; assets 5/26 |
| `smoke-load` | **PASS** | valid `Plugin.define` in `dist/plugin.js` |
| `smoke-mcp` | **PASS** | 12 tools, plan/fast round-trips, symlink launch |
| `smoke-install` | **PASS** | includes 4 TUI checks (artifact exists/non-empty, host import, managed `./tui` export) |
| `smoke-pack` | **PASS** | 388 packed files; includes `./tui` export + `dist/tui.js` checks; 5 agents / 26 skills |
| Full `pnpm qa:check:full` | **PASS** | every constituent gate above was re-executed green; matches the T1 "full gate green" claim |

**TUI bundle contract (verified on the built artifact):** static imports are
exactly `@opencode/plugin/tui`, `@opentui/solid/jsx-runtime`, `solid-js` and
`node:crypto|fs|path`; no relative imports, no `require`, no bare `yaml` import
(bundled), no writer symbols (`appendPlanIndexRow`, `writeFileSync`,
`createFastPlan` = 0 occurrences). Size 291,965 B is within the test's 512 KiB
cap. `@opencode/plugin` and `@opencode/theme` are 2.2.7 in the installed tree.

**Live TUI pixel check — blocked, correctly not claimed.** There is no TTY /
interactive opencode session in this environment, so the sidebar card, the
`/plan-progress` panel, live refresh and the actual key bindings were not
observed on screen. The host load path (package `./tui` export resolution and
injection of the bare host specifiers without `node_modules`) was proven at
2.2.7 by the 1.3 spike's deliberate `TUI-SPIKE-PROBE` (API notes §16.2), and the
final artifact imports cleanly under Node with the same host specifiers. The
larger final artifact has not been re-evaluated by a live host. This is a
documented deferral, not a fabricated pass: the T1 record says so, the docs say
so, and the plan's checklist item remains unchecked.

## SemVer Recommendation

- **Current:** `v0.7.0` (`git describe --tags --always` → `v0.7.0-3-g5dd085f`; highest reachable tag `v0.7.0`).
- **Commits since `v0.7.0`:** `814a8b7 docs(plan)`, `5dd085f feat(tui)`, `1318206 Merge main (v0.7.0) back into develop` (merge, no bump).
- **Bump:** **MINOR** — one `feat:` commit, no `BREAKING CHANGE`/`!` commits → **`v0.8.0`**. No tag was created or pushed by this review.
- **Changelog:** `[Unreleased]` is already populated (Added: TUI part/data layer/packaging; Changed: `@opencode/plugin` 2.2.7). At release, rename to `[0.8.0] — <date>` and keep the compare link.

## Fast-Mode Status

- `plan_fast.md` statuses match `plan.md` exactly (Phase 1–3 `Completed`, Phase 4 `In Progress`, 4.4 `In Progress`); `dh_plan_fast_sync` reports `aligned: true, differences: []`.
- **`stale: true`** — the declared `source_sha256` no longer matches the recomputed hash (P1-1), and the copied final-verification checkboxes differ.
- The plan-end gate outcomes are absent from `plan_fast_skip_checks.md` (P1-2).
- The plan-end alignment review [review-fast-final.md](review-fast-final.md) was valid when written (22:49) but predates the T1 record edit (23:15); re-run it after the T3 realignment.

## T3 Actions

Binding close-out sequence (the plan MUST NOT be marked `Completed` until 1–8 are done):

1. **Finalize `## Execution Record`** in `plan.md`: set `Execution status:
   Completed with deferrals` (deferral: the live TUI pixel check; use `Completed`
   only if the user performs the manual session check), keep `Executed at:
   2026-11-15`, and set `Commit range: 814a8b7..5dd085f (implementation;
   close-out commit follows)`.
2. **Finalize the completion checklist** in `plan.md`: check "All 4 phases and
   14 sub-tasks `Completed`" and "Docs/CHANGELOG and execution record/index
   updated"; leave "TUI card and panel render with real plan data and refresh"
   unchecked with an explicit deferral note unless the user runs the manual
   session check (do not claim an unperformed check).
3. **Finalize `docs/plans/index.md`:** change the `tui-plan-progress` Plans row
   to `Completed` / `Active No`, and append one `## Execution Records` row
   **before** the `## Plans` table:
   `tui-plan-progress | workspace: . | docs/plans/tui-plan-progress/plan.md |
   docs/plans/tui-plan-progress/plan_fast.md | <2–5 flattened bullets> |
   <architectural changes> | 2026-11-15`.
4. **Re-align `plan_fast.md`** after all `plan.md` edits: recopy the
   plan-specific verification block (same checkboxes), bump `plan_version:
   fast-2`, set `source_sha256` to the recomputed value, and require
   `dh_plan_fast_sync { phase: "plan-end", apply: false }` →
   `aligned: true`, `stale: false`.
5. **Append the gate outcomes** to `plan_fast_skip_checks.md` via
   `dh_plan_fast_skip_check` (scope `Plan`): `dh-review` `run: PASS` (this
   report; alignment found no differences), `dh-simplify` `run: PASS` (code
   review summary), `dh-code-review` `run: PASS` (no P0/P1), `dh-domain-check`
   `not applicable` (read-only presentation layer over the existing plan domain;
   no new bounded context), `dh-preflight` `run: PASS` (1,085 tests, lint,
   typecheck, scans, smokes), `dh-artifact-check` `run: PASS` (build artifacts +
   package exports + install/pack smoke).
6. **Mark statuses in both files** with `dh_plan_fast_update_status`:
   `4.4 → Completed`, then `Phase 4 → Completed`, then plan-level
   `status: Completed` in `plan.md` and `plan_fast.md`. Re-run the sync dry-run
   and confirm `aligned: true`, `stale: false`, and 18/18 status markers
   `Completed` in both.
7. **Documentation close-out (T4, `dh-create-documentation`):** create
   `docs/evolution/2026-11-15-tui-plan-progress.md` and the observation note
   under `docs/evolution/observations/`, update `docs/evolution/index.md`, and
   link both from the record's `References`.
8. **Release (T4/release):** rename CHANGELOG `[Unreleased]` to `[0.8.0]`,
   update the compare link, and create `v0.8.0` locally only with explicit user
   confirmation (no push/no tag from this review).
9. **Follow-up backlog (non-blocking):** P2-1/P2-2 (warnings + ledger rows
   rendering) and the P3 list; reconcile the contract's `plan-io` exception
   (P2-3) and refresh `tui-api-notes` §16 (P3-7) in the same documentation
   pass.

## Binding Verdict

**Approve with comments.** Implementation, security/privacy, packaging and all
release gates pass; no P0 and no code changes are requested. The two P1 findings
are close-gate bookkeeping that the T3 sequence above resolves without touching
feature code. The plan is **not closable as-is**: complete T3 actions 1–6, then
re-run `dh_plan_fast_sync` (must be `aligned: true`, `stale: false`) before
claiming the plan is `Completed`. Recommended next version: **`v0.8.0`**
(minor; not tagged by this review).
