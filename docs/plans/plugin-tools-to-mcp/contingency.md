# Contingency Analysis: Plugin tools → project-scope MCP server (dev-harness-skills)

## Context & Confirmed Decisions (fixed by requirements)

These were decided in the planning interview and are constraints every plan must satisfy —
they are NOT re-opened here:

- **Full parity**: all 7 tools move to the MCP server (`plan_read`, `plan_update_status`,
  `plan_create`, `read_sheet`, `update_sheet`, `sheet_schema`, `logged_command`).
- **Hard cut** — the plugin registers **zero** tools in the same release (no dual registration).
- **Startup**: local MCP server started by opencode via npx from the git repo:
  `["npx", "-y", "--package=github:andrescevp/development-harness", "dev-harness-mcp"]`.
- **Protocol**: `protocol: "2026-07-28"` in the shipped `mcp.servers.dh` config (SDK v2 speaks it
  natively and keeps serving 2025-era clients by default as a safety net).
- **Setup**: `dh-setup` proposes + writes the project `opencode.jsonc` entry on user consent.
- **Scope**: parity + a short MCP `instructions` string; resources/prompts deferred.

## Architectural Decision Areas

1. **Server code layout & packaging** — where the MCP server lives and how it builds/packs:
   single in-repo package with a second tsup entry, a pnpm-workspace subpackage, or a separate
   repository. This is the area with the most genuine divergence because it decides
   dependency isolation, `prepare`-on-git-install ergonomics, and release coupling.
2. **Distribution & startup mechanics** — settled on the npx git spec by the user; the open
   sub-questions are the `bin`/`prepare` details and first-run latency/cache-bust handling
   (all plans must address them; a `node dist/…` fallback remains a documented degradation).
3. **Workspace anchoring** — how the server resolves the project root for `docs/plans`:
   implicit `process.cwd()` (opencode default) + `DH_WORKSPACE_ROOT` env override, versus an
   explicit CLI flag baked into each project's command array.
4. **Schema & result contract** — Zod v4 input schemas (SDK-native) and byte-identical
   text-JSON result payloads versus richer `outputSchema`/`structuredContent`, versus a free
   redesign while migrating.
5. **Side-effect hardening** — `plan_update_status`/`plan_create` write plan files; keep the
   current truncate-then-write `writeFileSync` or move to atomic temp-file + rename.

## Plan A: In-repo single package, npx git spec, cwd-anchored — Recommended

### Approach

1. **Layout (Area 1):** new `src/mcp/` module inside the existing package — `stdio.ts` (bin
   entry: `serveStdio` factory + tool registration), `tools.ts` (thin MCP adapters reusing the
   existing pure helpers in `src/tools/*`), `workspace.ts` (root resolution). Build via a second
   tsup entry → `dist/mcp/stdio.js` with a `#!/usr/bin/env node` banner. Add
   `"bin": { "dev-harness-mcp": "./dist/mcp/stdio.js" }` and a `prepare` script (build when
   dist is absent — the git-install path always lacks dist, local installs with a fresh dist
   skip the rebuild). Dependencies: add `@modelcontextprotocol/server` (runtime, external),
   `zod` (runtime, external — SDK uses `zod/v4`); `@modelcontextprotocol/client` as devDependency
   (tests + smoke). Bundle local code + `yaml` (existing alias), keep `duckdb` external/lazy.
2. **Distribution (Area 2):** npx form as confirmed; `dh-setup` prewarms the cache
   (`npx -y --package=… dev-harness-mcp < /dev/null` → EOF closes the stdio transport and exits)
   and documents cache-busting on upgrade + optional `#vX.Y.Z` pin + `timeout.startup` bump for
   cold starts. Fallback documented: `["node", "<abs>/dist/mcp/stdio.js"]` when npx is unwanted.
