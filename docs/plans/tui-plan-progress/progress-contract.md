---
title: Progress and Activity Contract — TUI Plan Progress
slug: tui-plan-progress-progress-contract
description: Normative contract for the read-only PlanProgress/PlanState model, active-plan selection, checklist/review/ledger derivation, session activity mapping, refresh semantics and empty/multiple/malformed states for the dev-harness-skills TUI part.
tags: [contract, tui, plans, progress, activity, read-only]
project: dev-harness-skills
plan: docs/plans/tui-plan-progress/plan.md
sdd: docs/plans/tui-plan-progress/sdd.md
api_notes: docs/plans/tui-plan-progress/tui-api-notes.md
created: 2026-11-15
updated: 2026-11-15
status: active
---

# Progress and Activity Contract — TUI Plan Progress

Sub-task 1.2 deliverable (R2, R3, R4, R6). It fixes the pure data model the TUI
renders, so 2.1 (parser), 2.2 (watch), 2.3 (activity), 2.4 (fixtures) and 3.x
(components/wiring) implement without guessing.

**MUST** statements are binding. **SHOULD** is a default overridable only by an
explicit, recorded decision. **MUST NOT** statements are verified by review and
by tests.

Read alongside [`plan.md`](plan.md), [`sdd.md`](sdd.md),
[`tui-api-notes.md`](tui-api-notes.md) (cited as **notes §N** — every session
API used here is `[verified]` there) and
[`../harness-monorepo-awareness/workspace-contract.md`](../harness-monorepo-awareness/workspace-contract.md)
(cited as **WC §N**).

## 1. Evidence base

`[verified]` in this repository on 2026-11-15:

| ID | Evidence | Consequence for this contract |
|---|---|---|
| E1 | **Two** plans have `active: true`: `npx-install-entrypoint` (`status: Pending`, `updated: 2026-10-21`) and `tui-plan-progress` (`status: In Progress`, `updated: 2026-11-15`). `docs/plans/index.md` also lists both with `Active = Yes` | Multiple-active is the **normal** state, not an edge case; the selector + suggestion path (§4.4) is the primary path today |
| E2 | `dev-harness-v2-plugin/plan.md` has **no** `## Phases` section (pre-phased legacy plan); 8 of 9 plans are phased | "Plan file exists but is not a phased plan" is a real malformed case (§3.1 `not-a-phased-plan`) |
| E3 | `docs/plans/index.md` says `tui-plan-progress` is `Pending` while the plan frontmatter says `In Progress` | Frontmatter outranks the index; the index is a **fallback only** (§4.5) |
| E4 | Checkbox continuation lines are indented **6 spaces** in `harness-monorepo-awareness/plan.md:635-644`; `Completion Checklist` is sometimes inline prose with no checkboxes (`agent-selection-utility-skills/plan.md:308`) | Continuation and inline-text rules in §6 are mandatory, not cosmetic |
| E5 | `tasks/review.md` verdict spellings differ across plans: `**Verdict:** X`, `**Verdict: X**`, `**Verdict**: X`, plus `# Sub-Task Review`, `# Final Plan Review`, `# Review — …` H1s | Verdict parsing is tolerant + last-match-wins (§7.1) |
| E6 | `parsePlan` throws on missing `## Phases`, unknown statuses, orphan sub-tasks (`src/tools/plan-lifecycle.ts:135-143,81-87,200`) | The TUI must convert throws into `PlanIssue` values, never into a crashed slot (§3.3) |

No new plan field is introduced. The parser contract in
[`skills/dh-planning/references/phased-plan-template.md`](../../../skills/dh-planning/references/phased-plan-template.md)
stays authoritative and unchanged.

## 2. Layering and module boundary

Three layers, strictly ordered; only the middle one touches the filesystem and
only the last one renders.

```text
plan-read.ts   (fs, read-only)  →  PlanScan / PlanDetails
plan-state.ts  (pure)           →  PlanSelection → PlanProgress → PlanState
components     (Solid/OpenTUI)  →  render PlanState from context.storage.memory
```

- **MUST** keep derivation pure: `plan-state.ts` receives file **contents** and
  an injected `now: string`; it performs no `fs`, `process`, `Date.now()` or
  renderer access (unit-testable with in-memory fixtures).
- **MUST** keep the model independent of Solid/OpenTUI: no JSX, no signals, no
  `context` values in `PlanState`. Components consume a plain immutable object.
- **MUST** reuse the existing parser instead of re-implementing it:
  `parsePlan` (`src/tools/plan-lifecycle.ts`), `splitFrontmatter`
  (`src/lib/frontmatter.ts`), and `computeSourceSha256`
  (`src/tools/plan-fast-template.ts`).
- **MUST NOT** import writer modules into `src/tui/`: `atomic-write.ts`,
  `plan-io.ts` (`appendPlanIndexRow`), `plan-template.ts`, `plan-fast.ts`
  (`createFastPlan`, `updateFastStatus`, `appendSkipChecks`),
  `plan-fast-sync.ts`, `sheet-tools.ts`, `logged-command.ts`. `plan-lifecycle.ts`
  is allowed (pure parse/edit helpers; the TUI imports only `parsePlan` and the
  exported types).
- **SHOULD** respect the 300-line code-file rule by splitting internals
  (`plan-model.ts` types, `plan-select.ts`, `plan-checklists.ts`,
  `plan-review.ts`, `plan-read.ts`) behind `plan-state.ts` as the public entry.
- Bundling note for 4.1: `plan-lifecycle.ts` imports `yaml` (`^2.9.1`, a runtime
  dependency), so `yaml` ships inside `dist/tui.js`; no other server-only
  dependency may be pulled in.

## 3. Data model

### 3.1 `PlanState` (store snapshot)

One object in `context.storage.memory` (notes §8: object value, synchronous
updater). It is the **only** thing components read.

| Field | Type | Notes |
|---|---|---|
| `status` | `'loading' \| 'ready' \| 'selector' \| 'empty' \| 'error'` | Render discriminant; see §11 |
| `reason` | `'ready' \| 'pinned' \| 'multiple' \| 'index' \| 'empty' \| 'no-plans-dir' \| 'no-workspace' \| 'plan-error' \| 'scan-error' \| 'loading'` | Machine key for empty/error copy; never user prose |
| `workspaceRoot` | `string \| null` | Absolute; display only through `ui.format.path` (notes §11) |
| `plansDir` | `string \| null` | `<workspaceRoot>/docs/plans` |
| `selection` | `PlanSelection` | §3.2 |
| `plan` | `PlanProgress \| null` | Non-null iff `status === 'ready'` |
| `activity` | `Activity` | §3.5; always present (fallback filled) |
| `sessionID` | `string \| null` | Last session reported by a slot render |
| `errors` | `PlanIssue[]` | Global (root/plans dir/index) — never `null` |
| `warnings` | `PlanIssue[]` | Non-fatal issues (malformed non-selected candidate, stale pin, override mismatch) |
| `revision` | `number` | Monotonic; increments on every successful derive (component memo key) |
| `refreshedAt` | `string` | ISO-8601 UTC of the last completed derive |
| `refresh` | `{ mode: 'watch' \| 'poll' \| 'none'; pending: boolean; durationMs: number }` | Observability for 2.2/3.3, not rendered in v1 |

