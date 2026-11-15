# Code Review & Simplify Summary: TUI Plan Progress

**Scope**: full feature diff for `docs/plans/tui-plan-progress/plan.md` — plan
commit `814a8b7` plus the working tree: new `src/tui/` data layer, components and
TUI plugin, `src/tui/index.tsx`, build/package/installer wiring
(`package.json`, `tsdown.config.ts`, `tsconfig.json`, `biome.json`,
`knip`, `.dependency-cruiser.json`, `src/cli/plugin-layout.ts`,
`src/cli/plugin-artifact.ts`, `scripts/*`), `test/tui-bundle.test.ts`, docs and
the `@opencode/plugin` 2.2.7 pin. Untracked files (`src/tui/`,
`test/tui-bundle.test.ts`, the plan docs) were reviewed as part of the diff.
**Overall risk**: Low
**Verdict**: **Approve with comments — no [P0]/[P1] findings; fast-mode gate PASS**

> No code or plan file was modified by this review. The only file written is
> this report. Findings are non-blocking unless marked otherwise.

## Validation Performed

| Gate | Result |
|---|---|
| `pnpm test` (full suite) | 65 files / **1085 tests passed** |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm exec biome check src scripts` | 161 files, no findings |
| `pnpm exec knip` | pass (no unused deps/exports flagged) |
| `pnpm exec jscpd` | 0 clones (155 files) |
| `pnpm exec depcruise src` | 71 modules / 167 deps, no violations |
| `pnpm run audit` | exit 0, 5 agents + 26 skills, 0 secret/junk/symlink findings |
| `pnpm lint:links` | 302 references, no dead links |
| `node scripts/smoke-load.mjs` | pass (`dist/plugin.js` valid `Plugin.define`) |
| `node scripts/smoke-mcp.mjs` | pass (12 tools, plan/fast round-trips, symlink launch) |
| `node scripts/smoke-install.mjs` | pass, incl. the 4 new TUI checks |
| `node scripts/smoke-pack.mjs` | pass, incl. `exports["./tui"]` + `dist/tui.js` checks |
| Secrets scan of diff | no tokens/credentials/secrets found |

Artifact inspection: `dist/tui.js` = 291,965 B; static imports are exactly
`@opencode/plugin/tui`, `@opentui/solid/jsx-runtime`, `solid-js` and
`node:crypto|fs|path`; no relative imports, no `require`, no `duckdb`,
`jsonc-parser` or writer code; `yaml` is embedded (no bare `yaml` import and the
browser build's module markers are present).

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

#### 1. State-level warnings/errors and scan truncation are computed but never rendered

- **Location**: `src/tui/plan-state.ts:76-84` (population of `warnings`/`errors`),
  `src/tui/components/sidebar-model.ts:149-160`,
  `src/tui/components/panel-model.ts:139-189`,
  `src/tui/components/panel-sections.ts:99-113`.
- **Why it matters**: `PlanState.warnings` carries `pin-stale`,
  `workspace-root-override`, `scan-truncated`, `completed-plan-active`,
  `slug-mismatch`, `no-workspace` and index warnings; `PlanState.errors` carries
  `index-orphan`; `selection.truncated` is set by the 200-dir cap. No component
  reads `state.warnings`, and `state.errors` is only read in the `error` state,
  so in the normal `ready`/`selector`/`empty` states these diagnostics disappear.
  The contract explicitly requires the `pin-stale` footnote (§11 S9) and a
  warning in S6b. The worst case is the workspace-root override: the card can
  read a different plan tree than the `dh` tools use, with no visible warning.
- **Evidence**: `grep` over `src/tui/components` finds no `state.warnings` read;
  `panel-sections.ts:110-111` renders only `plan.warnings`/`plan.errors`;
  `plan-model.ts:184` / `plan-select.ts:122` expose `truncated` with no consumer.
- **Fix**: append a compact `Warnings (N)` / `Errors (N)` block (or a one-line
  footnote) to the ready/selector/empty panel, add a one-line hint to the
  sidebar when `state.warnings.length > 0`, and surface `selection.truncated`.

#### 2. Fast-ledger detail rows are parsed but never displayed

- **Location**: `src/tui/plan-review.ts:204-205`,
  `src/tui/components/panel-sections.ts:74-86`.
- **Why it matters**: `LedgerState.rowsShown` (last 20 rows) and `truncated` are
  derived exactly for display (contract §7.3, §9.3 "Ledger rows displayed 20"),
  but `fastLines` only prints the row count and unresolved check names. Users
  cannot see a deferred check's scope/reason/disposition — the ledger's actual
  content — and the display budget is dead code.
- **Evidence**: `rowsShown`/`truncated` have no consumer outside
  `plan-sidecars.ts` and tests; the panel prints
  `Ledger — N rows · M deferred` only.
- **Fix**: render up to 20 rows (`check · scope · disposition`, reason clipped)
  with a `… truncated` marker when `ledger.truncated`.

### [P3] Low

#### 3. Absolute paths can reach the panel through issue messages

- **Location**: `src/tui/plan-issue.ts:4-6` (invariant claim),
  `src/tui/plan-read.ts:49,91`, `src/tui/plan-read-files.ts:34-45`,
  `src/tui/plan-read.test.ts:30-31`.
- **Why it matters**: `plan-issue.ts` states no absolute path can leak into a
  slot renderer, but `messageOf(fsError)` includes the full path
  (`EACCES: …, scandir '/home/<user>/…/docs/plans'`) and
  `workspace-root-override` embeds both roots; `panel-model.errorCopy` and
  `panel-sections.issueLines` render `issue.message` verbatim. This also
  contradicts the `ui.format.path` convention used for `displayPath`.
- **Fix**: keep fs messages path-free, or pass issue messages through a
  display-path formatter at render time.

#### 4. TUI imports the module the contract forbids (`plan-io.ts`)

- **Location**: `src/tui/plan-candidate.ts:11`, `src/tui/plan-read-files.ts:8`;
  `docs/plans/tui-plan-progress/progress-contract.md:68-72,651-654`;
  `.dependency-cruiser.json:12-18`.
- **Why it matters**: contract §2 says `src/tui` **MUST NOT** import `plan-io.ts`
  (the same module that exports `appendPlanIndexRow`), while §10.1 says reads
  must go through `readPlanFile` — which lives there. The new depcruise rule
  deliberately allows `plan-io` and `plan-fast-template`, so the check passes,
  but the binding contract text was never amended. `plan-io.ts` transitively
  imports `plan-template.ts` (a writer module) as well.
- **Fix**: reconcile the contract with the recorded decision (preferred, since
  the rule comment already documents it), or move `readPlanFile` into a
  read-only helper module and point both the tools and the TUI at it.

#### 5. Alignment verdicts disappear when the ledger file is absent

- **Location**: `src/tui/components/panel-sections.ts:74-86`.
- **Why it matters**: `if (!ledger.present) { …; return lines; }` returns before
  the `fast.alignment` loop, so `pre-execution`/`plan-end` verdicts are never
  rendered when `plan_fast_skip_checks.md` is missing, even when
  `tasks/review-fast*.md` exist. Alignment review and ledger are independent
  sidecars.
- **Fix**: render the alignment entries outside the ledger branch.

#### 6. Review/fast date parsing ignores quoted YAML values (reuse `parseFrontmatter`)

- **Location**: `src/tui/plan-review.ts:59-76`.
- **Why it matters**: `fileDate`/`frontmatterValue` hand-regex the raw
  frontmatter instead of using `parseFrontmatter`
  (`src/lib/frontmatter.ts:25`). `updated: "2026-11-14"` yields the quoted string,
  `new Date('"2026-11-14"')` is invalid, and the date silently falls back to
  mtime. It is also a third frontmatter parser in the TUI layer.
- **Fix**: use `parseFrontmatter` (yaml is already bundled) and one shared
  frontmatter accessor.

#### 7. Duplicate derivations and work per refresh

- **Location**: `src/tui/plan-read.ts:134-162`, `src/tui/plan-store.ts:117-133`,
  `src/tui/plan-select.ts:98-103`.
- **Why it matters**:
  - `readPlanScan` sorts twice: `sortCandidates(scan.candidates).sort(...)`; the
    first sort is fully overridden.
  - `plan-store.refresh` calls `selectPlan` once to find `selectedSlug`, then
    `derivePlanState` calls it again with the same inputs.
  - `sortCandidates` re-sorts by `updatedAt`/slug only, discarding the scan's
    `mtimeMs` tie-break; contract §4.4 rule 3 requires
    `updatedAt desc → mtimeMs desc → slug asc` for the "suggested" plan, so
    same-day plans can suggest the alphabetically-first instead of the newest.
  - `readPlanScan` re-runs `resolvePlanPath` (full ACL/symlink walk) +
    `lstatSync` for every candidate just to read `mtimeMs`, although
    `buildCandidate` already stat'ed the same file.
- **Fix**: one sort in the scan (with mtime), pass the computed selection into
  `derivePlanState`, and return `mtimeMs` from `buildCandidate`.

#### 8. Dead/duplicated helpers and copy-paste between sidebar and panel

- **Location**: `src/tui/plan-state.ts:135-148`,
  `src/tui/plan-candidate.ts:91-95,110-114`, `src/tui/plan-select.ts:33-36`,
  `src/tui/plan-progress.ts:43-48`, `src/tui/components/panel-model.ts:75-80`,
  `src/tui/components/panel-sections.ts:46,89-97`,
  `src/tui/plan-issue.ts:64-68`, `src/tui/components/format.ts:26-39`.
- **Why it matters**: `effectiveVerdict` has no production consumer while
  `panel-sections.reviewLines` reimplements the same precedence;
  `currentSubTask` is only exercised by tests; `normalizeDate`, `titleOf`, the
  issue-row format and the whitespace clamp each exist twice.
- **Fix**: use `effectiveVerdict` in `reviewLines`, wire or remove
  `currentSubTask`, and centralize the date/title/issue/clamp helpers.

#### 9. Panel rebuilds the full body four times per update

- **Location**: `src/tui/components/PlanPanel.tsx:42-49,129-132`,
  `src/tui/components/SidebarPlan.tsx:26,30-31`.
- **Why it matters**: each text node calls `model()`, so `panelModel` →
  `planBody` (all phases, sub-tasks, checklists, issues) runs four times per
  re-render; the sidebar computes `card()` twice. Activity can update at 10 Hz.
  The strings are bounded, so impact is small, but the work is pure waste.
- **Fix**: wrap `model()`/`card()` in `createMemo`.

#### 10. Refresh telemetry fields are incomplete

- **Location**: `src/tui/plan-render-model.ts:77`, `src/tui/plan-state.ts:80`,
  `src/tui/plan-store.ts:132-137`.
- **Why it matters**: contract §9.2 defines `pending: true` for the single-flight
  follow-up and §9.3 a `> 250 ms` warning; `pending` is never set, `mode` records
  `'none'` for a manual refresh, and `durationMs` is recorded but never checked.
- **Fix**: set `pending` from the watcher/dirty flag, distinguish manual vs
  initial mode, and surface the slow-refresh warning.

#### 11. Docs/QA consistency after the 2.2.7 bump

- **Location**: `docs/plans/tui-plan-progress/tui-api-notes.md:607,623,629-635`;
  `AGENTS.md:202-211`; `docs/LOADING.md:82,246,256,409,444` vs `:453`;
  `AGENTS.md:211,234`.
- **Why it matters**: notes §16.2 still says `dist/tui.js` is 966 B with exactly
  two imports and `@opencode/theme@2.0.20`; the artifact is 291,965 B with three
  imports (adds `solid-js`) and theme 2.2.7. The AGENTS repository layout omits
  `src/tui/`. The Docker image and LOADING verification still say v2.0.18 while
  the version-skew section now requires host opencode ≥ 2.2.7.
- **Fix**: refresh the notes/layout and state that the Docker 2.0.18 image only
  exercises the server part, or bump the image.

#### 12. Dependency hygiene

- **Location**: `pnpm-workspace.yaml:22-23`; `package.json` devDeps.
- **Why it matters**: two `@opentui/core` copies remain (0.8.1 via
  `@opencode/theme@2.2.7`, 0.9.0 direct) although `tui-api-notes` §16.3 item 5
  recommended an override when theme was bumped; typecheck passes and the host
  injects its own runtime copy, so this is build-time only. The glob/minimatch
  overrides were widened to force 14/11 on any 8/9 consumer — a major jump whose
  reason is not recorded (no shipped artifact imports them).
- **Fix**: add the recommended `pnpm` override (or record why it is
  unnecessary), and document the override widening.

#### 13. Test duplication and gaps

- **Location**: `src/tui/__tests__/helpers.ts:105-119`,
  `src/tui/__tests__/plan-state.test.ts:24-44`,
  `src/tui/__tests__/activity-feed.test.ts:16-29`,
  `src/tui/__tests__/sidebar-model.test.ts:89-98,112-121,149-162,169-197,210-219`.
- **Why it matters**: four different builders produce a `PlanState`, and the
  same `fixture('active-plan.md').replace(...)` completed/pending mutations are
  repeated across suites; it makes model changes expensive. There is no
  assertion that `state.warnings`/`state.errors` are rendered (the P2 gap), no
  ledger `rowsShown` test, and no quoted-date/CRLF parser test. Component bodies
  remain manual-only, which the plan documents.
- **Fix**: consolidate on `helpers.stateOf`, add `completedPlan()` /
  `pendingPlan()` fixtures, and add the missing view-model assertions.

## Non-blocking Observations (no gate action)

- The poll interval starts even when `fs.watch` attached
  (`plan-watch.ts:196-197`). Contract §9.2 says both "always keep a poll
  fallback" and "poll interval when watching is unavailable"; the current choice
  is defensible (network filesystems) but stats the tree every 2 s. Consider a
  longer interval when watching is active.
- The plan root is resolved once at setup (`plan-store.ts:80-81`); a session
  moved to another location keeps the original tree. This matches the documented
  local-only v1 limit.
- Sidebar width reads `context.renderer.width` through a plain accessor, so a
  terminal resize may not refresh the card until the next store change.
- `checklists.plan` includes final-verification checkboxes, so the panel lists
  those twice (plan checklist + final verification). This matches contract §6.2
  but is visually redundant.

## Security / Privacy

- **No secrets** in the diff (source, docs, lockfile, reports).
- Activity path is privacy-safe: `activity-adapter.ts` allowlists fields,
  `session-activity.ts` validates agent/tool ids and uses fixed summary
  templates; message bodies, tool input/output, provider errors and
  after-the-fact conditions are dropped (verified by tests that assert serialized
  payloads do not contain the raw content).
- Path traversal: slugs come from `readdir`, `resolvePlanPath` rejects `..` and
  separators, `assertNoSymlinks` + `O_NOFOLLOW` are used, and a symlinked
  `plan.md` is rejected by test.
- Read-only: no `fs` write API, no `storage.store`, no session mutators in
  `src/tui`; the installer scan remains server-only and the TUI artifact is
  never imported/bare-scanned by Node smokes.
- The only privacy-invariant gap is the absolute-path issue messages (P3 #3).

## Packaging / Installer Invariants (verified)

- **Server artifacts unaffected**: `src/plugin.ts` and `index.ts` changes are
  comments only; the tsdown base config is untouched; `smoke-load` and
  `smoke-mcp` pass. The plan’s 1.3 note records the server bundles as
  byte-identical to `814a8b7`.
- **TUI bundle is host-only/external**: exact imports
  `@opencode/plugin/tui`, `@opentui/solid/jsx-runtime`, `solid-js`, node
  builtins; no relative imports; `yaml` bundled; no writer code; no `require`.
- **Export**: `exports["./tui"]` → `dist/tui.js` with
  `types: ./dist/tui/index.d.ts`; both exist, and the self-reference import
  (`dev-harness-skills/tui`) resolves.
- **Managed installer**: `requireBuiltLayout` requires a non-empty
  `dist/tui.js`; the staged copy is size-checked; the managed `package.json`
  publishes `./tui`; the manifest lists `dist/tui.js`; `prepare.mjs`,
  `pack-contract.mjs`, `install-smoke-checks.mjs` and `pack-install.mjs` all
  include it; both install smokes pass.
- **Dependency pin**: `@opencode/plugin` exact `2.2.7`, `@opencode/theme`
  `2.2.7`; `src/__tests__/package-manifest.test.ts` enforces both the exact pin
  and the installed version.

## Suggested Next Steps

- [x] No P0/P1 findings — the fast-mode gate can record **PASS**.
- [ ] Decide whether the two P2 findings are fixed now or recorded as a
      follow-up sub-task (both are non-blocking).
- [ ] Reconcile the progress contract with the `plan-io`/`readPlanFile` decision
      (P3 #4) so the binding document matches the code.
- [ ] Fill `## Execution Record` (T1/T2/T3) and the `docs/plans/index.md` row at
      Step 7; re-run the full gate after any fix.