3. **Anchoring (Area 3):** root = `DH_WORKSPACE_ROOT` env var if set, else `process.cwd()`
   (opencode's default local-server cwd is the workspace). The `cwd` config field stays at its
   default; no absolute paths inside the command array.
4. **Contracts (Area 4):** Zod v4 `inputSchema` per tool with the current descriptions; results
   keep the exact JSON payloads (`{ ok, path, plan }`, sheet result, logged-command window) as
   `content: [{ type: "text", text: JSON.stringify(payload) }]`; handler errors become MCP
   `isError` results carrying the same message strings. `outputSchema`/`structuredContent`
   deferred (compatible future addition). Server `instructions` carries the harness one-liner.
5. **Hardening (Area 5):** `plan_update_status`/`plan_create` write via temp file + rename
   (atomic on POSIX) keeping the read-modify-write fully synchronous (no interleaving).
6. **Plugin side:** delete the `ctx.tool.transform` block + tool imports from `src/plugin.ts`;
   registration/bundle/entry tests updated to assert zero tool registrations; docs, skills
   (tool refs + `dh-setup` wiring step), demo-project config, and `opencode.example.jsonc`
   updated; smoke script (`scripts/smoke-mcp.mjs`) exercises the real stdio process.

### Risk: Low
- npx git-install executes `prepare` → first cold start can exceed the 30 s MCP `startup`
  timeout (mitigated: prewarm in dh-setup, documented `timeout.startup`, node-dist fallback).
- npx cache staleness after repo updates (mitigated: documented cache-bust + optional tag pin).
- Tool-name surface changes (`dh.plan_read` → `dh_plan_read` / `tools.dh.plan_read`) across
  docs — mitigated by a single canonical spelling task with a replacement table.

### Complexity: M (≈2–3 days equivalent)
- src/mcp module + build/bin/prepare wiring (M); test suite: in-memory client tests + stdio
  spawn smoke (M); plugin unregistration + test updates (S); docs/skills/setup updates (M);
  demo + real-session verification (S).

### Trade-offs
- **Gain:** full MCP standard tooling; project-scoped availability; plugin surface shrinks to
  agents+skills; crash isolation (tools die without the host); single package keeps CI, QA
  gates, and `prepare`-on-git-install trivial; helpers stay unit-testable.
- **Sacrifice:** tool availability now depends on the project having the MCP entry (mitigated:
  dh-setup wiring + "fallback: manual edits" already in every skill); npx adds first-run
  latency and a cache lifecycle to document.

## Plan B: pnpm-workspace subpackage (`packages/mcp-server`) + root bin shim

### Approach

1. **Layout (Area 1):** split the MCP server into `packages/mcp-server` (own package.json,
   tsconfig, tsup config; duckdb + SDK only there). Root keeps the plugin; a root `bin` shim
   forwards into the subpackage build output; root `prepare` builds the workspace.
2. **Distribution (Area 2):** same npx git spec; but git installs run the *root* `prepare`,
   which must build the subpackage and place a runnable artifact at the shim path.
3. **Anchoring (Area 3):** same cwd + `DH_WORKSPACE_ROOT` resolution (shared helper duplicated
   or a tiny shared package).
4. **Contracts (Area 4):** same Zod + parity contract as Plan A.
5. **Hardening (Area 5):** same atomic write change, applied in the subpackage copy.

### Risk: Medium
- npm git-install of a pnpm workspace: `prepare`-time workspace linking, hoisting, and native
  `duckdb` resolution across packages create multiple failure modes to debug.
- Duplicated helpers or a third shared package; knip/depcruise/tsconfig/CI surface grows.

### Complexity: L (≈4–6 days)
- Workspace scaffolding, shim, per-package tooling config, duplicated QA wiring; migration of
  helpers or extraction of a shared package.

### Trade-offs
- **Gain:** hard dependency isolation (duckdb/SDK never in the plugin graph); independent
  package versioning possible.
- **Sacrifice:** significant tooling/CI complexity; git-install path is the riskiest part of the
  whole delivery and it becomes the most complex; no functional benefit for a single-consumer
  harness today.

## Plan C: Separate repository for the MCP server

### Approach

1. **Layout (Area 1):** new repo (e.g. `development-harness-mcp`) owning `src/`, build, bin,
   and tests; this repo's plugin keeps agents+skills and points its setup/docs at the other
   package's git spec.
2. **Distribution (Area 2):** npx spec becomes `github:andrescevp/development-harness-mcp`;
   cross-repo version compatibility must be declared (harness ↔ MCP schema/format version).
3. **Anchoring (Area 3):** same cwd + `DH_WORKSPACE_ROOT` resolution implemented in the new repo.
4. **Contracts (Area 4):** parity contract re-implemented there; helpers duplicated or imported
   from the plugin package (creates a dependency back-link; otherwise drift).
5. **Hardening (Area 5):** same atomic write change, in the new repo.

### Risk: Medium–High
- Two release streams must stay in lockstep (plan format contract, tool payloads); drift bugs
  are silent. Initial cold `npx` installs two repos. Private-repo proliferation (auth, CI, QA
  gates, docs) doubles; the QA stack (biome/knip/depcruise/osv/semgrep/vitest) must be rebuilt.

### Complexity: L+ (≈1 week+, dominated by repo/CI scaffolding, not code)

### Trade-offs
- **Gain:** fully independent release cadence and lifecycle; cleanest separation of concerns in
  theory; the MCP server could serve other MCP hosts without the plugin.
- **Sacrifice:** cohesion and single-repo simplicity lost for a personal-scale harness; version
  drift risk; duplicated helpers or an awkward back-dependency.

## Recommendation

**Proceed with Plan A** — it satisfies every confirmed constraint with the least machinery:
one package, one QA gate, one build, and the safest git-install path (`prepare` at the repo
root, no workspace hoisting). It keeps all tool logic as reusable pure helpers with the MCP
layer as a thin adapter, and the exact JSON contracts make documentation/skill updates
mechanical.

Adopt **Plan B** only if the plugin must stay free of the SDK/duckdb dependency graph forever
(e.g. a future browser/deno plugin target). Adopt **Plan C** only if the MCP server must ship
independently to third parties or outpace the plugin's release cadence.