Stored as `{ state: PlanState }` under the memory key
`dev-harness-skills.plan-progress.state`; UI-only state (pin, panel cursor)
lives in a separate key `dev-harness-skills.plan-progress.ui` (§3.6).

### 3.2 `PlanSelection`

| Field | Type | Notes |
|---|---|---|
| `mode` | `'pinned' \| 'single-active' \| 'index' \| 'multiple' \| 'none'` | How the plan was chosen |
| `source` | `'pin' \| 'frontmatter' \| 'index' \| 'none'` | Where the winning signal came from |
| `selectedSlug` | `string \| null` | Exactly one, or `null` |
| `suggestedSlug` | `string \| null` | When `mode === 'multiple'`: the newest valid candidate (§4.4) |
| `pinnedSlug` | `string \| null` | Echo of the user's explicit choice, if any |
| `candidates` | `PlanCandidate[]` | Every candidate that qualifies as active (frontmatter or index); sorted `updatedAt` desc, then `mtimeMs` desc, then `slug` asc |
| `scanned` | `number` | Candidate directories examined (cap 200) |
| `truncated` | `boolean` | Scan hit the cap → warning `scan-truncated` |

`PlanCandidate` = `{ slug, title, path, status, active, updatedAt, valid, issue }`
where `path` is workspace-relative (`docs/plans/<slug>/plan.md`), `status` is
`'Pending' | 'In Progress' | 'Completed' | 'Unknown'`, `active` is
`boolean | null` (`null` = key absent), `valid` is the selection-pass parse
result, and `issue` is the parse issue when `valid === false`.

### 3.3 `PlanIssue`

```ts
type PlanIssueCode =
  | 'no-workspace' | 'no-plans-dir' | 'plans-dir-unreadable' | 'plan-missing'
  | 'plan-unreadable' | 'file-too-large' | 'frontmatter-malformed'
  | 'not-a-phased-plan' | 'invalid-status' | 'orphan-subtask'
  | 'empty-delegated-agent' | 'slug-mismatch' | 'phase-status-mismatch'
  | 'mirror-status-mismatch' | 'completed-plan-active' | 'index-malformed'
  | 'index-orphan' | 'review-malformed' | 'ledger-malformed'
  | 'workspace-root-override' | 'pin-stale' | 'session-unavailable'
  | 'scan-truncated';

interface PlanIssue {
  code: PlanIssueCode;
  severity: 'error' | 'warning';
  file: string | null;   // workspace-relative, e.g. 'docs/plans/<slug>/plan.md'
  message: string;       // single line, <= 200 chars, no stack, no file content
}
```

- **MUST** convert every thrown parser error into a `PlanIssue`
  (`code` from the error text prefix, `message` = the thrown message truncated to
  200 chars with `\s+` collapsed). A slot renderer MUST NOT receive a thrown
  error.
- **MUST** strip the absolute workspace-root prefix from `message` (replace with
  the relative path) so no home-directory path leaks into the UI.
- **MUST NOT** include file contents, YAML excerpts, provider strings or stack
  traces in `message`.

### 3.4 `PlanProgress` (selected plan)

| Field | Type | Source |
|---|---|---|
| `slug` | `string` | Directory name (authoritative); frontmatter `slug` mismatch → warning `slug-mismatch` |
| `title` | `string` | Frontmatter `title` → `# Plan:` H1 → slug |
| `path` | `string` | `docs/plans/<slug>/plan.md` |
| `absPath` | `string` | Resolved through the plan ACL (§4.1) |
| `status` | `'Pending' \| 'In Progress' \| 'Completed'` | Frontmatter `status` → index `Status` → `Pending` + warning |
| `active` | `boolean` | Frontmatter `active` (absent → `false`) |
| `updatedAt` | `string` | `YYYY-MM-DD`: frontmatter `updated` → index `Updated` → `mtime` |
| `updatedSource` | `'frontmatter' \| 'index' \| 'mtime'` | Provenance of `updatedAt` |
| `phases` | `PhaseProgress[]` | `parsePlan` result, order preserved |
| `counts` | `{ phases: StatusCounts; subTasks: StatusCounts }` | §5.2 |
| `progress` | `{ ratio: number; percent: number }` | §5.4 — sub-task denominator |
| `current` | `CurrentPosition` | §5.3 |
| `checklists` | `{ plan: Checklist; finalVerification: Checklist }` | §6 |
| `review` | `ReviewState` | §7.1 |
| `fast` | `FastState` | §7.2–7.4 |
| `errors` | `PlanIssue[]` | Plan-scoped errors (parse, review, ledger) |
| `warnings` | `PlanIssue[]` | Plan-scoped warnings |

`PhaseProgress` = `{ index, title, status, subTasks, counts, line }`;
`SubTaskProgress` = `{ index, title, status, delegatedTo, relatedRequirements,
criteria, checkboxes, line }` where `index` is the canonical `"N.M"` string,
`delegatedTo` is `string | null` (legacy plans), `criteria` is
`{ kind: 'done-when' | 'acceptance'; text }[]` (max 2, 200 chars each) and
`checkboxes` are the checkbox items inside that sub-task section.

### 3.5 `Activity`

| Field | Type | Notes |
|---|---|---|
| `status` | `'idle' \| 'running' \| 'retrying' \| 'unknown'` | `unknown` = no session signal at all |
| `agent` | `string \| null` | Validated agent id (§8.4) |
| `agentSource` | `'session' \| 'plan' \| null` | `plan` = fell back to the active sub-task's `Delegated to agent` |
| `tool` | `string \| null` | Tool **name** only, never input/output |
| `summary` | `string` | One line, `<= 120` chars, built from fixed templates (§8.4) |
| `source` | `'session' \| 'plan-fallback'` | Which layer produced the line |
| `sessionID` | `string \| null` | |
| `stale` | `boolean` | `running`/`retrying` with `updatedAt` older than 5 min |
| `updatedAt` | `string` | ISO-8601 UTC |

### 3.6 UI-only state (not part of the model)

`context.storage.memory("dev-harness-skills.plan-progress.ui", { initial: {
pinnedSlug: null, panelCursor: 0 } })`. `pinnedSlug` is the user's explicit
choice from the selector; `panelCursor` belongs to 3.2. Neither is ever written
to disk (`storage.store` MUST NOT be used — it persists, §10).

## 4. Plan root and active-plan selection

### 4.1 Plan root

```text
root      = context.location?.directory ?? context.data.location.default().directory   // notes §4, §9
plansDir  = path.join(path.resolve(root), 'docs', 'plans')
```

