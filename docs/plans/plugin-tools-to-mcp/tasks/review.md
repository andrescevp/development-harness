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
