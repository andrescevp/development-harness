---
title: Plugin Tools to MCP Server
slug: plugin-tools-to-mcp
description: Remove opencode plugin tool registration; serve all 7 harness tools from a project-scope local MCP stdio server (@modelcontextprotocol/server v2) started via npx from the git repo; flip docs/skills/configs to dh_* naming (full parity, hard cut)
created: 2026-10-19
updated: 2026-10-19
status: Pending
active: true
tags: [plan, mcp, refactor]
project: dev-harness-skills
---

# Plan: Plugin Tools to MCP Server

## Objective

Refactor `dev-harness-skills` so the 7 harness tools (`plan_read`,
`plan_update_status`, `plan_create`, `read_sheet`, `update_sheet`,
`sheet_schema`, `logged_command`) are served by a **local MCP stdio server**
built on `@modelcontextprotocol/server` v2, started by opencode **per project**
via `npx` from the git repository. The plugin stops registering tools entirely
(agents + skills only). All in-repo references flip to the MCP naming
(`dh_plan_read` / `tools.dh.plan_read`) in the same release.

Deliverable: one phased plan executed by the harness loop; end state verified
by `pnpm qa:check:full`, a stdio spawn smoke test, and a real opencode session
in `demo-project` calling the MCP tools.

## Requirements Snapshot

From `./docs/plans/plugin-tools-to-mcp/sdd.md` (source of truth; IDs stable):

- **R1:** Plugin registers ZERO tools (hard cut; no dual registration/aliases).
- **R2:** MCP server exposes exactly 7 capabilities with parity contracts —
  identical input parameters and JSON payloads (`{ ok, path, plan }` for plan
  tools; sheet result; `{ ok, exitCode, logPath, head, tail, truncated }` for
  `logged_command`); errors as readable `isError` results with the same
  message strings (missing plan, invalid status, phase gate, path escapes,
  symlink rejection).
- **R3:** Local stdio server, started per project from that project's opencode
  config (`mcp.servers.*`, `type: "local"`); project-scoped availability.
- **R4:** Workspace root resolved at runtime: `cwd` default +
  `DH_WORKSPACE_ROOT` override; plan paths stay anchored under
  `<root>/docs/plans` with all existing traversal rejections.
- **R5:** Startable without a second clone: `npx` from
  `github:andrescevp/development-harness` using a package `bin`
  (`dev-harness-mcp`) + `prepare` build for git-install contexts;
  `node <dist>/mcp/stdio.js` documented fallback.
- **R6:** Protocol `2026-07-28` pinned in shipped config; server still serves
  2025-era (`initialize`) clients from the same factory.
- **R7:** `dh-setup` offers consent-based wiring of the project
  `mcp.servers.dh` entry + cache prewarm + connection verification; never
  silent.
- **R8:** Atomic naming flip in one release; canonical:
  `dh_<tool>` direct / `tools.dh.<tool>` in Code Mode.
- **R9:** Short MCP `instructions` string returned by the server.
- **R10:** Atomic plan-file writes (temp + rename, same filesystem); no
  `await` between read and write in read-modify-write flows.
- **R11:** QA gates stay green; TDD: in-memory MCP client tests + stdio spawn
  smoke test of the built binary.
- **R12:** Stdout purity (protocol channel only; logs to stderr); process
  exits on stdin EOF; no keep-alive handles.

Acceptance criteria: **AC1** registration test proves 0 tools; **AC2**
in-memory client parity + error tests; **AC3** `scripts/smoke-mcp.mjs`
spawns built binary, lists 7 tools, calls `plan_read`, exits 0, wired into
`qa:check:full`; **AC4** `opencode mcp list` shows `dh` connected in
demo-project + live session call recorded; **AC5** cold-start npx handshake
verified + timeout documented; **AC6** repo-wide grep shows zero stale tool
references; **AC7** `pnpm qa:check:full` exits 0; **AC8** index.md row +
plan closure.

## Scope

- **In scope:** `src/mcp/*` module (entry, adapters, workspace ACL); build &
  package wiring (tsup second entry, `bin`, `prepare`, knip); plugin tool
  removal + test updates; atomic write hardening; docs/skills/agents/example
  updates; `dh-setup` wiring step; demo-project config + validation; smoke
  script + QA wiring; real-session + cold-npx verification; release
  (qa gate, semver, index closure).
- **Out of scope:** MCP resources/prompts; `outputSchema`/
  `structuredContent`; npm publishing; workspace split or second repo;
  global-scope MCP config; changes to plan format or payload shapes; agent/
  skill registration mechanics.

## Assumptions and Constraints

- Node >= 20.11 (repo `engines`); `@modelcontextprotocol/server` requires
  Node >= 20. Host: opencode v2.0.18 verified for local MCP `protocol`.
- New deps: `@modelcontextprotocol/server` (^2.3.x) + `zod` (^4.2) runtime;
  `@modelcontextprotocol/client` dev (tests + smoke).
- Private repo: npx git installs use existing git credentials; no registry.
- Keep QA stack: biome, knip, jscpd, dependency-cruiser, OSV, semgrep,
  vitest, tsc. Repo rules: TDD, files <= 300 lines, SOLID/SRP for new
  modules.
- Plugin bundle constraint unchanged (bare-import-free `dist/plugin.js`);
  MCP bundle runs with real node_modules (npx cache) and keeps `duckdb`
  external + lazy.
- Decision record: the prior `dh.plan_read` dot form was plugin-namespace
  specific; MCP host naming is `<server>_<tool>` — the flip back to
  underscore is intentional, not a regression (see domain-check.md).

## Risks and Areas Requiring Care

- **Cold-start npx latency** (clone + install + prepare + duckdb native) may
  exceed the 30 s MCP `startup` timeout → prewarm in dh-setup; documented
  `timeout.startup` bump; node-dist fallback.
- **npx cache staleness** after repo updates → documented cache-bust;
  optional pinned `#vX.Y.Z` spec (deferred decision).
- **`prepare`-on-git-install semantics**: must build in the git checkout and
  skip when dist exists (local installs stay fast); verify with a real cold
  run (5.1).
- **Stdout pollution** bricks the connection → `console.error` only;
  enforced by review + smoke handshake.