- **MUST** resolve the root from the TUI location only. A session must start at
  the workspace root (`WC A1`); the TUI is a reader of that root, not a
  discoverer of one.
- **MUST NOT** walk up parent directories looking for `docs/plans`, `AGENTS.md`,
  a workspace map or a git toplevel. Downward/upward probing would mask a
  session that started in a package (`WC §6.2`) — the correct read-only outcome
  is the empty state (§11 S6), never a silently different plan tree.
- **MUST NOT** create `docs/plans` in any package (`WC §3.2`), and **MUST NOT**
  derive affected packages from the process cwd (`WC A8`); this contract never
  reads `## Workspace Impact` for selection or counts.
- **MUST NOT** follow symlinks on the plan chain: every read goes through
  `readPlanFile` (`O_NOFOLLOW`) and `assertNoSymlinks` / `resolvePlanPath`
  (`src/tools/plan-paths.ts`), exactly like the `dh` tools.
- `DH_WORKSPACE_ROOT` is **not** an input to resolution. If
  `process.env.DH_WORKSPACE_ROOT` is readable, absolute, and realpath-differs
  from `root`, the derive emits warning `workspace-root-override` naming both
  paths (`WC §6.1` style) and keeps reading `root` — read-only inspection under
  mismatch is the only authorized behavior (`WC §6.3`). If `process.env` is
  unavailable (non-Bun host), the check is skipped.
- Missing `root` → `status: 'empty'`, `reason: 'no-workspace'`, warning
  `no-workspace` (a remote session legitimately has no local workspace; do not
  shout).

### 4.2 Candidate enumeration

- **MUST** enumerate direct child directories of `plansDir` containing a
  `plan.md`. `index.md` and dot-directories are skipped; a directory with only
  `plan_fast.md` is not a plan.
- Cap **200** directories; on overflow, stop, set `selection.truncated = true`
  and add warning `scan-truncated`.
- Per-file cap **1 MiB** for `plan.md` (real plans are ~40–60 KB); over cap →
  error `file-too-large`, candidate `valid: false`. Sidecar caps: `tasks/*.md`
  and `plan_fast_skip_checks.md` **512 KiB**.
- A read failure on one candidate MUST NOT abort the scan: record
  `plan-unreadable` and continue.

### 4.3 Selection keys (frontmatter)

Read from `splitFrontmatter` + `yaml` via the existing `parseMeta` semantics
(`src/tools/plan-lifecycle.ts:89-98`); frontmatter is **optional** (legacy
plans).

| Key | Accept | Absent | Invalid |
|---|---|---|---|
| `active` | boolean; strings `"true"`/`"false"` accepted case-insensitively | `null`, treated as not active | warning `frontmatter-malformed` on the value, treated as `null` |
| `status` | `Pending` \| `In Progress` \| `Completed` (case-sensitive, trimmed) | falls back to the index `Status` column | candidate `status: 'Unknown'`; the selected plan then uses index `Status`, else `Pending` + warning `invalid-status` |
| `updated` | `YYYY-MM-DD` or full ISO (first 10 chars used) | falls back to index `Updated`, then `mtime` | `updatedAt` falls back to `mtime`, `updatedSource: 'mtime'` |
| `slug` | string | directory name | mismatch vs directory name → warning `slug-mismatch`, directory name wins |
| `title` | string | `# Plan:` H1, then slug | — |

A `Completed` plan with `active: true` (stale frontmatter) MUST be excluded from
the active set and reported as warning `completed-plan-active` — a finished plan
is never the progress target.

### 4.4 Selection algorithm (deterministic)

Apply in order; the first rule that yields a plan wins.

1. **Pin.** `pinnedSlug` set and a candidate exists and is `valid` →
   `mode: 'pinned'`, `source: 'pin'`. If the pinned candidate exists but is
   invalid → `status: 'error'` (`reason: 'plan-error'`) with that candidate's
   issue, and the selector is still offered. If the pin no longer exists → clear
   it, emit warning `pin-stale`, continue to rule 2.
2. **Single active.** Exactly one valid candidate with `active === true` →
`mode: 'single-active'`, `source: 'frontmatter'`.
3. **Multiple active.** ≥ 2 valid candidates with `active === true` →
`mode: 'multiple'`, `selectedSlug: null`, `suggestedSlug` = the first entry of
`candidates` (sort key: `updatedAt` desc → `mtimeMs` desc → `slug` asc). The
rendered state is `selector` (§11 S3) with the suggestion highlighted. This is
the **current** repository state (E1) and the primary path; the TUI MUST NOT
silently pick one.
4. **Index fallback.** No candidate is active (or all active candidates are
   invalid) and `docs/plans/index.md` `## Plans` has exactly one row with
   `Active = Yes` whose slug resolves to a valid candidate → `mode: 'index'`,
   `source: 'index'`. Index rows pointing at missing plans are skipped with
   error `index-orphan`; several index-active rows behave like rule 3
   (`mode: 'multiple'`, `source: 'index'`).
5. **None.** Otherwise → `mode: 'none'`, `selectedSlug: null`,
   `status: 'empty'`, `reason: 'empty'`.

Ordering rationale: an explicit user choice (pin) beats an author declaration
(frontmatter), which beats a derived table (index) — and a plan that is merely
`Pending`/`In Progress` without `active` is never auto-promoted. Auto-selecting
"the most recently updated In Progress plan" was rejected: it would flip the
card between plans mid-session and hide the ambiguity (E1).

### 4.5 Index fallback parsing

- Locate the `## Plans` heading, then the first following table; map columns by
  header name (`Title`, `Slug`, `Description`, `Created`, `Updated`, `Status`,
  `Active`), not by position, so column reordering does not break parsing.
- Accept `Active` ∈ {`Yes`, `No`, `true`, `false`} case-insensitively; unknown →
  warning `index-malformed`, row ignored.
- Unescape `\|` → `|` in cells; trim; ignore rows whose `Slug` cell is empty.
- The index is **never** authoritative for structure, counts, current position,
  checklists or review — only for `active`, and as a fallback for `status` /
  `updated`. E3 proves why (index says `Pending`, frontmatter says `In Progress`).
- `## Execution Records` is a different table and MUST be ignored by this
  parser.

## 5. Progress derivation

### 5.1 Inputs

`parsePlan(contents, relPath)` on the selected `plan.md` only (candidates are
frontmatter-parsed only). Its throws map to issues per §3.3:
`not a phased plan…` → `not-a-phased-plan`; `invalid status 'X'` →
`invalid-status`; `orphan sub-task` → `orphan-subtask`; `empty Delegated to
agent marker` → `empty-delegated-agent`.

### 5.2 Counts

`StatusCounts = { total, completed, inProgress, pending }`, computed from the
parsed statuses (never from text scanning of the file):

- `counts.subTasks` over all sub-tasks; `counts.phases` over all phases;
  `PhaseProgress.counts` over that phase's sub-tasks.
