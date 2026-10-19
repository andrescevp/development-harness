# Sub-Task Reviews — plugin-tools-to-mcp

Reviews produced by the `dh-review` skill during `dh-execute-plan` orchestration.
Format: one section per sub-task, findings P0–P3 with disposition.

---

## Sub-Task Review: 1.1 — Server factory + MCP test harness + tools/list contract

**Reviewed against:** Sub-Task 1.1 (`docs/plans/plugin-tools-to-mcp/plan.md`, Phase 1)
**Overall risk:** Low
**Verdict:** Approve with comments

## Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| `pnpm test` shows the new contract test green | PASS | 10 files / 97 tests pass; `src/mcp/__tests__/server.test.ts` (3 tests) covers `tools/list` |
| Exactly 7 registered tools, non-empty descriptions | PASS | Sorted-equality assertion against the literal list; `description.length > 20` per tool |
| No other test regresses | PASS | Full suite green; `vitest list` confirms the widened glob still collects every pre-existing suite |
| `package.json` + `pnpm-lock.yaml` carry the three new deps | PASS | `@modelcontextprotocol/server@2.3.1`, `zod@4.6.5` (runtime); `@modelcontextprotocol/client@2.3.1` (dev) |
| Done-when: factory builds against a temp workspace; contract test passes | PASS | Workspace-anchoring round-trip test (`plan_create` → `plan_read`) proves injected-root behavior |

## Findings

### [P0] Blocking
None.

### [P1] High
None.

### [P2] Medium

1. **Input-validation messages preempted by the SDK boundary (`src/mcp/server.ts:90-92`).**
   `z.enum` rejects invalid `status`/`target` before the handler runs; the resulting
   `isError` text is the SDK's input-validation message, not the legacy
   `invalid status '…' (expected …)` string, which becomes unreachable via MCP (R2
   wording gap). **Disposition:** forward decision recorded in plan.md 1.3 — accepted
   deviation pinned by an assertion test; revisit only if strict R2 parity is
   mandated (alternative: `z.string()` + handler-side validation).
2. **`plan-lifecycle.ts` at 299/300 lines (`src/tools/plan-lifecycle.ts:299`).**
   1.3's consolidation would breach the repo's ≤300-line rule. **Disposition:**
   recorded in plan.md 1.3 — extract the path ACL (`resolvePlanPath` +
   `assertNoSymlinks`) into `src/tools/plan-paths.ts` first.

### [P3] Low

3. **Tuple-order coupling for the index-row cell (`src/mcp/server.ts:57`).**
   `PHASE_STATUSES[0]` for `Pending` breaks silently on reorder. **Disposition:**
   recorded for 1.3 (`INITIAL_PHASE_STATUS` constant used by both call sites).
4. **Pre-existing: `assertNoSymlinks` does not cover above-anchor components**
   (`src/tools/plan-lifecycle.ts:289-299`) — a symlinked `docs/` or `docs/plans/` is
   not rejected; now reachable through MCP. **Disposition:** routed to 1.3's symlink
   hardening (recorded in plan.md 1.3).
5. **Pre-existing: `vitest.config.ts` is outside the biome lint path and carries
   old formatting drift** (double quotes, missing final newline); the widened glob
   itself is correct and empirically complete. **Disposition:** no action (out of
   scope; pre-existing).
6. **Deferred duplication (verified confined):** `readPlanFile` /
   `appendPlanIndexRow` copies remain in the adapter as recorded; 1.3 consolidates.

**Additional record for 1.3 (probed SDK behaviors, not findings):** input-validation
failures already return `isError: true`; unknown arguments are silently stripped;
explicit `null` on an optional field is rejected (strictly better than the legacy
crash-later behavior); emitted `inputSchema` has correct `required`/`enum` shapes.

## Validation Results

- **Tests present:** yes — `tools/list` contract (names + descriptions),
  workspace-anchoring round-trip; edge cases from the sub-task's cautionary points
  handled (no `console.log` under `src/mcp/`, temp workspaces cleaned, `dhs-mcp-`
  prefix).
- **Validation commands:** `pnpm test` PASS (97/97) · `pnpm typecheck` PASS ·
  `pnpm lint:biome` PASS · `pnpm lint:knip` PASS · `pnpm lint:depcruise` PASS ·
  `pnpm lint:dup` PASS (0 clones) · `node scripts/audit.mjs` PASS — all
  independently re-run via `@dh-executor`.
- **Parity evidence:** all 7 tool descriptions byte-identical to `src/plugin.ts`
  (programmatic comparison); emitted JSON Schema `required`/`enum` shape matches the
  legacy contract plus the recorded tightenings.
- **Web validation (MCP Chrome):** not applicable — no web surface in this sub-task.
- **Architecture integrity (planning domain-check):** holds — `src/mcp/server.ts` is
  a pure adapter (zero `process.env`/`process.cwd` reads, zero `console.*`); the
  `src/tools/plan-lifecycle.ts` diff is additive (exported const tuples + derived
  types); no coupling to `src/plugin.ts`.

## Regression Risk Assessment

- **Breaking changes detected:** none. `vitest.config.ts` include glob widened to
  `src/**/__tests__/**/*.test.ts` — verified to still collect every pre-existing
  suite (10 files vs 9 before, +1 new file).
- **Interface/config changes affecting other components:** `plan-lifecycle.ts`
  gains exports only (no behavior change; 21 existing tests green); `src/plugin.ts`
  untouched at this commit.

## Scope Compliance

- **In scope:** verified — `src/mcp/*`, `src/__tests__/helpers/mcp.ts`,
  plan-lifecycle constant exports, deps, vitest discovery.
- **Out of scope detected:** none (the plan-lifecycle export was
  orchestrator-requested during the simplify pass; vitest glob required for test
  discovery; both recorded above).

## Suggested Next Steps