- **cwd assumption** (host starts server elsewhere) → `DH_WORKSPACE_ROOT`
  override + tests + setup verification.
- **Naming flip atomicity** → single mapping table sub-task + repo-wide grep
  acceptance check excluding historical `docs/plans/**`.
- **duckdb in npx cache**: native install may fail there; sheet tools must
  degrade alone (lazy load already isolates) — plan tools keep working.
- **Mixed old/new during transition** (old plugin + new MCP): expected with
  hard cut; noted for release notes.

## Core concepts

**opencode local MCP wiring** (project `opencode.jsonc`):

```jsonc
{
  "mcp": {
    "servers": {
      "dh": {
        "type": "local",
        "command": ["npx", "-y", "--package=github:andrescevp/development-harness", "dev-harness-mcp"],
        "protocol": "2026-07-28"
      }
    }
  }
}
```

Tool naming: server `dh` + tool `plan_read` → `dh_plan_read` (direct) and
`tools.dh.plan_read(...)` under Code Mode (default). Permissions in consumer
projects match `dh_*`.

**MCP server factory** (shape; `src/mcp/stdio.ts`):

```ts
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.js';
import { resolveWorkspaceRoot } from './workspace.js';

serveStdio(() => buildServer({ workspaceRoot: resolveWorkspaceRoot() }));
```

**Adapter result contract** (parity):

```ts
return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
// errors:
return { content: [{ type: 'text', text: message }], isError: true };
```

## Phases

### Phase 1: MCP server module (core contracts)

- **Status:** Completed

#### Sub-Task 1.1: Server factory + MCP test harness + tools/list contract