- Statuses are exhaustive by construction (`parsePlan` rejects any other value),
  so `completed + inProgress + pending === total` always holds. A plan that fails
  to parse yields no `PlanProgress` and therefore no counts — never partial ones.
- `counts` MUST NOT be recomputed from checkboxes or from the index row.

### 5.3 Current position

Lifecycle-aligned (`phased-plan-template.md` "Phase lifecycle"):

```text
phase = first phase with status === 'In Progress'
if none: phase = first phase with status === 'Pending'          → source 'next-pending'
if none: phase = null                                            → source 'done' when all Completed
subTask = first sub-task in `phase` with status === 'In Progress'
          else first sub-task in `phase` with status === 'Pending'
          else null                                              (phase has no open work)
```

- `current.label` renders `Phase 2 · 2.2` / `Phase 2` / `Completed` / `No plan`.
- `current.position` is the `"N.M"` ref or `null`.
- `source: 'in-progress'` marks work actually started; `'next-pending'` MUST be
  labelled "Next" by the UI (3.1/3.2), never "Active" — a not-yet-started plan
  is not running.
- Inconsistent state (phase `Pending` but a sub-task `In Progress`) is accepted,
  selecting that sub-task (resume semantics) plus warning
  `phase-status-mismatch`.

### 5.4 Progress ratio and text bar

- `progress.ratio = counts.subTasks.total === 0 ? 0 : round4(completed / total)` over
  **sub-tasks**; `progress.percent = Math.round(ratio * 100)`. Phases are not the
  denominator (they complete in lumps and would jump); the panel shows phase
  counts separately. `round4` = `Math.round(v * 1e4) / 1e4` (stable snapshots).
- Bar rendering (component rule, so both card and panel agree):
  `filled = Math.round(ratio * cells)`, `cells` default **10**, sidebar minimum
  **4** at narrow widths; glyphs `█` (filled) / `░` (empty), ASCII `#` / `-` for
  snapshot tests or when a caller passes `ascii: true`.
- The `completed/total` label MUST be rendered next to the bar; glyphs and color
  are never the only signal (R2).

## 6. Checklist derivation (no new plan fields)

### 6.1 Grammar

- Checkbox line: `/^(\s*)- \[([ xX])\]\s+(.*)$/` — indentation allowed, `[x]` and
  `[X]` both mean checked.
- **Continuation:** following lines that are non-blank, are not a heading, are
  not a new bullet (`^\s*- `), and are indented deeper than the checkbox bullet
  join the item text with a single space (E4: 6-space continuations are real).
  This is why a simple line-regex checklist would truncate real plans.
- Item `text` is trimmed and capped at **200** chars (ellipsis `…`); `id` is
  `"<relPath>#L<line>"`; `line` is 1-based; `section` is the nearest preceding
  `## ` heading text (`''` before the first); `subTaskIndex` is the enclosing
  `#### Sub-Task N.M` ref or `null`.
- Item `kind`: `'checkbox'` for real checkboxes, `'done-when'` /
  `'acceptance'` for field criteria (§6.3) with `checked: null`.
- Scoping MUST reuse the parser's heading grammar — `^##\s+`, `^###\s+Phase\s+N:`,
  `^####\s+Sub-Task\s+N\.M:` — so a checkbox's `section`/`subTaskIndex` always
  agrees with the phase and sub-task it is rendered under. Do not infer scope
  from indentation alone.

### 6.2 Grouping

| Output | Rule |
|---|---|
| `checklists.plan` | **Every** checkbox in `plan.md` (all sections), in document order |
| `checklists.finalVerification` | Checkboxes inside the `## Final Integration & Verification` section: those nested under the `- **Completion Checklist:**` bullet, **or** top-level (indent 0) checkboxes in that section |
| `SubTaskProgress.checkboxes` | Checkboxes whose `subTaskIndex` equals that sub-task |
| `checklists.finalVerification.inlineText` | When `- **Completion Checklist:**` carries inline prose and has no checkbox children (E4), that prose (200 chars) with `items: []` |

- `Checklist = { items, total, checked, truncated, inlineText }`;
  `total`/`checked` count only `kind === 'checkbox'` items; `truncated` is `true`
  when the cap dropped items.
- Cap: **50** items per `Checklist` (first 50 in document order), **200**
  characters per item. Never truncate silently — set `truncated`.
- Section matching is exact after collapsing whitespace; a plan that names the
  section differently still contributes its checkboxes to
  `checklists.plan` (`section` carries the real title) but leaves
  `finalVerification` empty. No fuzzy heading matching.

### 6.3 Current sub-task criteria

From the selected `current.subTask` section, extract the field bullets
`- **Done When:**` and `- **Acceptance Criteria:**`, continuation-joined per
§6.1, capped at 200 chars each, emitted as `criteria` on that
`SubTaskProgress` (max 2 entries). They render as unchecked criteria
(`checked: null`), never as satisfied items. Prose is **not** split on `;` — a
criterion is one field value, because splitting invents structure the plan does
not declare.

- Missing fields → empty `criteria` (legacy plans) and no error.
- The panel MUST render them under the "Criteria" group of the current sub-task;
  the sidebar MAY render `current` only (§11).

## 7. Review, fast mirror and ledger derivation

All three are **read-only sidecars** of the selected plan. Missing files are
normal (`present: false`), never errors.

### 7.1 `tasks/review.md` → `ReviewState`

- Path: `docs/plans/<slug>/tasks/review.md`. `review-phase*.md` and other
  ad-hoc review files are **out of scope for v1** (documented limitation).
- Verdict line — tolerant match (E5), case-insensitive:
  `/^\s*(?:[-*]\s+)?(?:\*\*|__)?Verdict(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.+?)\s*$/`
  which covers `**Verdict:** X`, `**Verdict: X**`, `**Verdict**: X`.
- **Last** match in the file wins (a `review.md` may concatenate sub-task reviews
  and end with the final sign-off; `dh-final-review` writes the sign-off last).
- Normalization: strip `**`/`__`/trailing `.`; prefix-match against the enum in
  longest-first order (`approve with comments` → `Approve with comments`,
  `request changes` → `Request changes`, `approve` → `Approve`); anything else →
  `verdict: null`, `verdictRaw` kept, issue `review-malformed` (warning).
- `verdictRaw` keeps the first 120 chars of the matched value (e.g.
  `Approve — no P0/P1 findings`), rendered as secondary text only.
- `scope`: `'final'` when the file's first H1 contains `Final Plan Review` or a
  `## Sign-off Verdict` heading exists; `'subtask'` when the first H1 contains
  `Sub-Task Review`; `'mixed'` when several `Verdict` lines exist; else
  `'unknown'`.
- Also read (first match each): `**Reviewed against:**` → `reviewedAgainst`
  (120 chars), `**Overall risk:**` → `risk` ∈ {`High`,`Medium`,`Low`}.
- `updatedAt`: frontmatter `updated` → file `mtime` ISO.

### 7.2 Fast mirror → `FastState`