- [x] No fixes required for 1.1 — proceed to Sub-Task 1.2.
- [ ] 1.3 must pick up: path-ACL extraction, adapter-helper consolidation, symlink
      hardening, input-validation deviation record, `INITIAL_PHASE_STATUS`.
- [ ] 1.5 must honor exclusive-create semantics in the atomic-write helper.

---

## Sub-Task Review: 1.2 — Workspace root resolution ACL

**Reviewed against:** Sub-Task 1.2 (plan.md, Phase 1) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Env set → used (absolute resolution) | PASS | `DH_WORKSPACE_ROOT` non-blank wins, `path.resolve(cwd, value)`; relative values anchor on the provided cwd (documented precedence) |
| Env unset → cwd default | PASS | `path.resolve(cwd)`; defaults read at CALL time (pinned by a stub-after-import test) |
| Blank/whitespace override → treated as unset | PASS | `rawOverride?.trim() || undefined` |
| Blank cwd → descriptive error | PASS | `no workspace root available: cwd is empty (… )`, pinned to `/cwd is empty/` |
| Zero direct env/cwd reads outside `workspace.ts` | PASS | grep over production code: only `src/mcp/workspace.ts:27-28`; handlers/factory take the injected root |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Padded override silently mis-anchored** (`workspace.ts` override handling):
  `' /overrides/ws '` degraded to a cwd-relative path. **Addressed** — override is now
  trimmed *as a value* (`rawOverride?.trim() || undefined`) while the cwd stays verbatim
  (machine-supplied; asymmetry documented in the JSDoc); revalidated.
- **[P3] Missing coverage of the padded branch:** **Addressed** — 2 new tests (padded
  override; env-only with cwd defaulted); workspace suite now 9 tests, total 106.
- **[P3] `process.cwd()` ENOENT failure mode** (deleted cwd → raw opaque error before
  the override is consulted): **Routed to Sub-Task 2.1** — plan.md 2.1 scope now
  requires wrapping `process.cwd()` failures in the descriptive workspace-root error
  at the entry.
- **Informational (no action):** depcruise `no-orphans` exemption verified minimal and
  load-bearing (independently reproduced: its removal yields exactly one violation);
  `TODO(2.1)` removal trigger embedded. Env-precedence security cleared (host-owned
  knob; containment unchanged). Pre-existing inert `not-to-node-builtins` rule noted,
  unrelated.

### Validation Results

- Tests present: yes — precedence matrix (absolute/relative/unset/blank/padded),
  normalization, blank-cwd guard, call-time defaults.
- Validation commands: `pnpm test` PASS (11 files / 106 tests) · `pnpm typecheck` PASS ·
  `pnpm lint:biome` / `lint:knip` / `lint:depcruise` PASS — re-run independently via
  `@dh-executor`.
- Simplify pass (three lenses): reuse — clean; efficiency — clean; quality — 5 P3s,
  all applied in the final revision.
- Web validation (MCP Chrome): not applicable.
- Architecture: pure lexical resolver; call-time env reads; factory consumes the
  injected root (ACL criterion verified).

### Regression Risk Assessment

- Breaking changes: none — new module + tests; `.dependency-cruiser.json` gains a
  narrow named-rule override with an embedded removal trigger.
- Interface/config changes: `resolveWorkspaceRoot` is new surface, not yet consumed
  (Sub-Task 2.1 wires it at the stdio entry).

### Scope Compliance

- In scope: verified (`workspace.ts` + tests + the QA-config exemption required to keep
  the depcruise gate green).
- Out of scope detected: none.

### Suggested Next Steps

- [x] Proceed to Sub-Task 1.3 — it must pick up the recorded consolidations (path-ACL
      extraction → `src/tools/plan-paths.ts` first, adapter-helper consolidation, symlink
      hardening, input-validation deviation record, `INITIAL_PHASE_STATUS`).

---

## Sub-Task Review: 1.3 — Plan-lifecycle adapters (plan_read / plan_update_status / plan_create)

**Reviewed against:** Sub-Task 1.3 (plan.md, Phase 1) · **Overall risk:** Low–Medium (security-relevant path ACL surface) · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Exact input schemas (enums single-sourced) | PASS | `z.enum(PHASE_STATUSES)` / `z.enum(STATUS_TARGETS)`; SDK boundary validation for bad enums is the accepted, pinned deviation |
| Byte-compatible success payloads `{ ok, path, plan }` | PASS | Deep-equal tests: `plan_read` (slug + `path` variants), `plan_update_status` (re-parsed plan), CRLF stability, `plan_create` roundtrip |
| `isError` mapping with the legacy message strings | PASS | Error matrix: missing file, `..`/absolute escapes, invalid slug, symlink component + symlinked anchor, phase gate, missing ref, missing status marker, existing slug |
| Traversal rejections via the MCP surface | PASS | ACL suite (8 tests) incl. dangling symlinks, symlinked `docs/`, symlinked `index.md` (outside target byte-unchanged, no stranded plan) |
| `plan_create` → `plan_read` roundtrip + `updateIndex` parity | PASS | Index row byte-identical (pipe/newline escaping pinned) |
| Existing tests green | PASS | 13 files / 137 tests total; plan-lifecycle suite green via the transitional re-export |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] `plan_create` stranded a file with `phases: []`** (parse ran after write):
  **Addressed** — `parsePlan(template)` now runs before `mkdirSync`/write/append; test proves
  an invalid scaffold leaves the workspace untouched and retries are safe.
- **[P3] Raw `ENOTDIR` leaked from `assertNoSymlinks`** (file at a path component regressed the
  legacy `plan file not readable` message): **Addressed** — traversal stops on `ENOTDIR`;
  regression test pins the legacy message.
- **[P3] Incomplete index-row escaping (`\|` split the table):** **Addressed** — backslashes
  escaped first, then pipes, then CR/LF (both cells); cases added.
- **[P3] Final-component TOCTOU (`O_NOFOLLOW`):** **Routed to Sub-Task 1.5** — plan.md 1.5
  scope now requires `O_NOFOLLOW` semantics in the atomic-write helper; parent-component swaps
  remain accepted residual.