- **Status:** Completed
- **Objective:** Introduce `src/mcp/server.ts` exporting `buildServer({ workspaceRoot, version })` that registers all 7 tools (names, descriptions, Zod v4 input schemas, thin handlers delegating to the existing helpers in `src/tools/*`), plus the MCP test harness (in-memory client) and the failing-first `tools/list` contract test.
- **Related Requirements:** R2, R11, AC2
- **Dependencies and Preconditions:** none (first task); `pnpm install` available for new deps.
- **In Scope for This Sub-Task:** add runtime deps `@modelcontextprotocol/server@^2.3.x` and `zod@^4.2`; add dev dep `@modelcontextprotocol/client@^2.3.x`; create `src/mcp/server.ts` with the factory; register all 7 tools with exact current descriptions and schemas (plan tools' handler bodies may call helpers directly — full error mapping lands in 1.3/1.4); create test helper `src/__tests__/helpers/mcp.ts` (linked `InMemoryTransport.createLinkedPair()` pair, `Client` connect, temp-workspace factory, teardown); write the failing-first test `src/mcp/__tests__/server.test.ts` asserting `tools/list` returns exactly the 7 names with non-empty descriptions.
- **Out of Scope for This Sub-Task:** stdio entry (`serveStdio`) — later 2.1; error-mapping hardening — 1.3/1.4; atomic writes — 1.5; build wiring — 2.2.
- **Instructions:** import `McpServer` from `@modelcontextprotocol/server` and `* as z from 'zod/v4'`; signature `server.registerTool(name, { description, inputSchema }, handler)`. Keep handlers as thin adapters over `parsePlan`/`setStatus`/`buildPlanTemplate`/`resolvePlanPath`, `readSheet`/`updateSheet`/`sheetSchema`, `runLoggedCommand` — the parity layer, not new logic. Test harness: build a fresh server per test, connect an in-memory client, expose `callTool`, close both after each test (deterministic teardown per SDK testing guide).
- **Acceptance Criteria:** `pnpm test` shows the new contract test green; exactly 7 registered tools; no other test regresses; `package.json` carries the three new deps.
- **Cautionary Points (Risks & Edge Cases):** do NOT bundle the SDK into `dist/plugin.js` later — the SDK dep must stay external for the MCP entry only (2.2 handles); in-memory pairs are 2025-era instances (fine for tests); avoid `console.log` anywhere in `src/mcp/*` from the start.
- **Implementation Suggestions:** keep files small — `server.ts` (factory + registration), `tools.ts` (per-tool adapters) if registration exceeds ~300 lines; description strings copied verbatim from the current `src/plugin.ts` tool block (source of truth for parity).
- **Testing Suggestions:** `pnpm test -- src/mcp` for the focused run; assert sorted tool names equality against a literal list; assert every description length > 20.
- **Done When:** the factory builds against a temp workspace and `tools/list` contract test passes; deps committed in `package.json` + lockfile.

#### Sub-Task 1.2: Workspace root resolution ACL

- **Status:** Completed
- **Objective:** Implement `src/mcp/workspace.ts` — `resolveWorkspaceRoot({ env, cwd })`: `DH_WORKSPACE_ROOT` wins when set (resolved absolute), else `process.cwd()`; rejects empty/missing results with a descriptive error; unit tests for override precedence, cwd default, and rejection.
- **Related Requirements:** R4, AC2
- **Dependencies and Preconditions:** 1.1 (module layout).
- **In Scope for This Sub-Task:** `src/mcp/workspace.ts` + `src/mcp/__tests__/workspace.test.ts`; wire the factory (`buildServer`) to receive the resolved root as an injected parameter (no env reads inside handlers).
- **Out of Scope for This Sub-Task:** changing `resolvePlanPath` anchoring logic (stays as-is; it already receives the root); symlink/`..` rejection tests through the MCP surface (part of 1.3).
- **Instructions:** keep the function pure (env and cwd as arguments with production defaults injected at the entry, 2.1); never fall back to the process CWD inside `resolvePlanPath` (existing error message "no workspace root available; pass an explicit `path` input" must remain reachable).
- **Acceptance Criteria:** tests cover: env set → used (absolute resolution); env unset → cwd used; both empty → throws descriptive error; handler code contains zero direct env/cwd reads (grep).
- **Cautionary Points (Risks & Edge Cases):** a relative `DH_WORKSPACE_ROOT` must resolve against the server cwd (document the precedence); symlinked cwd is acceptable (only plan-relative traversal is guarded).
- **Implementation Suggestions:** `path.resolve` normalization; export a small type `WorkspaceRoot = string` alias for readability.
- **Testing Suggestions:** vitest with `vi.stubEnv`/explicit args (prefer explicit args over env stubbing for purity).
- **Done When:** workspace tests green; factory signature consumes the injected root; no handler reads env directly.

#### Sub-Task 1.3: Plan-lifecycle adapters (plan_read / plan_update_status / plan_create)

- **Status:** Completed
- **Objective:** Bring the three plan tools to full parity: exact input schemas, exact success payloads (`{ ok: true, path, plan }`), and exact error behavior mapped to `isError` results with the same message strings.
- **Related Requirements:** R2, R4, AC2
- **Dependencies and Preconditions:** 1.1 (factory + harness), 1.2 (workspace root).
- **In Scope for This Sub-Task:** Zod schemas mirroring the current contract exactly — `plan_read` (`slug?`, `path?`), `plan_update_status` (`slug?`, `path?`, `target: enum[phase,subtask]`, `index: string`, `status: enum[Pending, In Progress, Completed]`; required: target/index/status), `plan_create` (`slug`, `title`, `objective`, `phases: array<{title, subTasks: array<{title}>}>`, `updateIndex?`); success payloads byte-compatible (`JSON.stringify` of the same objects); error mapping: catch helper throws and return `{ content: [{ type: 'text', text: message }], isError: true }` (missing plan file "plan file not readable: <file>", invalid status, phase-completion gate "phase N cannot complete: sub-task N.M is …", path escape "path escapes docs/plans: …", symlink rejection, invalid slug); `plan_create` refuses existing files with the current message and supports `updateIndex` (index row append parity); export an `readPlanFile` helper from `src/tools/plan-lifecycle.ts` (moved from `src/plugin.ts`, same error message) and use it from the adapter. Also consolidate the 1.1 adapter copies (`readPlanFile`, `appendPlanIndexRow`) into `plan-lifecycle.ts` — shared `docs/plans` anchor, symlink-validated index append, exclusive-create semantics — and record the accepted schema tightenings (nested required fields, `additionalProperties: false`) with a schema-level assertion test. Extract the path ACL (`resolvePlanPath` + `assertNoSymlinks`) into `src/tools/plan-paths.ts` FIRST — the consolidation would otherwise breach the 300-line file cap (`plan-lifecycle.ts` sits at 299) — and harden the symlink check to cover the anchor components themselves (`docs`, `docs/plans`). Record the input-validation error form (SDK-generated `isError` text for bad enums) as an accepted deviation from the legacy 'invalid status' message, pinned by an assertion test; revisit only if strict R2 parity is mandated. Prefer a named `INITIAL_PHASE_STATUS` constant over `PHASE_STATUSES[0]` for the index-row cell (tuple-order coupling).
- **Out of Scope for This Sub-Task:** atomic writes (1.5); plugin-side deletion of the old copy (3.1).
- **Instructions:** keep handlers fully synchronous between read and write (no `await` across `fs.readFileSync` → `writeFileSync`), preserving the concurrency invariant; descriptions copied from the current plugin tool block verbatim.
- **Acceptance Criteria:** tests cover, per tool: happy path payload parity (deep-equal against fixture expectations), each error case returns `isError: true` with the expected message prefix, traversal rejections (`..`, absolute outside anchor, slug with separators, symlink) via the MCP surface, phase-gate refusal; `plan_create` → `plan_read` roundtrip on a temp workspace.
- **Cautionary Points (Risks & Edge Cases):** `updateIndex` must resolve `index.md` under the injected workspace root (never env); CRLF plan fixtures must keep roundtrip stability; error messages are part of the doc contract — do not rephrase.
- **Implementation Suggestions:** copy fixtures from `src/__tests__/fixtures/plans/` (existing canonical plan fixture); use a `mkdtemp` workspace per test with `docs/plans/<slug>/plan.md` laid out from fixtures.
- **Testing Suggestions:** `pnpm test -- src/mcp` plus the existing `src/__tests__/plan-lifecycle.test.ts` must stay green (it pins the helper behavior).
- **Done When:** all plan-tool parity/error tests pass through the in-memory MCP client.

#### Sub-Task 1.4: Sheet + logged_command adapters

- **Status:** Completed
- **Objective:** Bring `read_sheet`, `update_sheet`, `sheet_schema`, and `logged_command` to full parity through the MCP surface.
- **Related Requirements:** R2, R12, AC2
- **Dependencies and Preconditions:** 1.1 (factory + harness).
- **In Scope for This Sub-Task:** Zod schemas exactly as current (`path` required for sheet tools; `query?` + `limit?` for `read_sheet`; `path`+`query` required for `update_sheet`; `command` required, `logName?`, `timeoutMs?` for `logged_command`); success payloads identical (`SheetResult` JSON; `LoggedCommandResult` JSON with `ok/exitCode/logPath/head/tail/truncated`); `logged_command` never throws for command failures — non-zero exit codes stay in the payload; unexpected thrown errors map to `isError` via an async-safe guard (note: sheet helpers never throw — `withSheet` converts failures to `ok: false` payloads, and legacy parity keeps those as normal results).
- **Out of Scope for This Sub-Task:** changing duckdb behavior or the logged-command strategy; OS-specific wrapper changes.
- **Instructions:** keep the lazy duckdb accessor untouched (external require); run the sheet tools against a temp CSV fixture (2–3 columns, a few rows); run `logged_command` with a tiny portable command (e.g. `node -e "console.log('x')"`), plus a failing command to assert `ok: false` payload semantics.
- **Acceptance Criteria:** tests cover happy paths for all four tools plus: unreadable file → `ok: false` payload with a `duckdb error:` message (legacy parity; NOT `isError` — helpers never throw); non-existent csv → same shape; failing shell command → normal result with `ok: false`, non-zero `exitCode`, `logPath` present; payloads deep-equal the legacy `SheetResult`/`LoggedCommandResult` shapes.
- **Cautionary Points (Risks & Edge Cases):** `logged_command` child output must never leak to the server's stdout (exec captures; keep it that way — assert handshake purity again in 2.3); Windows wrapper untouched; timeout path (`timeoutMs`) returns exitCode 1-style failure per current behavior.
- **Implementation Suggestions:** reuse existing unit fixtures/patterns from `src/__tests__/sheet-tools.test.ts` and `logged-command.test.ts`; keep temp logs in the OS temp dir (existing helper behavior).
- **Testing Suggestions:** `pnpm test -- src/mcp src/__tests__/sheet-tools.test.ts src/__tests__/logged-command.test.ts`.
- **Done When:** all four tools verified through the in-memory MCP client with payload parity and error mapping.

#### Sub-Task 1.5: Atomic plan-file writes

- **Status:** Completed
- **Objective:** Harden `plan_update_status` and `plan_create` writes: new `src/lib/atomic-write.ts` with `writeFileAtomic(file, contents)` (write `<file>.<pid>.<rand>.tmp` in the same directory → `fs.renameSync`), used by both flows; tests prove no temp leftovers and original content preserved on failure.
- **Related Requirements:** R10, AC2
- **Dependencies and Preconditions:** 1.3 (plan tool flows exist through MCP).
- **In Scope for This Sub-Task:** `src/lib/atomic-write.ts` + tests; update `setStatus` call site in the MCP adapter and `plan_create` file creation to use it; `resolvePlanPath`/validation untouched. The atomic helper must support an exclusive-create mode (`plan_create` must never clobber an existing file: temp write + EEXIST-safe link/rename semantics) in addition to overwrite mode. Wire final-component `O_NOFOLLOW` semantics into the helper's I/O paths (read via fd; `O_WRONLY|O_TRUNC|O_NOFOLLOW` for status writes; `O_APPEND|O_NOFOLLOW` for the index append) to close the path ACL's check-then-use TOCTOU for the final component; parent-component swaps remain accepted residual.
- **Out of Scope for This Sub-Task:** write ordering across concurrent processes (out of scope; single-process invariant preserved); fsync/durability guarantees beyond rename semantics.
- **Instructions:** same-directory temp file guarantees rename atomicity on POSIX; clean up the temp file in a `finally` when rename fails; keep the API synchronous to preserve the no-await invariant.
- **Acceptance Criteria:** unit tests: content written exactly; no `*.tmp` files remain after success; on simulated failure (target directory removed mid-flow or rename onto an invalid path) the original file content is unchanged and the error propagates; existing plan-lifecycle tests stay green.
- **Cautionary Points (Risks & Edge Cases):** permission-preserving behavior (created files default mode is fine); Windows rename-over-existing semantics (Node handles; note only).
- **Implementation Suggestions:** `crypto.randomBytes(4).toString('hex')` suffix; avoid jscpd duplication with a single shared helper used by both flows.
- **Testing Suggestions:** `pnpm test -- src/lib src/mcp`.
- **Done When:** atomic writes in place, tested, zero temp-file residue in tests, all prior tests green.

### Phase 2: Packaging & startup path

- **Status:** Completed

#### Sub-Task 2.1: stdio entry (serveStdio, instructions, stdout purity)

- **Status:** Completed
- **Objective:** Create `src/mcp/stdio.ts` — the `bin` entry: `serveStdio(factory)` building the server with `resolveWorkspaceRoot()` at connection time, the short harness `instructions` string, a `console.error` readiness banner (stderr only), and clean shutdown (SIGINT/SIGTERM close handler; stdin EOF teardown relies on the SDK).
- **Related Requirements:** R3, R6, R9, R12, AC3
- **Dependencies and Preconditions:** Phase 1 complete (factory + workspace ACL).
- **In Scope for This Sub-Task:** `src/mcp/stdio.ts`; package version resolution for `McpServer({ name, version })` (read `../../package.json` relative to `import.meta.url` with a hard-coded fallback constant — must work from the npx cache layout); `instructions` text (one line: plan lifecycle under `docs/plans`, workspace-anchored, phase-gate rules); error-path logging to stderr; wrap `process.cwd()` failures (e.g. a deleted cwd → raw ENOENT) in the same descriptive workspace-root error at the entry.
- **Out of Scope for This Sub-Task:** build/tsup wiring and the shebang (2.2); spawn smoke (2.3).
- **Instructions:** instantiate a fresh `McpServer` inside the factory (per-connection instance per SDK v2 `serveStdio` semantics); never write to stdout — a single `console.log` breaks the protocol channel; keep the process alive only via the transport (no timers/watchers). Verify against the v2 API reference the exact mechanism for server `instructions` (constructor option or server capability) — implement with whichever the SDK exposes, noted in the task notes.
- **Acceptance Criteria:** importing the module does not start the server (entry executes on run, keeps testability); running `node dist/mcp/stdio.js < /dev/null` (after 2.2 build) exits 0 without stdout output; in-memory tests can construct the same server factory and read the instructions via the client (SDK accessor — verified during implementation).
- **Cautionary Points (Risks & Edge Cases):** `serveStdio` default posture also serves 2025-era clients — keep it (graceful degradation per R6); do not set `legacy: 'reject'`; the banner string must not contain control characters.
- **Implementation Suggestions:** structure `stdio.ts` as a tiny entry: version resolution + `serveStdio(() => buildServer({...}))` + signal handlers; keep it under ~80 lines.
- **Testing Suggestions:** `node dist/mcp/stdio.js < /dev/null; echo $?` manual check in 2.2/2.3; unit import test asserting no side effects at import.
- **Done When:** stdio entry exists, imports cleanly, and the module is ready for build wiring.

#### Sub-Task 2.2: Build & package wiring (tsup entries, bin, prepare, knip)

- **Status:** Completed
- **Objective:** Produce `dist/mcp/stdio.js` from the standard build; make the package npx-runnable: `bin` entry, `prepare` build for git installs, tsup second entry with a shebang banner; keep knip/depcruise/biome green.
- **Related Requirements:** R5, R11, AC5, AC7
- **Dependencies and Preconditions:** 2.1 (entry module exists).
- **In Scope for This Sub-Task:** `tsup.config.ts`: `entry: { plugin: 'src/plugin.ts', 'mcp/stdio': 'src/mcp/stdio.ts' }` → `dist/plugin.js` + `dist/mcp/stdio.js`; `banner: { js: '#!/usr/bin/env node' }` (harmless in the ESM plugin bundle — Node allows shebangs in ESM); keep `clean: true`, externals as-is (deps auto-external: `@modelcontextprotocol/server`, `zod`, `duckdb` lazy; `yaml` still bundled with the browser alias); `package.json`: `"bin": { "dev-harness-mcp": "./dist/mcp/stdio.js" }`, `"prepare": "node scripts/prepare.mjs"`, keep `"files": ["dist"]`; new `scripts/prepare.mjs` — skip when `dist/plugin.js` and `dist/mcp/stdio.js` exist, else run `npm run build` (git-install context always lacks dist → builds; local re-installs stay fast); knip config: add explicit entry for `src/mcp/stdio.ts` if knip flags it; `pnpm build` must emit both bundles.
- **Out of Scope for This Sub-Task:** changing the plugin bundle's no-bare-imports constraint (bundle test stays); npm publishing.
- **Instructions:** verify with `pnpm build && node dist/mcp/stdio.js < /dev/null` (expect exit ~0, no stdout bytes); verify `prepare.mjs` skip logic both ways (dist present → skip; dist removed → builds); confirm `dist/mcp/stdio.js` contains no bundled SDK (`@modelcontextprotocol/server` stays an external import) and starts with the shebang.
- **Acceptance Criteria:** `pnpm build` green and both artifacts exist non-empty; `pnpm lint:knip` + `pnpm lint:depcruise` + `pnpm lint:biome` green; `node dist/mcp/stdio.js < /dev/null` exits without stdout output; `scripts/prepare.mjs` behaves per the skip rule.
- **Cautionary Points (Risks & Edge Cases):** `pnpm install` triggers `prepare` — the skip logic must prevent surprise builds; `pnpm-workspace.yaml` `onlyBuiltDependencies` covers duckdb already; the MCP bundle must not inline the native duckdb module.
- **Implementation Suggestions:** keep a single tsup config (two entries) rather than split configs (avoids `clean` races); if the shebang banner on `dist/plugin.js` concerns the bundle test, verify the test still passes (it scans imports only).
- **Testing Suggestions:** `pnpm build && pnpm test` (bundle + entry tests), then the manual stdio checks; `git status` confirms `dist/` ignored.
- **Done When:** build emits both bundles; package metadata npx-ready; all lint/QA checks green.

#### Sub-Task 2.3: Stdio spawn smoke test + QA gate wiring

- **Status:** Completed
- **Objective:** `scripts/smoke-mcp.mjs` — spawn the built `dist/mcp/stdio.js` via `StdioClientTransport` (from `@modelcontextprotocol/client/stdio`), assert `tools/list` = 7 tools, call `plan_create` + `plan_read` against a fresh temp workspace, print a compact result, exit 0; wire into `qa:check:full`.
- **Related Requirements:** R11, R12, AC3
- **Dependencies and Preconditions:** 2.2 (built bundle), Phase 1 (tools).
- **In Scope for This Sub-Task:** the smoke script; `package.json` `qa:check:full` gains `&& node scripts/smoke-mcp.mjs` (after build); failure output with the spawn stderr captured for diagnosis; close the client/child cleanly (no orphan node processes).
- **Out of Scope for This Sub-Task:** cold npx timing (5.1); CI pipelines (none in repo).
- **Instructions:** the script must fail loudly on: missing dist, spawn error, fewer/more than 7 tools, missing payload keys; set the child `cwd` to the temp workspace to exercise `process.cwd()` anchoring end-to-end; keep runtime < 10 s.
- **Acceptance Criteria:** `node scripts/smoke-mcp.mjs` exits 0 with the built bundle; exits non-zero with a clear message when the bundle is missing; `pnpm qa:check:full` includes and passes it; no orphan process after both success and failure runs.
- **Cautionary Points (Risks & Edge Cases):** kill the child on any assertion failure (try/finally with `client.close()`); avoid hard-coded timing races — await protocol responses, never `sleep`; the temp workspace must be cleaned up.
- **Implementation Suggestions:** mirror the xdg-free temp-dir pattern used by `scripts/smoke-load.mjs`; print one line per check ("ok — lists 7 tools").
- **Testing Suggestions:** run the script directly, then `pnpm qa:check:full` once (may be slow: includes scans).
- **Done When:** smoke script green locally and wired into the full gate.

### Phase 3: Plugin cutover

- **Status:** Completed

#### Sub-Task 3.1: Remove tool registration from plugin.ts + update registration/bundle tests

- **Status:** Completed
- **Objective:** Delete the `ctx.tool.transform` block (`registerPlanTools`), tool imports, and the local `readPlanFile` from `src/plugin.ts`; update tests to assert the plugin registers agents + skills only and never touches the tool domain.
- **Related Requirements:** R1, AC1, AC7
- **Dependencies and Preconditions:** Phases 1–2 complete (MCP surface exists, so no capability gap when the plugin stops registering tools).
- **In Scope for This Sub-Task:** `src/plugin.ts` cleanup (remove `registerPlanTools`, tool imports, unused `fs`/`path` if orphaned, header comment updates); `src/__tests__/registration.test.ts` — stub `tool.transform` throws (like the command domain), assertions become: 7 agents, 17 skills, zero tool-domain captures (the `CapturedUpdate.domain` type drops `tool`); remove the `HARNESS_TOOLS` expectation; `test/bundle.test.ts` unchanged but must stay green; `test/plugin-entry.test.ts` unchanged.
- **Out of Scope for This Sub-Task:** docs/text refs (Phase 4); the MCP-side code (done).
- **Instructions:** the registration test remains the in-repo gate proving the hard cut; make the stub throw on any tool access so a regression fails loudly; keep `logSummary` accurate (agents/skills only message).
- **Acceptance Criteria:** `pnpm test` green with the updated assertions; grep proves `ctx.tool` / `registerPlanTools` no longer exist in `src/`; the built bundle still loads in isolation (bundle test).
- **Cautionary Points (Risks & Edge Cases):** the plugin still must not touch the command domain (existing stub); keep the plugin's manual-edit fallback admissible — no other behavior changes; `skills` count stays 17, agents 7 (counts live in tests and docs — docs handled in 4.2).
- **Implementation Suggestions:** search for lingering imports with `rg 'plan-lifecycle|sheet-tools|logged-command' src/plugin.ts` expecting none.
- **Testing Suggestions:** `pnpm build && pnpm test`; `pnpm qa:check`.
- **Done When:** plugin registers zero tools; all tests green; hard cut is provable by the registration gate.

### Phase 4: Harness content, docs & project wiring

- **Status:** Completed

#### Sub-Task 4.1: Skills + agents naming flip (canonical mapping table)

- **Status:** Completed
- **Objective:** Flip every tool reference inside `skills/*` and `agents/*` to the MCP naming, using a single frozen mapping table, with zero stale references remaining (outside historical `docs/plans/**`).
- **Related Requirements:** R8, AC6
- **Dependencies and Preconditions:** none strictly (text layer), but logically after the MCP naming is final (it is — Phase 1).
- **In Scope for This Sub-Task:** mapping table (apply exactly, keep surrounding prose): `dh.plan_read` → `dh_plan_read`; `dh.plan_update_status` → `dh_plan_update_status`; `dh.plan_create` → `dh_plan_create`; `dh.logged_command` → `dh_logged_command`; `dh.read_sheet` → `dh_read_sheet`; `dh.update_sheet` → `dh_update_sheet`; `dh.sheet_schema` → `dh_sheet_schema`. Files: `skills/dh-execute-plan/SKILL.md`, `skills/dh-execute-plan-task/SKILL.md`, `skills/dh-review/SKILL.md`, `skills/dh-final-review/SKILL.md`, `skills/dh-planning/SKILL.md`, `skills/dh-create-documentation/SKILL.md`, `skills/dh-setup/SKILL.md` (tool-table line only here — wiring step is 4.3), `skills/index.md` (header + lifecycle paragraph), `agents/dh-executor.md`, `agents/dh-documentor.md`. Add one clarifying sentence where the tools are first introduced per file: exposed by the project-scope `dh` MCP server; in Code Mode they are called as `tools.dh.<tool>` — the `dh_<tool>` spelling is the tool's normalized name (permissions match `dh_*`).
- **Out of Scope for This Sub-Task:** repo-root docs (4.2), `dh-setup` wiring mechanics (4.3), demo project (4.4).
- **Instructions:** mechanical replacement honoring the audit convention of renaming only identifiers — keep "fallback: manual edits" language intact everywhere; preserve the "when available" conditionals; do not reflow paragraphs beyond the changed tokens + the one added sentence per file (keep diffs reviewable).
- **Acceptance Criteria:** `rg -n 'dh\.(plan_read|plan_update_status|plan_create|logged_command|read_sheet|update_sheet|sheet_schema)' skills agents` returns zero matches; the new names appear in all previously referencing files; `node scripts/audit.mjs` still passes (name regexes, sizes, cross-references unaffected).
- **Cautionary Points (Risks & Edge Cases):** historical plans under `docs/plans/**` legitimately contain the old dot form — exclude them from the zero-match check; do not accidentally rename agent/skill names themselves; keep file sizes under audit limits (250 skill / 300 agent lines).
- **Implementation Suggestions:** run the replacements with a script or careful sed per file, then a token-normalized diff review (same approach as the prior audit-fix rename) to prove rename-only.
- **Testing Suggestions:** `node scripts/audit.mjs`; the grep-based AC6 check; `pnpm lint:links` (docs links intact).
- **Done When:** zero stale tool refs in skills/agents; audit green; diff review shows renames (+1 explanatory sentence per tool-introducing file).

#### Sub-Task 4.2: Repo docs & examples (README, AGENTS.md, LOADING.md, skills/index.md, opencode.example.jsonc)

- **Status:** Completed
- **Objective:** Rewrite the tool-related documentation for the MCP architecture, following `dh-create-documentation` conventions (vault = project root, docs under `docs/`): README feature bullets, AGENTS.md harness contract + QA table, LOADING.md MCP server reference (config, naming, verification, troubleshooting), example config.
- **Related Requirements:** R3, R5, R7, R8, AC4, AC6
- **Dependencies and Preconditions:** 2.2 (exact command/bin strings), 4.1 (canonical naming).
- **In Scope for This Sub-Task:** `README.md` — replace "plugin tools" bullets/sections with the MCP server (what it is, all-7-tool table with inputs/outputs, project-scope config snippet, npx command); `AGENTS.md` — plan-lifecycle-tools paragraph (MCP + naming + fallback), QA table row for `smoke-mcp.mjs`, loading/ownership notes untouched elsewhere; `docs/LOADING.md` — replace the "Plan lifecycle tools" section with "MCP server (`dh`)" covering: config snippet (exact command array, `protocol: "2026-07-28"`, optional `timeout.startup` guidance, `DH_WORKSPACE_ROOT` override), naming (`dh_plan_read` / `tools.dh.plan_read` / permissions `dh_*`), tool table (7 tools), verification (`opencode mcp list`, restart note), troubleshooting (cache staleness → cache-bust command; cold start; node-dist fallback command); `opencode.example.jsonc` — add the `mcp.servers.dh` block as an example (commented or active, matching existing style); `skills/index.md` if not fully covered in 4.1.
- **Out of Scope for This Sub-Task:** `skills/*` bodies (4.1), dh-setup mechanics (4.3), demo (4.4).
- **Instructions:** this is the plan's documentation sub-task — apply `dh-create-documentation` output conventions (frontmatter where the repo uses it; docs stay under `docs/`); correctness over prose: every command in the docs must be executed verbatim during 5.1 and match its documented output shape; note the dot→underscore naming rationale once (old plugin namespace vs MCP host naming).
- **Acceptance Criteria:** every command in the new docs sections was run and matches (5.1 records it); zero stale tool refs in these files (AC6 grep); LOADING.md contains the exact npx command array from `package.json` bin; README lists all 7 tools.
- **Cautionary Points (Risks & Edge Cases):** keep the verified-pinning language (opencode version notes) accurate; do not document features not shipped (resources/outputSchema); keep the global-plugin-clone loading instructions intact — this change is additive (project MCP config), not a replacement of plugin loading.
- **Implementation Suggestions:** candidate for delegation of the LOADING.md MCP reference polishing to `@dh-documentor` per harness ownership rules; keep one canonical config snippet and reference it elsewhere instead of duplicating.
- **Testing Suggestions:** `pnpm lint:links`; manual reading pass for command-block accuracy.
- **Done When:** docs describe the shipped reality; AC6 grep clean across repo-root docs; example config parses as JSONC.

#### Sub-Task 4.3: dh-setup project wiring step (consent-based mcp.servers.dh + prewarm + verify)

- **Status:** Completed
- **Objective:** Extend `dh-setup` with a consent-based project step that merges the `mcp.servers.dh` entry into the target project's `opencode.jsonc`, prewarms the npx cache, and verifies the connection.
- **Related Requirements:** R5, R7, AC4
- **Dependencies and Preconditions:** 2.2 (npx-ready package), 4.2 (exact snippet).
- **In Scope for This Sub-Task:** `skills/dh-setup/SKILL.md` — new subsection (project layer, next to the QA/hook steps): (1) detect/read the project `opencode.jsonc` (`mcp.servers.dh` idempotent merge; create the `mcp.servers` keys when absent; never overwrite other servers; user consent first, consistent with the hook policy); (2) prewarm: `npx -y --package=github:andrescevp/development-harness dev-harness-mcp < /dev/null` (warms the npx cache and validates reachability; expect a fast exit via stdin EOF); (3) verify: `opencode mcp list` shows `dh` connected (restart note for running sessions); (4) document the `timeout.startup` bump when cold starts are slow and the node-dist fallback; update the skill's verification checklist + tools table mentions.
- **Out of Scope for This Sub-Task:** implementing anything in opencode itself; global-scope MCP entries (`--global` out of scope per SDD).
- **Instructions:** keep the entry byte-identical to the `opencode.example.jsonc` snippet from 4.2 (single source: the docs); the prewarm uses the exact shipped command (+ `< /dev/null`); state clearly that this step is skipped when the project already carries the entry (report as "already wired"). CAP WATCH: this file sits at 239/250 lines — compress or extract first if the new subsection pushes past the limit (e.g. move the tools table details to LOADING.md and keep a pointer).
- **Acceptance Criteria:** the SKILL.md step, executed manually in demo-project (4.4/5.1), wires the entry, prewarms, and shows `dh` connected; file passes the harness audit (line limits); no silent config changes (consent text present).
- **Cautionary Points (Risks & Edge Cases):** JSONC editing preserves comments/format where feasible (append under `mcp.servers`); do not clobber an existing `dh` entry with different settings without showing a diff; cold-start timing varies by network — prewarm is best-effort with a clear timeout.
- **Implementation Suggestions:** model the step phrasing on the existing hook-consent pattern in the same skill; keep the snippet short and link to LOADING.md for details.
- **Testing Suggestions:** manual dry-run against a scratch project dir; `node scripts/audit.mjs`.
- **Done When:** dh-setup can wire + prewarm + verify a project with consent, idempotently.

#### Sub-Task 4.4: demo-project config + demo.sh validation

- **Status:** Completed
- **Objective:** Make `demo-project` the living proof of project-scope MCP wiring: add the `mcp.servers.dh` entry to its `opencode.jsonc` and extend `demo.sh validate` with an MCP connectivity check.
- **Related Requirements:** R3, AC4
- **Dependencies and Preconditions:** 4.2 (snippet), 2.2 (build).
- **In Scope for This Sub-Task:** `demo-project/opencode.jsonc` — add `mcp.servers.dh` using the LOCAL node-dist fallback command (`["node", "../dist/mcp/stdio.js"]`, resolved from the demo workspace to the repo build) so the in-repo demo verifies THIS branch pre-release/offline; add a comment that production projects use the npx-from-git form (README/LOADING canonical) + `protocol: "2026-07-28"` (+ commented `timeout.startup` guidance); `demo-project/demo.sh` — new validation step (e.g. "4/5 MCP server"): fresh data dir `opencode mcp list` greps `dh` + `connected`, with a tolerant first-run timeout and a prewarm hint on failure; renumber steps; keep the existing agent/config gates.
- **Out of Scope for This Sub-Task:** committing a demo fixture plan (5.1 decides); demo.sh launch mode changes.
- **Instructions:** the demo config is the second canonical copy of the snippet — keep it identical to 4.2/4.3 (a test in 5.1 could diff the three copies; at minimum a manual check); validate on a fresh `XDG_DATA_HOME` (existing `fresh()` helper) so no stale server state masks config errors.
- **Acceptance Criteria:** `./demo.sh validate` prints the new step green (first run may take the cold-start path; prewarm documented); `opencode debug config` reflects the mcp entry; the demo config parses.
- **Cautionary Points (Risks & Edge Cases):** `mcp list` in a fresh data dir triggers a real npx spawn — allow the long timeout in the script and surface stderr on failure; do not break the existing validate steps' exit-code contract.
- **Implementation Suggestions:** use `timeout 120` around the list call with a clear failure message; grep both `dh` and `connected` tokens.
- **Testing Suggestions:** run `./demo.sh validate` twice (cold + warm) and record durations for 5.1.
- **Done When:** demo validation proves the project-scope MCP connection end-to-end.

### Phase 5: Verification & release

- **Status:** Pending

#### Sub-Task 5.1: Real-session verification (mcp list, live tool call, cold npx timing)

- **Status:** Pending
- **Objective:** Prove the full path end-to-end on this host: built dist + demo-project config + real opencode connection + a live tool call through the MCP server + cold-start npx timing; record everything in `docs/plans/plugin-tools-to-mcp/tasks/verification.md`.
- **Related Requirements:** AC4, AC5, AC6
- **Dependencies and Preconditions:** Phases 1–4 complete; network access for the first npx git install.
- **In Scope for This Sub-Task:** (1) `pnpm build`; (2) `cd demo-project && ./demo.sh validate` (fresh data dir) — record the MCP step; (3) live session check: run opencode non-interactively with a prompt to call `dh_plan_create` (or `dh_plan_read`) on a scratch plan inside demo-project and confirm the returned payload (record the transcript excerpt); (4) cold-start timing: `npm cache npx rm --force` (then `npm cache clean --force` if needed) → time `npx -y --package=github:andrescevp/development-harness dev-harness-mcp < /dev/null` → record duration and set the documented `timeout.startup` guidance accordingly; (5) AC6 grep: `rg -n 'dh\.(plan_read|plan_update_status|plan_create|logged_command|read_sheet|update_sheet|sheet_schema)' --glob '!docs/plans/**' --glob '!docs/evolve/**' --glob '!node_modules'` → expect zero (docs/evolve holds historical observations with the old names); (6) verify the FOUR npx snippet copies (README.md, docs/LOADING.md, opencode.example.jsonc, skills/dh-setup/SKILL.md) are identical (compare canonical fields `type`/`command`/`protocol`; inline forms field-wise), and that the demo config matches the documented local fallback (`node ../dist/mcp/stdio.js` from the demo workspace resolves to the built artifact).
- **Out of Scope for This Sub-Task:** CI automation; publishing.
- **Instructions:** verification must exercise the real binary via opencode, not only the in-memory client (smoke already covers the binary mechanically); if the cold npx run exceeds a usable startup window, record it and mark the node-dist fallback as the recommended primary in LOADING.md/dh-setup (edit in this sub-task with justification); capture exact commands + outputs in the verification file (no paraphrasing).
- **Acceptance Criteria:** verification.md contains: build transcript, demo validate output, live call payload, cold/warm npx timings, grep result (0), snippet diff (identical); every claim backed by a recorded command.
- **Cautionary Points (Risks & Edge Cases):** a long-lived opencode server may cache the old (pre-MCP) session state — use the fresh `XDG_DATA_HOME` pattern; the first npx install may pull duckdb native bits — record failures verbatim if they occur (they are findings, not blockers to plan tools).
- **Implementation Suggestions:** reuse `demo.sh`'s `fresh()` pattern for the live check; store transcripts under `docs/plans/plugin-tools-to-mcp/tasks/` (verification.md) as the plan's evidence artifact.
- **Testing Suggestions:** repeat the warm run once to confirm cached-path latency; sanity-check `ps` shows no orphaned server processes after sessions close.
- **Done When:** all six verification items recorded with commands + outputs; AC4/AC5/AC6 evidenced.

#### Sub-Task 5.2: Full gate + release (qa:check:full, audit, semver, index closure)

- **Status:** Pending
- **Objective:** Run the complete release gate, apply the versioning path (dh-semver), and close the plan (statuses + index row).
- **Related Requirements:** AC7, AC8
- **Dependencies and Preconditions:** 5.1 complete; all prior phases green.
- **In Scope for This Sub-Task:** `pnpm qa:check:full` (must include `smoke-mcp.mjs`) and `node scripts/audit.mjs` — both exit 0; dh-semver: analyze commits since `v0.4.0`, recommend the bump (expected: breaking-but-pre-1.0 → minor, `0.5.0`), generate the changelog entry, create the local tag per its workflow (no push until confirmed); update `docs/plans/index.md` (refine the scaffold row's description/dates/status/active=No — note: with the local plugin still loaded, `dh.plan_update_status` may be called only if available in the running session; otherwise manual edit per marker rules); flip all phase + sub-task statuses to `Completed` via the tool or manual edits; record the release summary in the plan.
- **Out of Scope for This Sub-Task:** pushing tags/merging branches (user decision); publishing.
- **Instructions:** Git Flow per repo AGENTS.md — this work lives on a feature branch; the release mechanics (merge → release branch → tag on main) are the user's call — dh-semver only prepares the local tag + changelog. The index row must keep the table format.
- **Acceptance Criteria:** `qa:check:full` exit 0; audit PASS; dh-semver output recorded (current version, bump type, next version, changelog); tag created locally; plan statuses all `Completed`; index row finalized; plan parses via a final `dh.plan_read` (if available) or manual re-read.
- **Cautionary Points (Risks & Edge Cases):** qa:check:full runs docker scans (osv/semgrep) — docker must be up; the audit's secret/junk scans run over the changed corpus — ensure no temp logs leaked into the repo; semver must see conventional commits — do not hand-edit the changelog derived from them.
- **Implementation Suggestions:** run the gate once before touching statuses so failures are clean to fix; keep the tag message = changelog header.
- **Testing Suggestions:** after the tag, `git describe --tags` sanity check; re-run `pnpm test` once post-closure.
- **Done When:** gate + audit green, tag exists locally, plan + index closed; the plan is releasable per Git Flow (user decides merge/push).

## Final Integration & Verification

- **System-Wide Test:** on the final branch state — `pnpm build` → `pnpm qa:check:full` (includes unit + registration + bundle + stdio smoke + lint/depcruise/knip/dup + scans) → `./demo-project/demo.sh validate` (fresh data dir; MCP step green) → live opencode session calls `dh_plan_create` + `dh_plan_read` through the MCP server and prints the returned plan → cold npx timing recorded and thresholds documented.
- **Completion Checklist:**
  - [ ] Plugin registers 7 agents, 17 skills, 0 tools (registration gate)
  - [ ] MCP server exposes exactly 7 tools with parity payloads + `isError` messages (AC2 tests)
  - [ ] `scripts/smoke-mcp.mjs` green in `qa:check:full` (AC3)
  - [ ] `opencode mcp list` shows `dh` connected; live call recorded (AC4)
  - [ ] Cold-start npx measured; `timeout.startup` guidance documented (AC5)
  - [ ] Zero stale tool refs outside `docs/plans/**` (AC6)
  - [ ] `pnpm qa:check:full` exit 0; audit PASS (AC7)
  - [ ] `docs/plans/index.md` row final; all statuses `Completed` (AC8)
  - [ ] Snippet copies identical (LOADING.md / opencode.example.jsonc / demo config)
  - [ ] No orphan processes after smoke/live runs

## Open Questions

- Exact default `timeout.startup` value to document (likely 300000 ms) — finalize from the measured cold-start in 5.1.
- Whether released docs should pin the npx spec to `#vX.Y.Z` — defer to the dh-semver step's release notes (5.2).
- Whether to commit a fixture plan under `demo-project/docs/plans/` as demo content — decide in 5.1 based on the live-check setup used.