- `plan_fast.md` present? `stale` = stored `source_sha256` ≠ recomputed
  `computeSourceSha256(planContents)` (status lines stripped — so progress does
  not invalidate the mirror; reuse the existing function, do not re-hash
  differently). Uncomputable (missing hash) → `stale: null` + warning.
- `statusesAligned`: every phase/sub-task `(ref, status)` pair equal between
  `plan.md` and `plan_fast.md`; a missing mirror → `null`. A mismatch is a
  warning `mirror-status-mismatch`, not an error (mid-write windows exist).
- `alignment.preExecution` ← `tasks/review-fast.md`, `alignment.planEnd` ←
  `tasks/review-fast-final.md`; each `{ present, path, verdict, date }` using the
  same tolerant verdict parser (§7.1) and `date` from frontmatter `created`.

### 7.3 `plan_fast_skip_checks.md` → `LedgerState`

- Parse the single 5-column table (`Timestamp | Check | Scope | Reason |
  Disposition`), by header name; unescape `\|`.
- `rows`: total data rows (all of them, not only displayed).
- `perCheck[check]`: counts of `deferred` (`deferred to end-of-plan`),
  `conditional` (`conditional at plan end`), `runPass` (`run: PASS…`), `runFail`
  (`run: FAIL…`), `notApplicable` (`not applicable…`) — prefix matching, because
  real rows append detail (`run: PASS — 721 tests`).
- `unresolved`: checks with ≥ 1 deferred/conditional row and **no** outcome row
  (`run: PASS`/`run: FAIL`/`not applicable`) — exactly the plan-end rule in
  [`plan-fast-skip-checks.md`](../../../skills/dh-execute-plan-fast/references/plan-fast-skip-checks.md).
  A plan that has not reached plan end legitimately has unresolved checks; the
  panel MUST present them as "deferred", not as a failure.
- `rowsShown`: last 20 rows; `truncated` when `rows > 20`; malformed table →
  `ledger-malformed` warning, `present: false` semantics preserved for display.

### 7.4 Effective verdict (display precedence)

`review.verdict` → else `fast.alignment.planEnd.verdict` → else `null`
("No review yet"). The panel MUST label the source, because a fast-alignment
verdict is an alignment approval, not a code-quality sign-off.

## 8. Activity model

### 8.1 Verified inputs

| Need | API | Notes ref |
|---|---|---|
| Session busy/idle | `context.data.session.status(sessionID): "idle" \| "running"` | §9 |
| Retry signal | `session.status` event `data.status.type === "retry"` with numeric `attempt` | §9, §10 |
| Agent (live) | `session.agent.selected` event `data.agent` | §10 |
| Agent (snapshot) | `SessionMessageAssistant.agent` from `data.session.message.list(id)`; `SessionInfo.agent` from `data.session.get(id)` | §9, §10 |
| Tool name | `session.tool.input.started` `data.name`; cleared by `session.tool.success`/`.failed` with the same `id` | §10 |
| Idle/terminal | `session.idle`, `session.execution.succeeded`/`.failed`/`.interrupted` | §10 |
| Session identity | slot input `{ sessionID }` (sidebar) / `PanelInput.sessionID` | §5, §6 |

`data.session.status` collapses retry/busy into `running`; the event payload is
the only source of the retry distinction — hence both are used.

**MUST NOT** subscribe to message/progress events whose payloads are content:
`session.text.delta`, `session.message.content.updated`,
`session.tool.called` (`input`), `session.tool.progress` (`metadata`),
`session.skill.activated` (`text`), `permission.*` and `form.*`. From
`session.tool.success` / `session.tool.failed` only `data.id` may be read
(`content`/`error` are dropped) — see §8.2.

### 8.2 Reducer (`foldActivityEvent`)

The event adapter in 3.3 field-picks into a narrower type; the mapper never sees
a raw event. The allowlist and the field picked:

| Event | Picked fields | Effect |
|---|---|---|
| `session.status` | `data.sessionID`, `data.status.type`, `data.status.attempt` (retry only) | `idle` → status `idle`, clears `retryAttempt`/`toolName`; `busy` → `running`; `retry` → `retrying` + `retryAttempt` (**`status.message` and `status.error` are dropped here**) |
| `session.idle` | `data.sessionID` | status `idle`; clears tool/retry |
| `session.retry.scheduled` | `data.sessionID`, `data.attempt` | `retrying`; `error` dropped |
| `session.execution.started` | `data.sessionID` | `running` |
| `session.execution.succeeded` / `.failed` / `.interrupted` | `data.sessionID` | `idle`; clears tool/retry |
| `session.agent.selected` | `data.sessionID`, `data.agent` | `agent` |
| `session.tool.input.started` | `data.sessionID`, `data.id`, `data.name` | `toolName`/`toolID` only — **status is not changed** by tool events (`data.session.status` + status events stay authoritative) |
| `session.tool.success` / `session.tool.failed` | `data.sessionID`, `data.id` | clears `toolName` when `id` matches |

Any other event type is ignored by the reducer (defence in depth, even though
3.3 subscribes narrowly). Events whose `data.sessionID` differs from the current
session MUST be ignored; if `event.location?.directory` is present it must equal
the resolved root.

### 8.3 `ActivitySignal`

```ts
interface ActivitySignal {
  status: 'idle' | 'running';
  retryAttempt: number | null;
  agent: string | null;
  toolName: string | null;
  toolID: string | null;
  updatedAt: string;   // ISO
}
```

Seeded from `data.session.status(sessionID)` + `SessionInfo.agent` on session
change; then folded from events. Session switch resets the signal (no carry-over
between sessions).

### 8.4 Derivation and privacy

`deriveActivity({ signal, plan, sessionID, now })`:

1. **Status** — `retryAttempt != null` → `retrying`; else `signal.status`;
   `null` signal → `unknown`.
2. **Agent** — `signal.agent` if it matches
   `/^[a-z0-9][a-z0-9._-]{0,63}$/i` (`agentSource: 'session'`); else
   `plan.current.subTask.delegatedTo` if it matches the same pattern
   (`agentSource: 'plan'`); else `null`.
3. **Tool** — `signal.toolName` if it matches `/^[a-z0-9][a-z0-9._-]{0,39}$/i`
   (≤ 40 chars); else `null`. Anything else (paths, arguments, newlines) is
   dropped, not escaped.
4. **Summary** — from fixed templates only, never from provider/event free text:

| State | `summary` |
|---|---|
| `retrying` | `Retry ${n} — running` |
| `running` + tool | `Running ${tool}` |
| `running` + agent | `Running — ${agent}` |
| `running` alone | `Running` |
| `idle`/`unknown` + plan current sub-task | `${position} ${title} — ${agent ?? 'unassigned'}` |
| `idle`/`unknown` + plan, no current sub-task | `Phase ${n} — ${title}` / `Completed` |
| `idle`/`unknown` + `PlanState.status === 'selector'` | `${n} active plans — choose one` |
| `idle`/`unknown`, no plan | `No active plan` |