- **[P3] Index path derived in two places:** **Addressed** — `planIndexFile(root)` in
  `plan-paths.ts`, consumed by both the append helper and the hoisted validation.
- **Informational:** `guarded` flattens errors without stack/stderr breadcrumbs — revisit at
  2.1 (stderr logging) if diagnosis needs it; no parity impact.

**Simplify pass (3 lenses):** 3×P2 dispositioned — dangling-symlink `lstat` fix (applied),
`INITIAL_PHASE_STATUS` single-sourced into `plan-template.ts` (applied), `plugin.ts` divergence
re-affirmed as 3.1-owned; P3 batch applied: short-write-safe append, empty-root guard,
fail-closed anchor precondition, index ACL tests, row escaping, helper relocation
(`textOf`/`schemaOf`), no-op write skip, comment/shim hygiene, `plansFile` adoption.

### Validation Results

- Tests present: yes — 137 total (21 → split into parity + ACL suites; add: ACL 8, workspace 9,
  server 3).
- Validation commands: `pnpm test` PASS · `pnpm typecheck` PASS · `pnpm lint:biome`/`knip`/
  `depcruise`/`dup` PASS (0 clones) · `node scripts/audit.mjs` PASS — independently re-run via
  `@dh-executor` after both fix rounds.
- Edge cases from the sub-task: handled — traversal, gates, escaping, ENOENT-index skip,
  `phases: []`, dangling links.
- Web validation (MCP Chrome): not applicable.
- Architecture: layering clean and acyclic (`plan-paths` leaf ACL → `plan-lifecycle`
  parser/editor + plan I/O → `plan-template` scaffold → `mcp/server` adapter); no cycles
  (depcruise); the `resolvePlanPath` re-export carries a `TODO(3.1)`.

### Regression Risk Assessment

- Intended, pinned behavior changes vs legacy: stricter anchor-symlink rejection; no-op status
  writes skipped (mtime stable); schema tightenings; SDK enum-validation text. `src/plugin.ts`
  untouched (deleted in 3.1).
- Interface changes: `plan-paths.ts` is new surface; `plan-lifecycle.ts` re-exports
  `resolvePlanPath` transitionally.
- **Cap watch:** `plan-lifecycle.ts` at 299/300 lines — Sub-Task 1.5 will touch this file.

### Scope Compliance

- In scope: verified (tool-layer extraction, adapter consolidation, tests, QA-config exemption
  from 1.2 carried).
- Out of scope detected: none (ACL suite split and helper extraction were line-cap-driven).

### Suggested Next Steps

- [x] Proceed to Sub-Task 1.4 — reuse `errorResult` + the harness/textOf/schemaOf helpers.
- [ ] 1.5 must honor: exclusive-create mode, `O_NOFOLLOW` final component, `plan-lifecycle.ts`
      cap watch.

---

## Sub-Task Review: 1.4 — Sheet + logged_command adapters

