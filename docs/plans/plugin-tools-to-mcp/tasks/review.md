# Sub-Task Review: 1.1 Server factory + MCP test harness + tools/list contract

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