5. **Source** — `'session'` when a signal exists and `status !== 'unknown'`;
   otherwise `'plan-fallback'` (covers both plan-derived and
   selection-derived text, e.g. the selector hint). A fallback line is what
   makes the card useful when the model is idle between steps.
6. `stale` — `true` when status is `running`/`retrying` and `now - updatedAt >
   5 min` (clock skew tolerated; UI appends `(stale)`).
7. `summary` truncated to 120 chars with `…`.

**Privacy MUSTs:** render only session status, retry attempt number, agent id,
tool **name**, and plan-derived text. Never render `status.message`, retry
`error`/`next`, tool `input`/`content`/`metadata`/`error`, message content,
deltas, permission or form payloads, file contents, or absolute paths. No
fallback may echo an unvalidated string.

## 9. Refresh and performance

### 9.1 Triggers

| Trigger | Behaviour |
|---|---|
| Watcher/poll settle (§9.2) | full refresh: scan → select → details → derive |
| Explicit refresh (panel key) | immediate refresh, debounce reset |
| Initial setup | one refresh; `status: 'loading'` until it completes |
| Session switch (`sessionID` change) | re-derive **activity only** — no plan re-read |
| Panel open/close, focus, resize | **no** parse; components read the existing `PlanState` |
| Every render | **no** parse, ever (MUST) |

### 9.2 Watch and debounce

- Watch `docs/plans` recursively where `fs.watch({ recursive: true })` is
  supported; otherwise watch `plansDir`, each candidate dir and each
  `tasks/` subdir (bounded, ≤ 200 dirs), and always keep a poll fallback.
- Trailing debounce **300 ms**, max wait **1,000 ms**; poll interval **2,000 ms**
  when watching is unavailable (2.2 owns implementation, this fixes the
  numbers).
- Single-flight: while a refresh runs, further triggers set `pending: true` and
  coalesce into **one** follow-up run (no overlapping parses, no queue growth).
- Before parsing, compare the fingerprint `(mtimeMs, size)` of every watched
  file plus the index; unchanged → skip the parse and keep `revision`.
- The parse runs in the watcher/timer callback and writes the resulting
  `PlanState` into `storage.memory` once. Components never trigger I/O.

### 9.3 Budgets

| Limit | Value | On breach |
|---|---|---|
| Candidate dirs scanned | 200 | `truncated` + warning |
| `plan.md` size | 1 MiB | `file-too-large` error for that candidate |
| Sidecar size | 512 KiB | warning, sidecar ignored |
| Checklist items per list | 50 | `truncated: true` |
| Ledger rows displayed | 20 (counts over all) | `truncated: true` |
| Item/verdict/summary text | 200 / 120 / 120 chars | ellipsis |
| Renders per second (activity) | ≤ 10 (100 ms throttle) | last update wins |
| Full refresh duration | target < 50 ms, warn > 250 ms | `refresh.durationMs` recorded |

`PlanState` is replaced wholesale and is reference-stable when unchanged
(`revision` untouched) so Solid does not re-render identical data.

### 9.4 Disposal

`setup` returns a cleanup that (a) closes every watcher, (b) clears every timer,
(c) calls every `data.on` unsubscribe, (d) removes the slot claims, and (e) is
idempotent (second call is a no-op). Leaking any of these fails 3.3's acceptance
criteria.

## 10. Read-only guarantee

The TUI part is a **reader**. Binding rules:

1. **MUST NOT** call any `fs` write API (`writeFile*`, `mkdir*`, `rm*`,
   `rename*`, `copyFile*`, `chmod*`, `utimes*`). Reads only, through
   `readPlanFile` (`O_NOFOLLOW`) and `readdirSync`/`statSync`.
2. **MUST NOT** import the writer modules listed in §2 (review-checkable with
   `dependency-cruiser`; a `forbidden` rule from `^src/tui` to
   `(atomic-write|plan-io|plan-fast-sync|plan-fast|plan-template|sheet-tools|logged-command)\.ts$`
   SHOULD be added in 2.1 or 4.4).
3. **MUST NOT** call `context.storage.store` (durable, disk-backed — notes §8) or
   any session mutator (`session.sync`, `message.sync`, `form.reply`,
   `permission.*`, `keymap.dispatch`). Only `storage.memory` and read-only
   `data.*` accessors.
4. **MUST NOT** offer any keybinding, command, button or palette action that
   edits plan status, checkboxes, review files, ledger rows or the index.
5. **MUST** surface issues instead of repairing them: no "fix plan" affordance,
   no creating missing directories, no normalizing files on disk.
6. Nothing in the model may hold a file handle after a refresh completes.

## 11. States

`status` is the single render discriminant. Every row is a fixture for 2.4.

| # | Condition | `status` / `reason` | Sidebar card (`sidebar.content`) | Panel (`session.panel`) |
|---|---|---|---|---|
| S1 | First refresh not finished | `loading` / `loading` | `Plans: loading…` (one line, muted) | `Loading plan progress…` |
| S2 | One selected plan (§4.4 r1–r2) | `ready` / `ready` (or `pinned`) | Title, `Phase N · N.M`, `[███░░░░░░░] 3/14`, agent, status, activity | Full tree, checklists, review, ledger, fast, `updatedAt` |
| S3 | ≥ 2 active, no pin (E1 today) | `selector` / `multiple` | `2 active plans` + suggested title + `open /plan-progress` | Selector: rows `slug — status — updated`, `1…9` pins, `suggested` badge on newest |
| S4 | No active, index row `Active=Yes` | `ready` / `index` | As S2 plus `(index)` hint | As S2 plus `source: index` note |
| S5 | No active and no index-active row | `empty` / `empty` | `No active plan` + `docs/plans` hint | Empty panel + hint text |
| S6 | No `docs/plans` at the resolved root | `empty` / `no-plans-dir` | `No docs/plans here` + `start opencode at the workspace root` | Empty panel naming the resolved directory (`ui.format.path`) |
| S6b | No resolvable location directory | `empty` / `no-workspace` | `No local workspace` | Empty panel + warning |
| S7 | Selected plan unreadable/not phased/malformed (incl. pinned) | `error` / `plan-error` | `Plan unreadable: <slug>` + one-line issue code | Error panel: issue list + other selectable candidates |
| S8 | `plansDir` unreadable, or scan failed | `error` / `scan-error` | `Plans unavailable` | Error panel with the offending path (relative) |
| S9 | Pin resolved to nothing | falls through to S2–S5 | — | warning `pin-stale` shown as a footnote |

Malformed handling is scoped: a broken **non-selected** candidate is a
`warning` and appears in the selector with `valid: false` and its issue; only a
broken **selected** candidate produces S7. All lists (`errors`) are always
arrays, never `null`, so components never branch on undefined.

## 12. JSON example

A `ready` state for a synthetic 2-phase plan (a third phase would follow the same
shape):