**Reviewed against:** Sub-Task 1.4 (plan.md, Phase 1 — acceptance wording corrected pre-implementation for verified helper semantics: sheet helpers never throw → `ok: false` payloads stay **normal results**; unexpected throws → `isError`) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Happy paths for all four tools (deep-equal legacy payloads) | PASS | `read_sheet` full payload deep-equal; `update_sheet` rewrite re-read through the MCP surface; `sheet_schema` `name:type` shape; `logged_command` exact key-set pin |
| Unreadable file → `ok: false` payload with `duckdb error:` (NOT `isError`) | PASS | Explicit falsy-`isError` assertion + full empty shape (`columns/rowCount/rows`) |
| Non-existent csv → same shape | PASS | Covered for `read_sheet`, `update_sheet`, `sheet_schema` |
| Failing shell command → normal result `ok: false`, non-zero `exitCode`, `logPath` present | PASS | `echo boom && exit 3` (a child `node -e "process.exit(3)"` is masked by the wrapper's trailing echo — mirrors the pinned tool-suite idiom) |
| Payloads deep-equal the legacy `SheetResult`/`LoggedCommandResult` shapes | PASS | Key set `[exitCode, head, logPath, ok, tail, truncated]` pinned; error-string prefix rules asserted exactly (`duckdb error:` vs unprefixed pre-check) |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Failure-safe temp-log cleanup** (flagged by two lenses; red-run logs leaked): **Addressed** — module-level log-path drain in `afterEach`; stale 0-byte logs deleted; 0 leftovers verified after runs.
- **[P3] Guard redundancy undocumented** (SDK already maps handler throws to the identical shape — verified against SDK source + runtime probe): **Addressed** — both guards document that they exist to keep the parity contract explicit and SDK-independent; guards retained by decision.
- **[P3] Deviation comment didn't name the plan's suggested command:** **Addressed** — comment now explains the wrapper-exit masking.
- **[P3] Tracked-harness lifecycle duplicated across four suites:** **Addressed** — generic `connectHarness`/`closeHarness` in `helpers/mcp.ts`; plan fixtures delegate; new suites migrated.
- **[P3] `timeoutMs` pass-through not tested at the MCP surface:** **Deferred** (plan scope-tight; the tool-level suite pins timeout semantics).
- **Kept decisions:** outer `async` on the four handler arrows (uniformity with plan handlers); pre-existing backlog notes (`toJsonSafe` round-trip, `readWindow` full-file read, `read_sheet` DB-open-before-validation) — no action, out of scope.

### Validation Results

- Tests present: yes — 12 + 2 new (15 files / 151 tests total; +14 in 1.4), MCP-surface parity + guard pinning.
- Validation commands: `pnpm test` PASS · `pnpm typecheck` PASS · `lint:biome`/`knip`/`depcruise`/`dup` PASS (0 clones) · `node scripts/audit.mjs` PASS — independently re-run via `@dh-executor`; 0 temp leftovers.
- Code-quality evidence: the three-lens simplify pass (all `@dh-reviewer`) including SDK-internals inspection and a runtime throw-mapping probe; no separate fourth delegation for this sub-task (evidence considered sufficient and recorded).
- Edge cases from the sub-task: handled — `ok:false`-never-`isError` policy pinned; disallowed-query messages exact; log artifact assertions.
- Web validation (MCP Chrome): not applicable.
- Architecture: guards are thin wrappers; async guard added without disturbing the sync invariant of the plan handlers.

### Regression Risk Assessment

- Breaking changes: none — guard wrappers are behavior-identical (SDK source + runtime probe evidence); tool helpers and `logged-command`/`sheet-tools` untouched; test-infra consolidation only.
- Interface/config changes: none (tool schemas and payloads unchanged).

### Scope Compliance

- In scope: verified (`server.ts` guard work + MCP-surface tests; bounded test-infra consolidation in `helpers/mcp.ts`, `plan-fixtures.ts`).
- Out of scope detected: none.

### Suggested Next Steps

- [x] Proceed to Sub-Task 1.5 — atomic writes; must honor exclusive-create mode, `O_NOFOLLOW`
      final component, and the `plan-lifecycle.ts` cap watch.

---

## Sub-Task Review: 1.5 — Atomic plan-file writes

**Reviewed against:** Sub-Task 1.5 (plan.md, Phase 1 — scope expanded post-1.3-review: exclusive-create mode + `O_NOFOLLOW` final-component hardening) · **Overall risk:** Low–Medium (filesystem write path) · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| `writeFileAtomic` content exactness (overwrite mode) | PASS | Content equality; forced rename failure (`vi.spyOn`) preserves the original and cleans the temp |
| Exclusive mode: exact content, `EEXIST` on existing, original untouched | PASS | `linkSync` semantics pinned; caller maps to `plan already exists` |
| Zero `*.tmp` residue after success/failure | PASS | Unit pins + a new MCP-surface no-residue assertion |
| Original preserved on simulated failure | PASS | Both modes covered |
| Existing tests green | PASS | 17 files / 165 tests |
| `O_NOFOLLOW` final-component hardening | PASS | Read via numeric flag (`ELOOP` → ACL message, `cause` preserved); index append `O_APPEND\|O_NOFOLLOW`; status writes use rename-replace — supersedes the literal `O_TRUNC` approach (accepted, documented) |
| Exclusive-create never clobbers | PASS | Temp + `linkSync`; exhausted-retry error wrapped as non-`EEXIST` so the target mapping cannot misfire |
| `plan-lifecycle.ts` cap watch | PASS | I/O extracted to `plan-io.ts`; lifecycle now 263/300 |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Temp path written without `O_EXCL`** (pre-planted temp symlink followed — probe demonstrated a write-through + link-rename): **Addressed** — `wx` create with bounded fresh-suffix retry; deterministic mock test pins no-write-through and victim integrity.
- **[P2, simplified] `readPlanFile` hand-rolled fd open/read/close:** **Addressed** — single `readFileSync` with numeric `O_NOFOLLOW` flag (identical errno behavior, `cause` added to both errors).
- **[P3] Rename reset file mode** (0600 → 0644 confidentiality regression): **Addressed** — existing mode carried onto the temp create; pinned.
- **[P3] Guaranteed-failing unlink on every successful overwrite:** **Addressed** — cleanup-on-error only (exclusive variant keeps `finally`).
- **[P3] ACL message string composed in three places:** **Addressed** — `traversalError` single producer in `plan-paths.ts`.
- **[P3] Index pre-flight duplicated `appendPlanIndexRow`'s validation prefix:** **Addressed** — `assertPlanIndexWritable` in `plan-io.ts`; `server.ts` drops the direct `plan-paths` imports.
- **[P3] Test gaps + fixture rebuild:** **Addressed** — symlinked-destination `EEXIST`, temp-symlink exhaustion, MCP tmp-residue pins; `plansIndexFile`/`seedSymlinkedIndex` reused.
- **[P3] Crash-window temp residue:** **Addressed** — module-header note + `.gitignore` (`docs/plans/**/*.tmp`); no per-write sweep (documented trade-off; a SIGKILL mid-write can leave one temp file).
- **Accepted (no action):** `plan_create`'s intentional double symlink walk (defense-in-depth, commented); `ELOOP` branches as race-only defense-in-depth; `src/plugin.ts` residual copies (3.1); fsync/durability beyond rename (out of scope by plan).

### Validation Results

- Tests present: yes — atomicity, exclusive create, mode preservation, temp-symlink no-write-through, ACL reuse, MCP-surface residue; red-first confirmed for the two new pins.
- Validation commands: `pnpm test` PASS · `pnpm typecheck` PASS · `lint:biome`/`knip`/`depcruise`/`dup` PASS (0 clones) · `node scripts/audit.mjs` PASS — independently re-run via `@dh-executor`; 0 temp artifacts.
- Code-quality evidence: three-lens simplify pass (all `@dh-reviewer`) with runtime probes (write-through demo, mode probe); fixes applied; no separate fourth delegation (evidence sufficient, recorded).
- Web validation (MCP Chrome): not applicable.
- Architecture: clean adjusted layering — `plan-lifecycle` (parse/edit) vs `plan-io` (fd I/O + index) vs `lib/atomic-write` (commit semantics); depcruise acyclic (13 modules).

### Regression Risk Assessment

- Intended changes: crash-semantics improvement (temp + rename/link); mode preservation restores pre-1.5 truncation behavior; centralized ACL message is byte-identical.
- Interface changes: `plan-io.ts`/`atomic-write.ts` are new internal surfaces; server wiring only.
- Residual: SIGKILL between temp write and commit leaves one `.tmp` (documented, gitignored).

### Scope Compliance

- In scope: verified — extraction to `plan-io.ts` was cap-driven and documented; `.gitignore` addition bounded.
- Out of scope detected: none.

### Suggested Next Steps

- [x] Phase 1 complete (all five sub-tasks Completed) — close the phase, commit.
- [ ] Phase 2 picks up: remove the `.dependency-cruiser.json` `no-orphans` exemption when `stdio.ts`
      imports `workspace.ts` (the TODO(2.1) trigger); wire the stdio entry.

---

## Sub-Task Review: 2.1 — stdio entry (serveStdio, instructions, stdout purity)

**Reviewed against:** Sub-Task 2.1 (plan.md, Phase 2) · **Overall risk:** Medium (entry correctness on the shipped npx path) · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Module imports cleanly; entry runs on execute | PASS | Entry guard is the realpath-based `isMainEntry` (post-P1 fix); import purity pinned (no stdout/stderr writes, no listeners, double re-evaluation silent) |
| Per-connection factory with connection-time root resolution | PASS | `serveStdio(() => buildServer({ workspaceRoot: resolveRoot(), … }))`; blank-root error passes through verbatim; cwd-failure wrapped with `cause` |
| `instructions` surfaced via the SDK | PASS | v2 mechanism verified: constructor-only `ServerOptions.instructions`; `client.getInstructions()` pinned through a real in-memory connection |
| stderr-only diagnostics; stdout purity | PASS | Banner/errors on stderr; reviewers measured 0 stdout bytes incl. SIGINT/SIGTERM runs |
| `no-orphans` exemption removed (TODO(2.1)) | PASS | Base rule restored; `stdio.ts` is not an orphan (has dependencies); reviewers probed that the base rule still fires on a scratch orphan |
| Tests for the changed code | PASS | stdio suite grew 7 → 13 tests (P1 pin via symlink fixture; version fallback + memoization; purity; instructions) |

### Findings

- **[P0] Blocking:** none.
- **[P1] Main-entry guard false through npm/npx bin symlinks** (silent exit 0 — the shipped npx path would serve nothing; reproduced independently by two lenses across npm install / packed tgz / npx / pnpm-shim): **Addressed** — realpath-comparing `isMainEntry`, exported and pinned with a symlink fixture test.
- **[P2] Instructions test re-implemented the harness** (pre-`try` setup leak): **Addressed** — `instructions?` option on `McpTestHarnessOptions`; test now uses `connectHarness`.
- **[P3] Shutdown robustness** (floating promise, no exit backstop): **Addressed** — `shutdown(signal)` awaits `close()` → `exit(0)` / logged `exit(1)`; `once` semantics + force-quit comment.
- **[P3] Error-path quality** (heuristic classification, duplicate stderr, lost `cause`): **Addressed** — sentinel-prefix pass-through, single `onerror` reporter logging message + cause chain.
- **[P3] Version fallback/memoization untested; overclaiming title:** **Addressed** — fallback (throw + malformed JSON) and single-read pins; title retitled honestly.
- **[P3] Instructions wording overstates `update_sheet`:** **Addressed** — now "read csv/xlsx and update csv sheets by absolute path".
- **[P3] Plan-ID reference in shipped JSDoc:** **Addressed** — invariant phrasing.
- **[P3] Purity-test scope:** **Addressed** — stderr-silent and no-stdin-listener assertions added.
- **[P3] `LOG_PREFIX` differs from the plugin's tag:** **Kept intentionally + documented** — distinct bin-vs-plugin tag aids stderr triage; one-line comment added.
- **Accepted nuance:** `isMainEntry(undefined)` exercises the default-parameter path (ES semantics) — behavior correct (false, no throw); the symlink fixture is the assertion that pins the P1 fix.

### Validation Results

- Tests present: yes — 13 stdio tests; P1 pin cannot regress silently (symlink fixture).
- Validation commands: `pnpm test` PASS (18 files / 178 tests) · `pnpm typecheck` PASS · `lint:biome`/`knip`/`depcruise`/`dup` PASS — independently re-run via `@dh-executor` after the fix round.
- Code-quality evidence: three-lens simplify pass (all `@dh-reviewer`) with a multi-manager bin-launch probe matrix, duplicate-stderr probe, and orphan-rule probe; all scratch probes removed.
- Web validation (MCP Chrome): not applicable.
- Architecture: entry stays thin; resolvers exported for tests; `server.ts` additive `instructions` option approved as a justified deviation (SDK constructor-only mechanism).

### Regression Risk Assessment

- Fixed the shipping (npx) launch path; direct `node dist/…` behavior unchanged; all suites green.
- Residual: `import.meta.main` is unavailable at the Node `>=20.11` floor — the realpath idiom is the portability-correct approach.

### Scope Compliance

- In scope: `stdio.ts` + tests + harness option + depcruise cleanup. The `server.ts` additive change is an approved justified deviation.
- Out of scope detected: none (a reviewer's stray `review.md` write was normalized by the orchestrator into this consolidated section).

### Suggested Next Steps

- [x] Proceed to Sub-Task 2.2 — build & package wiring (tsup second entry, shebang,
      `bin`, `prepare`, knip entry config); the 2.3 smoke must spawn through a symlink-style
      invocation mirroring npx.

---

## Sub-Task Review: 2.2 — Build & package wiring (tsup entries, bin, prepare, knip)

**Reviewed against:** Sub-Task 2.2 (plan.md, Phase 2) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| `pnpm build` emits both bundles, non-empty | PASS | `dist/plugin.js` 1,003,521 B · `dist/mcp/stdio.js` 229,943 B; shebang first line on both; tsup chmods both executable |
| npx-ready package metadata | PASS | `bin.dev-harness-mcp → ./dist/mcp/stdio.js`; tarball includes it (`npm pack --dry-run` 34 files, JSON-clean) |
| SDK/zod external in the MCP bundle; `duckdb` lazy; `yaml` bundled | PASS | Verified in the emitted bundle (no inlined SDK/zod; `require2("duckdb")` lazy) |
| `node dist/mcp/stdio.js < /dev/null` → exit 0, no stdout | PASS | 0 stdout bytes; stderr banner only |
| `prepare` skip/build logic both ways | PASS | Skip ~20 ms (stderr-only message); rebuilds on missing or zero-byte artifacts |
| knip entry config | PASS | No change needed — the `bin` covers `src/mcp/stdio.ts` |
| QA gates green | PASS | 178 tests; typecheck; biome/knip/depcruise/dup; audit |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Existence-only skip masked partial/failed builds** (tsup emits both JS files before `tsc`/`copy-assets`): **Addressed** — `dist/.build-ok` sentinel written as copy-assets' final step; the predicate requires the sentinel + non-empty artifacts; partial and zero-byte states verified to rebuild.
- **[P2] `prepare` broke devDeps-omitted installs** (raw exit 127 when `tsup` is absent): **Addressed** — `require.resolve('tsup')` guard → stderr message + skip (verified with hidden tooling).
- **[P3] Lifecycle-hook stdout pollution** (`npm pack --dry-run --json` unparseable): **Addressed** — all messages on stderr, child build output routed to stderr; JSON output verified parseable.
- **[P3] Silent failure on signal-terminated builds:** **Addressed** — non-numeric status logs a diagnostic before exit 1 (verified with a signal-killed fake npm).
- **[P3] `prepare` ran release-only build work (~2 s of tsc declarations) on the cold path:** **Addressed** — `build:runtime` (tsup + copy-assets) used by `prepare`; full `build` kept for QA/release.
- **Deferred (recorded):** devDependency slimming (`@opencode/plugin`, `yaml`) for the cold npx path → Sub-Task 5.1 (needs real timing; source-mode consumer risk); automated `prepare.mjs` tests (plan sanctions manual verification; predicate kept small); `tsup.config.ts` quote-style drift (informational).
- **Recorded for 4.2 docs:** pnpm 11 consumers installing this package from git need an `allowBuilds` entry (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`); npm/npx unaffected.

### Validation Results

- Tests present: build/artifact/prepare/stdin checks; gates — independently re-run via `@dh-executor` (PASS; logs `/tmp/dh-val-22/`).
- Evidence: second-entry build cost measured (~6–16 ms); bundle-composition probes; pack-JSON probe; signal-kill probe; prepare skip/partial/zero-byte/missing-tooling matrix.
- Web validation (MCP Chrome): not applicable.
- Architecture: no `src/` changes; build surface only.
- Operational note (harness-tooling observation, not a 2.2 issue): `dh.logged_command`'s head/tail window drops earlier segments on compound `&&` commands — pre-existing behavior, recorded for awareness.

### Regression Risk Assessment

- Full `build` semantics unchanged; `prepare` now builds runtime-only (declarations skipped — no current d.ts consumer; acceptable, noted).
- The sentinel lives inside gitignored `dist/` (`git check-ignore` verified); no repo pollution.

### Scope Compliance

- In scope: `tsup.config.ts`, `package.json`, `scripts/prepare.mjs`; `scripts/copy-assets.mjs` touched for the sentinel (build-order justified within "build wiring").
- Out of scope detected: none.

### Suggested Next Steps

- [x] Proceed to Sub-Task 2.3 — `scripts/smoke-mcp.mjs` via `StdioClientTransport`; optionally
      add a symlink-style launch variant mirroring npx (the 2.1 guard is already unit-pinned).

---

## Sub-Task Review: 2.3 — Stdio spawn smoke test + QA gate wiring

**Reviewed against:** Sub-Task 2.3 (plan.md, Phase 2) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Smoke spawns the built binary via `StdioClientTransport` | PASS | 12 checks: exact 7-tool set (sorted names), `plan_create` (+ index row, no `*.tmp`), `plan_read` path parity, `plan_update_status` round-trip + disk re-read, symlink-direct-exec variant |
| Exit non-zero + clear message when the bundle is missing | PASS | `statSync(…, { throwIfNoEntry: false })` + `isFile()` + `size > 0` guard; verified |
| Wired into `qa:check:full` | PASS | Full gate ran green (docker scans included) with `smoke-load` + `smoke-mcp` at the tail |
| No orphan process after success/failure | PASS | `pgrep` verified after success, hung-child, and SIGTERM scenarios |
| Runtime < 10 s | PASS | 235–280 ms internal (≈0.35 s wall) |
| Child anchored on the temp workspace (cwd e2e) | PASS | `DH_WORKSPACE_ROOT` explicitly blanked via `getDefaultEnvironment()` spread — cannot leak into a real workspace |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] `TMPDIR`-symlink false failure** (macOS default `/var` → `/private/var` shape): **Addressed** — workspace canonicalized via `realpathSync`; reproduced under a symlinked `TMPDIR`, then verified fixed.
- **[P2] No signal handling → orphan child + temp leaks on SIGINT/SIGTERM:** **Addressed** — once-only handlers, bounded client close, exit 130/143, single-root idempotent cleanup; verified with a hung child (shutdown ≈5 s, bounded by the request timeout — by design).
- **[P2] No request timeouts** (SDK default 60 s would stall the gate): **Addressed** — 5 s on `connect`/`listTools`/every `callTool`; hung child fails at ~5 s.
- **[P2] Symlink variant did not exercise the npx exec shape:** **Addressed** — the symlink itself is executed directly (shebang + exec bit; exec-bit assertion added); win32 skips with a note.
- **[P3 batch a–l]:** **Addressed** — `checkToolList` exact-name helper for both clients; labeled payload/path guards; `*.tmp` residue scanned after both write paths across both dirs; per-client stderr; single temp root; `process.exitCode`; post-update disk re-read; explicit env isolation; artifact stat guard; close-failure reported; `smoke-mcp` npm alias added.
- **Recorded for 4.2:** AGENTS.md/README gate-description drift (`smoke-mcp` is now part of the full gate).

### Validation Results

- Tests present: 178 unit/integration + the shipped-binary smoke (12 checks).
- Validation commands: smoke green ×multiple runs; `pnpm qa:check:full` exit 0 (full scans); all lint gates green — independently re-run via `@dh-executor` (PASS; no orphans, no temp residue).
- Evidence: TMPDIR-symlink reproduction, SIGTERM hung-child probe, timeout probe, direct-exec symlink probe (~115 ms), timing matrix.
- Web validation (MCP Chrome): not applicable.
- Architecture: no `src/` changes; gate ordering verified (`build` → smokes; `&&` chain prevents stale-artifact runs).

### Regression Risk Assessment

- No source regressions; the full gate now includes the smoke and is green. Script robustness improved across environments (symlinked TMPDIR, signals, hung children).

### Scope Compliance

- In scope: `scripts/smoke-mcp.mjs` + `package.json` wiring/alias.
- Out of scope detected: none.

### Suggested Next Steps

- [x] Phase 2 complete — close the phase, commit.
- [ ] Phase 3 (3.1): plugin cutover — remove tool registration; update registration/bundle
      tests; docs land in Phase 4.

---

## Sub-Task Review: 3.1 — Remove tool registration from plugin.ts (hard cut)

**Reviewed against:** Sub-Task 3.1 (plan.md, Phase 3) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| `pnpm test` green with updated assertions | PASS | 18 files / 181 tests; registration gate rewritten as the hard-cut proof |
| Grep: no `ctx.tool` / `registerPlanTools` in `src/` | PASS | Only the deliberate meta-test stub reference remains (asserts the guard throws) |
| Built bundle loads in isolation | PASS | `test/bundle.test.ts` + `test/plugin-entry.test.ts` green; inlined `define` evaluates in isolation; static hard-cut assertion added |
| Plugin registers zero tools (7 agents / 17 skills) | PASS | Throwing tool/command stubs + `toolTouches` counter + guard meta-tests |
| Dead code removed (`readPlanFile`, index append, shim) | PASS | Zero refs; `duckdb` = 0 in `dist/plugin.js`; `plugin.ts` 299 → 85 lines; `resolvePlanPath` shim retired with importers repointed |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Stale-dist false pass** (gate ran `test` before `build` against the built bundle): **Addressed** — `qa:check:full` reordered to `qa:check → build → test → typecheck → audit → smoke-load → smoke-mcp`; reordered gate verified green end-to-end.
- **[P2] 769 KB (78.6 %) unused SDK barrel in the plugin bundle** (runtime `Plugin.define` import dragged effect + `@opencode/schema`): **Addressed** — deep `define` import via `@opencode/plugin/promise/plugin`; bundle **978,910 → 208,381 B (−79 %)**; `effect` removed from `noExternal`; isolation tests green.
- **[P3 batch]:** **Addressed** — guard self-tests + `toolTouches` counter; dead `location` stub field removed; tautological assertion replaced; comment hygiene across `plugin.ts`/`server.ts` (incl. the protocol-visible `logged_command` description wording)/`workspace.ts`/`logged-command.ts`/`sheet-tools.ts`; `bundle.test.ts` allowlist emptied + static hard-cut assertion.
- **Recorded (no action):** optional dist-freshness mtime check (moot for the gate after the reorder); pre-parsed records JSON to drop the yaml parser (future design decision); sequencing note below.

### Validation Results

- Tests present: yes — hard-cut gate (throwing stubs + counters + meta-tests) + static bundle assertion.
- Validation commands: `pnpm build && pnpm test` PASS (18/181) · `typecheck` · `lint:biome`/`knip`/`depcruise`/`dup` PASS · both smokes PASS · **reordered `qa:check:full` exit 0** (docker scans included) — independently re-run via `@dh-executor` (PASS).
- Evidence: bundle segment analysis, isolated-eval timing probes, unhandled-rejection probe for fire-and-forget regressions.
- Web validation (MCP Chrome): not applicable.
- Architecture: plugin = agents/skills only (single responsibility restored); tools single-sourced in the MCP server; helpers fully covered.

### Regression Risk Assessment

- Intended hard cut; gate hermetic (build → test); bundle −79 %; no behavior change beyond registration removal.
- **Release-gating condition (flag to `dh-final-review`):** until Sub-Task 4.3 wires the `dh` MCP server into projects, the harness has **zero tools** — already observable live (this session's `dh.*` tools disappeared when the cut landed). The hard cut and the wiring must ship in the same release.

### Scope Compliance

- In scope: the cut + test updates. Orchestrator-sanctioned extensions (recorded): gate reorder, bundle slim via deep import, `bundle.test.ts` tightening — all direct hard-cut hardening.
- Out of scope detected: docs/text refs deferred to Phase 4, as planned.

### Suggested Next Steps

- [x] Phase 3 complete — close the phase, commit.
- [ ] Phase 4: content, docs & project wiring (4.1 naming flip → 4.4 demo) — the
      zero-tools window closes at 4.3/4.4 with the demo config + validation.

---

## Sub-Task Review: 4.1 — Skills + agents naming flip (canonical mapping table)

**Reviewed against:** Sub-Task 4.1 (plan.md, Phase 4) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Zero stale dot-form tool refs in `skills/` + `agents/` | PASS | `rg` → 0 matches; new names present in exactly the 10 changed files with per-file counts matching the old refs |
| Canonical naming sentence per tool-introducing file | PASS | One sentence per file; unified meaning; executor singular template normalized |
| Rename-only discipline | PASS | Token-normalized comparison (HEAD + mappings vs current minus the sentence) byte-identical for all 10 files |
| Fallback language preserved | PASS | Per-file "Fallback…" counts unchanged (25 → 25 across changed files) |
| Harness audit + links green | PASS | `audit.mjs` failFindings 0; `lint:links` 23 refs, none dead |
| Line limits | PASS | Max skill 239/250; max agent 73/300 |

### Findings

- **[P0–P2]:** none.
- **[P3] Sentence-shape variance** (singular/plural, placeholder vs literal): **Addressed** — executor sentence normalized to a singular template; `dh-review`/`dh-final-review` referents fixed ("The plan tools").
- **[P3] `dh-setup` sentence placement** (inside the generated AGENTS.md template rather than the first tool mention): **Confirmed intentional** — plan-tools introduction; 4.3 reuses this sentence (no second variant).
- **[P3] Residual "bundled/plugin tools" wording** contradicting MCP delivery: **Addressed** — four files aligned (`skills/index.md`, `agents/dh-documentor.md`, `agents/dh-executor.md`, `skills/dh-setup/SKILL.md`).
- **Simplify method note (recorded deviation):** a single consolidated three-lens pass was run (docs-only rename; per-lens separation adds no incremental signal); reuse/consistency, quality/prose, and efficiency (n/a) were all covered explicitly.
- **Forward note:** `dh-setup` at 239/250 lines — the 4.3 wiring subsection must fit or extract first (headroom clause added to plan.md 4.3 scope).

### Validation Results

- Validation commands: zero-stale grep; per-file new-name counts; `audit.mjs` PASS; `lint:links` PASS; `pnpm test` 18/181 unchanged — independently re-run via `@dh-executor` (PASS).
- Evidence: token-normalized rename-only proof; fallback-language conservation; line-count table.
- Web validation (MCP Chrome): not applicable (docs).
- Regression: none (docs-only; test suite unchanged).
- Note: `reports/audit.*` churn from the audit runs is excluded from this commit (regenerated at release, 5.2).

### Scope Compliance

- In scope: the 10 `skills/` + `agents/` files. `docs/plans/**` untouched (historical records keep the dot form).
- Out of scope detected: none.

### Suggested Next Steps

- [x] Proceed to Sub-Task 4.2 — repo docs & examples (README, AGENTS.md, LOADING.md MCP
      reference, `opencode.example.jsonc`), including the recorded gate-description drift
      (`smoke-mcp` now in `qa:check:full`).

---

## Sub-Task Review: 4.2 — Repo docs & examples (README, AGENTS.md, LOADING.md, skills/index.md, opencode.example.jsonc)

**Reviewed against:** Sub-Task 4.2 (plan.md, Phase 4 — designated documentation sub-task) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Commands in the new docs sections run and match | PASS | Runnable ones executed (node-dist fallback: exit 0 / 0 stdout; JSONC parse; links; gates); `opencode mcp list` + cold-npx framed as 5.1 verification steps, not completed-run claims |
| Zero stale tool refs in the four files | PASS | `rg` → 0 matches |
| LOADING.md carries the exact npx command array | PASS | Byte-identical to the shipped contract; snippet identity verified ×3 (4th copy lands in 4.4) |
| README lists all 7 tools | PASS | Purpose table + link to LOADING's canonical inputs/returns table |
| Gate description accurate | PASS | build→test order, smoke rows, QA heading fixed |

### Findings

- **[P0–P1]:** none. **Fact-check:** the wiring contract is accurate — command array vs `package.json` bin, protocol/legacy claim vs `src/mcp/stdio.ts`, `DH_WORKSPACE_ROOT` vs `src/mcp/workspace.ts`, naming vs 4.1, gate order vs `package.json`, anchors resolved.
- **[P2] AGENTS QA heading contradicted the table contents:** **Addressed** — "release gate `qa:check:full` runs all of these (fast subset `qa:check`)".
- **[P2] Cache-bust command invalid on npm 11** (`npx clear-npx-cache`): **Addressed** — `npm cache npx rm --force` primary; legacy label kept; plan.md 5.1 updated to match.
- **[P2] README adds a fourth snippet copy not covered by 5.1's identity check:** **Addressed** — plan.md 5.1 now verifies FOUR copies (README, LOADING, example, demo).
- **[P2] Example checklist overstated `opencode mcp list` output:** **Addressed** — server/status line + separate expected-tools line.
- **[P3 batch]:** **Addressed** — `dist/.build-ok` wording; `allowBuilds` resolved-spec form + `pnpm approve-builds`; README table link; csv/xlsx nuance; `dh_logged_command` trust-boundary note; installation sentence; AGENTS wording + prose nits.
- **[P3-adjacent] Stale verification blocks** (`opencode debug skills`/`commands` don't exist on v2.0.18; example checklist claimed 12/17 skills, 6/7 agents): **Addressed** — replaced with valid `debug agents` / `debug config` / `mcp list` checks; current 7 agents + 17 skills recorded.
- **Recorded:** `timeout.startup: 300000` provisional (5.1 measures); cwd parenthetical host assumption (5.1 confirms); `docs/evolve/**` historical names excluded from the 5.1 grep.
- **Simplify method note (recorded):** consolidated three-lens pass (docs-only; reuse/quality/efficiency covered in one reviewer — proportionate).

### Validation Results

- Validation commands: zero-stale greps; `lint:links` 26 refs OK; `audit.mjs` PASS; JSONC parse OK; snippet identity ×3; `pnpm test` 18/181 unchanged — independently re-run via `@dh-executor` (PASS; reports churn reverted).
- Evidence: source cross-checks (stdio.ts legacy default, workspace.ts precedence), anchor resolution, gate-order transcription.
- Web validation (MCP Chrome): not applicable.

### Regression Risk Assessment

- Docs-only; no code/config behavior change. The docs now describe the shipped hard-cut reality; the zero-tools window closes for projects at 4.3/4.4.

### Scope Compliance

- In scope: the four files (skills/index.md audited, unchanged — already consistent after 4.1).
- Out of scope detected: none.

### Suggested Next Steps

- [x] Proceed to Sub-Task 4.3 — `dh-setup` wiring step (consent-based `mcp.servers.dh`
      merge + prewarm + verify); cap watch at 239/250 lines.