```json
{
  "status": "ready",
  "reason": "ready",
  "workspaceRoot": "/repo",
  "plansDir": "/repo/docs/plans",
  "selection": {
    "mode": "single-active",
    "source": "frontmatter",
    "selectedSlug": "checkout-flow",
    "suggestedSlug": null,
    "pinnedSlug": null,
    "candidates": [
      {
        "slug": "checkout-flow",
        "title": "Checkout Flow",
        "path": "docs/plans/checkout-flow/plan.md",
        "status": "In Progress",
        "active": true,
        "updatedAt": "2026-11-14",
        "valid": true,
        "issue": null
      }
    ],
    "scanned": 4,
    "truncated": false
  },
  "plan": {
    "slug": "checkout-flow",
    "title": "Checkout Flow",
    "path": "docs/plans/checkout-flow/plan.md",
    "absPath": "/repo/docs/plans/checkout-flow/plan.md",
    "status": "In Progress",
    "active": true,
    "updatedAt": "2026-11-14",
    "updatedSource": "frontmatter",
    "phases": [
      {
        "index": 1,
        "title": "Domain and Contracts",
        "status": "Completed",
        "counts": { "total": 1, "completed": 1, "inProgress": 0, "pending": 0 },
        "line": 40,
        "subTasks": [
          {
            "index": "1.1",
            "title": "Define the order contract",
            "status": "Completed",
            "delegatedTo": "dh-software-architect",
            "relatedRequirements": ["R1"],
            "criteria": [
              { "kind": "done-when", "text": "Contract is recorded and referenced by the plan." }
            ],
            "checkboxes": [],
            "line": 44
          }
        ]
      },
      {
        "index": 2,
        "title": "Checkout Service",
        "status": "In Progress",
        "counts": { "total": 2, "completed": 0, "inProgress": 1, "pending": 1 },
        "line": 62,
        "subTasks": [
          {
            "index": "2.1",
            "title": "Implement the checkout endpoint",
            "status": "Completed",
            "delegatedTo": "dh-software-engineer",
            "relatedRequirements": ["R2", "R3"],
            "criteria": [
              { "kind": "acceptance", "text": "POST /checkout returns 201 and is covered by tests." }
            ],
            "checkboxes": [],
            "line": 66
          },
          {
            "index": "2.2",
            "title": "Wire payment retries",
            "status": "In Progress",
            "delegatedTo": "dh-software-engineer",
            "relatedRequirements": ["R4"],
            "criteria": [
              { "kind": "done-when", "text": "A transient provider failure is retried once and logged." }
            ],
            "checkboxes": [],
            "line": 84
          }
        ]
      }
    ],
    "counts": {
      "phases": { "total": 2, "completed": 1, "inProgress": 1, "pending": 0 },
      "subTasks": { "total": 3, "completed": 2, "inProgress": 1, "pending": 0 }
    },
    "progress": { "ratio": 0.6667, "percent": 67 },
    "current": {
      "phase": { "index": 2, "title": "Checkout Service" },
      "subTask": {
        "index": "2.2",
        "title": "Wire payment retries",
        "delegatedTo": "dh-software-engineer"
      },
      "label": "Phase 2 · 2.2",
      "position": "2.2",
      "ordinal": { "phase": 2, "subTask": 2 },
      "source": "in-progress"
    },
    "checklists": {
      "plan": {
        "items": [
          {
            "id": "docs/plans/checkout-flow/plan.md#L140",
            "text": "All 2 phases and 3 sub-tasks `Completed`.",
            "checked": false,
            "line": 140,
            "section": "Final Integration & Verification",
            "subTaskIndex": null,
            "kind": "checkbox"
          }
        ],
        "total": 1,
        "checked": 0,
        "truncated": false,
        "inlineText": null
      },
      "finalVerification": {
        "items": [
          {
            "id": "docs/plans/checkout-flow/plan.md#L140",
            "text": "All 2 phases and 3 sub-tasks `Completed`.",
            "checked": false,
            "line": 140,
            "section": "Final Integration & Verification",
            "subTaskIndex": null,
            "kind": "checkbox"
          }
        ],
        "total": 1,
        "checked": 0,
        "truncated": false,
        "inlineText": null
      }
    },
    "review": {
      "present": true,
      "path": "docs/plans/checkout-flow/tasks/review.md",
      "verdict": "Approve with comments",
      "verdictRaw": "Approve with comments — no P0/P1 blockers",
      "scope": "subtask",
      "reviewedAgainst": "Sub-task 2.2 from plan.md",
      "risk": "Low",
      "updatedAt": "2026-11-14T10:12:00.000Z",
      "issues": []
    },
    "fast": {
      "present": false,
      "path": null,
      "stale": null,
      "statusesAligned": null,
      "updatedAt": null,
      "ledger": {
        "present": false,
        "path": null,
        "rows": 0,
        "perCheck": {},
        "unresolved": [],
        "rowsShown": [],
        "truncated": false,
        "issues": []
      },
      "alignment": {
        "preExecution": { "present": false, "path": null, "verdict": null, "date": null },
        "planEnd": { "present": false, "path": null, "verdict": null, "date": null }
      }
    },
    "errors": [],
    "warnings": []
  },
  "activity": {
    "status": "running",
    "agent": "dh-software-engineer",
    "agentSource": "session",
    "tool": "edit",
    "summary": "Running edit",
    "source": "session",
    "sessionID": "ses_01JABC",
    "stale": false,
    "updatedAt": "2026-11-15T09:41:12.000Z"
  },
  "sessionID": "ses_01JABC",
  "errors": [],
  "warnings": [],
  "revision": 27,
  "refreshedAt": "2026-11-15T09:41:12.100Z",
  "refresh": { "mode": "watch", "pending": false, "durationMs": 18 }
}
```

Selector payload (S3, today's repository shape):

```json
{
  "status": "selector",
  "reason": "multiple",
  "workspaceRoot": "/repo",
  "plansDir": "/repo/docs/plans",
  "selection": {
    "mode": "multiple",
    "source": "frontmatter",
    "selectedSlug": null,
    "suggestedSlug": "tui-plan-progress",
    "pinnedSlug": null,
    "candidates": [
      { "slug": "tui-plan-progress", "title": "TUI Plan Progress", "path": "docs/plans/tui-plan-progress/plan.md", "status": "In Progress", "active": true, "updatedAt": "2026-11-15", "valid": true, "issue": null },
      { "slug": "npx-install-entrypoint", "title": "npx Install Entrypoint", "path": "docs/plans/npx-install-entrypoint/plan.md", "status": "Pending", "active": true, "updatedAt": "2026-10-21", "valid": true, "issue": null }
    ],
    "scanned": 9,
    "truncated": false
  },
  "plan": null,
  "activity": { "status": "idle", "agent": null, "agentSource": null, "tool": null, "summary": "2 active plans — choose one", "source": "plan-fallback", "sessionID": "ses_01JABC", "stale": false, "updatedAt": "2026-11-15T09:41:12.000Z" },
  "sessionID": "ses_01JABC",
  "errors": [],
  "warnings": [],
  "revision": 3,
  "refreshedAt": "2026-11-15T09:41:12.100Z",
  "refresh": { "mode": "watch", "pending": false, "durationMs": 7 }
}
```

## 13. API surface for implementation

```ts
// src/tui/plan-state.ts — pure, no fs, no clock
export function selectPlan(candidates: PlanCandidate[], index: IndexRow[], pinnedSlug: string | null): PlanSelection;
export function derivePlanProgress(input: {
  candidate: PlanCandidate; planContents: string; details: PlanDetails; now: string;
}): PlanProgress;
export function derivePlanState(input: {
  root: string | null; scan: PlanScan; details: PlanDetails | null;   // details = selected slug's sidecars
  pinnedSlug: string | null; sessionID: string | null; activity: Activity;
  now: string; previousRevision: number;
}): PlanState;
export function currentSubTask(plan: PlanProgress): SubTaskProgress | null; // consumer helper

// src/tui/plan-read.ts — fs, read-only
export function resolvePlanRoot(locationDirectory: string | undefined, env: { DH_WORKSPACE_ROOT?: string } | undefined): PlanRootResult; // env only for the §4.1 override warning
export function readPlanScan(root: string | null): PlanScan;                 // candidates + index (frontmatter only)
export function readPlanDetails(root: string, slug: string): PlanDetails;    // review/fast/ledger sidecars

// src/tui/session-activity.ts — pure
export function emptySignal(sessionID: string | null, now: string): ActivitySignal;
export function foldActivityEvent(signal: ActivitySignal, event: ActivityEvent): ActivitySignal;
export function deriveActivity(input: {
  signal: ActivitySignal | null; plan: PlanProgress | null; sessionID: string | null; now: string;
}): Activity;
```

`PlanScan`, `PlanDetails`, `SourceFile` are the read layer's plain shapes
(`SourceFile = { path, contents, mtimeMs, size }`); `IndexRow` is a parsed
`## Plans` row. The fs layer performs **one** candidate pass and **one** sidecar
pass per refresh (only for the selected slug), which is what keeps §9.3 budgets.

## 14. Decisions and rejected alternatives

| # | Decision | Rejected alternative (why) |
|---|---|---|
| D1 | Two-pass read: frontmatter for all candidates, full parse + sidecars for the selected plan | Parsing every plan fully every refresh (cost, and 8/9 plans are irrelevant to the card) |
| D2 | Pin > frontmatter > index > empty precedence | "Most recently updated wins" auto-pick (flips mid-session, hides E1 ambiguity) |
| D3 | `status: 'selector'` whenever ≥ 2 active and no pin | Silent auto-select with a switch hint (users lose the fact that two plans are marked active) |
| D4 | No upward/downward workspace probing; `location.directory` only | Walking to `git rev-parse --show-toplevel` (masks `WC §6.2`, could show a different plan tree than the tools write) |
| D5 | `DH_WORKSPACE_ROOT` produces a warning, never a different root | Honoring the override (splits the two sides exactly as `WC §5` rows 3/4/7/10 warn) |
| D6 | Frontmatter outranks the index | Index-first (E3 shows the index lagging; the plan file is the unit of record) |
| D7 | Checklist continuation joins indented lines | Line-regex only (would truncate 6-space continuations, E4) |
| D8 | `Done When`/`Acceptance Criteria` become unchecked criteria, never split | Semicolon splitting (invents structure the plan does not declare) |
| D9 | Verdict = last tolerant `Verdict` line in `review.md` | First match (a concatenated review file would report a sub-task verdict as the sign-off) |
| D10 | Activity consumes a normalized signal, not raw events | Passing raw events to the mapper (message bodies/errors leak by construction) |
| D11 | Short summary from fixed templates; tool name allowlisted | Rendering `status.message`/tool input (privacy; notes §9 warns the retry `message` is a provider string) |
| D12 | Sidecars optional, `present: false` | Treating a missing review/ledger as an error (normal for unexecuted plans) |
| D13 | Activity refresh on session switch does not re-read plans | Re-parsing on every session event (defeats §9.3 and adds no information) |

## 15. Consumption map

| Sub-task | Reads |
|---|---|
| 2.1 parser | §2, §3, §4, §5, §6, §7, §12, §13, §14 |
| 2.2 watch/refresh | §9, §11 (S1 transitions), §3.1 (`refresh`) |
| 2.3 activity | §8, §3.5, §13 |
| 2.4 fixtures/tests | §11 (one fixture per state), §12, E1–E6 |
| 3.1 sidebar card | §11 (card column), §3.4 (`counts`, `current`, `progress`), §5.4 (bar), §8.4 (summary) |
| 3.2 panel | §6, §7, §11 (panel column) |
| 3.3 wiring/cleanup | §3.1, §3.6, §8.2, §9.1, §9.4, §10 |
| 4.4 QA | §10, §15, §11 |

## 16. Open items (non-blocking)

- **Panel scrolling** is out of scope here (notes §13); the panel renders a
  windowed slice of `phases` with its own `panelCursor` (3.2).
- **`review-phase*.md` / ad-hoc review files** are not read in v1; if the
  practice persists, extend §7.1 behind the same `ReviewState` shape.
- **Remote workspaces** (`location.workspaceID` set, no local path) report
  `no-workspace`; remote plan reading stays a follow-up (SDD non-goal).
- **Execution-record surfacing** (`## Execution Record` status, `WC §7`) is not
  rendered in v1; the parser ignores that section (it is outside `## Phases`).

## 17. References

- [`plan.md`](plan.md) §Phase 1 (1.2), R2–R6; [`sdd.md`](sdd.md) R2–R6, AC1–AC6.
- [`tui-api-notes.md`](tui-api-notes.md) §4 (context), §5 (slots), §6 (panels),
  §8 (storage), §9 (location/session data), §10 (events), §11 (renderer width,
  `ui.format.path`), §13 (fallbacks), §14 (open questions).
- [`../harness-monorepo-awareness/workspace-contract.md`](../harness-monorepo-awareness/workspace-contract.md)
  §3 (one plan root), §4 (A1–A9), §5 (mismatch rows), §6 (mismatch behavior),
  §7 (execution record), §8 (standalone).
- Format contract:
  [`skills/dh-planning/references/phased-plan-template.md`](../../../skills/dh-planning/references/phased-plan-template.md);
  ledger contract:
  [`skills/dh-execute-plan-fast/references/plan-fast-skip-checks.md`](../../../skills/dh-execute-plan-fast/references/plan-fast-skip-checks.md).
- Code: `src/tools/plan-lifecycle.ts`, `src/lib/frontmatter.ts`,
  `src/tools/plan-paths.ts`, `src/tools/plan-io.ts`,
  `src/tools/plan-fast-template.ts`.
