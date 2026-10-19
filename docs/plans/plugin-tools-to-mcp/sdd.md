---
title: Plugin Tools to MCP Server
slug: plugin-tools-to-mcp
description: Refactor dev-harness-skills so the 7 harness tools are served by a project-scope local MCP server (MCP TS SDK v2) instead of opencode plugin tool registration, started by opencode via npx from the git repo
tags: [sdd, design, mcp, refactor]
project: dev-harness-skills
stack: TypeScript / Node >=20.11 / @modelcontextprotocol/server v2 / zod v4 / tsup / vitest / opencode V2
created: 2026-10-19
updated: 2026-10-19
status: proposed
---

# Software Design Document: Plugin Tools to MCP Server

## Problem Statement

The dev-harness-skills plugin currently registers 7 custom tools through the
opencode V2 plugin tool API (`ctx.tool.transform`, namespace `dh`, codemode).
That API is opencode-specific, evolves with the host, and keeps tool code —
including heavy dependencies (DuckDB) and command execution — inside the
opencode plugin process. The requirements have moved to a portable, host-
standard distribution: the tools must be served by a **local MCP server**
(Model Context Protocol, TypeScript SDK v2) that opencode starts **per project
over stdio**, so tool availability is project-scoped, the plugin surface
shrinks to agents + skills, and tooling follows the MCP standard instead of a
bespoke plugin API. The user directive is explicit: **remove opencode tool
registration** and **create a local MCP instance** with the referenced SDK,
running "locally at project scope level".

## Goals / Non-Goals

- **Goals:**
  - Zero tool registration left in the plugin; agents + skills only.
  - All 7 current tools served by a local stdio MCP server with identical
    observable behavior (inputs, payloads, errors).
  - Project-scope enablement: each project opts in via its own opencode
    config; no global MCP entry.
  - Distribution that works without installing a second local clone: opencode
    starts the server via npx from the git repository.
  - Modern protocol (2026-07-28) with graceful legacy-host behavior.
  - Atomic, same-release documentation/skill/config naming flip.
- **Non-Goals:**
  - No new tool capabilities, no MCP resources/prompts exposure (deferred).
  - No changes to the plan format contract or tool payload shapes.
  - No npm publishing; no second repository; no global-scope MCP install.
  - No changes to agents/skills registration mechanics.

## Requirements

- **R1:** The plugin (`src/plugin.ts`) must register **zero tools** in the same
  release that ships the MCP server (hard cut, no dual registration, no
  aliases).
- **R2:** A local MCP server must expose exactly these 7 capabilities with
  parity contracts: `plan_read`, `plan_update_status`, `plan_create`,
  `read_sheet`, `update_sheet`, `sheet_schema`, `logged_command`.
  - Inputs: identical parameter names, types, and required-ness as today.
  - Outputs: identical JSON payloads (`{ ok, path, plan }` for plan tools;
    sheet result for sheet tools; `{ ok, exitCode, logPath, head, tail,
    truncated }` for `logged_command`).
  - Errors: readable MCP `isError` results carrying the same message strings
    (missing plan, invalid status, phase-completion gate, path escapes,
    symlink rejection).
- **R3:** The MCP server must run locally over stdio and be startable by
  opencode per project from that project's opencode configuration
  (`mcp.servers.*`, type `local`). Tool availability is project-scoped:
  projects without the entry simply don't have the tools (existing
  "fallback: manual edits" skill language covers absence).
- **R4:** The server must resolve the workspace root at runtime: `cwd` by
  default (opencode starts local servers with the workspace as cwd) with an
  explicit `DH_WORKSPACE_ROOT` environment override. Plan tools stay anchored
  under `<root>/docs/plans` with the existing rejections preserved: `..`
  escapes, absolute paths outside the anchor, slugs with separators, symlink
  traversal.
- **R5:** opencode must be able to start the server without a second manual
  clone: distribution via `npx` from the git repository
  (`github:andrescevp/development-harness`), using the package's `bin`
  (`dev-harness-mcp`) with a `prepare` build for git-install contexts.
  A `node <dist>/mcp/stdio.js` form must remain documented as fallback.
- **R6:** The server must speak the 2026-07-28 protocol revision (SDK v2) and
  the shipped config must pin `protocol: "2026-07-28"`; the server must still
  serve 2025-era (`initialize`) clients from the same factory so older hosts
  degrade gracefully.
- **R7:** `dh-setup` must offer to wire the project config on user consent
  (never silently): write/merge the `mcp.servers.dh` entry into the project
  `opencode.jsonc`, prewarm the npx cache, and verify the connection.
- **R8:** All in-repo references must flip atomically to the new tool naming
  in the same change: docs (`README.md`, `AGENTS.md`, `docs/LOADING.md`,
  `skills/index.md`), skills, agents, demo project config, example config.
  Canonical naming: MCP server `dh`; tools `dh_<tool>` (direct) /
  `tools.dh.<tool>` (Code Mode, default) — e.g. `dh_plan_read`,
  `tools.dh.plan_read`.
- **R9:** The server must return a short MCP `instructions` string so hosts
  surface harness context in the system prompt.
- **R10:** Write safety: `plan_update_status` and `plan_create` file writes
  must be atomic (temp file + rename on the same filesystem), and the
  read-modify-write sequence must remain free of `await` interleaving.
- **R11:** QA gates stay green (`pnpm qa:check:full`), with TDD: new tests
  must cover the MCP surface (tool listing, payload parity, error cases, root
  anchoring) through an in-memory MCP client, plus a stdio spawn smoke test of
  the built binary.
- **R12:** Stdio purity and lifecycle: the server must never write non-
  protocol output to stdout (logs go to stderr); it must exit when the
  transport closes (stdin EOF) and must not hold keep-alive handles.

## Scope

- **In scope:** MCP server module + bin + prepare; tsup second entry; plugin
  tool-registration removal; tests (new MCP + updated registration/bundle);
  QA wiring (knip/depcruise/smoke); docs/skills/agents/config updates;
  dh-setup wiring step; demo-project entry + validation; contingency and
  domain-check notes; release via dh-semver.
- **Out of scope:** MCP resources/prompts; `outputSchema`/`structuredContent`;
  npm publishing; separate repository / workspace split; global MCP config;
  changes to agent/skill registration; plan format changes; DuckDB version
  changes.

## Constraints

- Node >= 20.11 (repo engines); `@modelcontextprotocol/server` requires
  Node >= 20.
- SDK v2 line: `@modelcontextprotocol/server` (^2.3.x), Zod v4 for input
  schemas (`zod/v4`); `@modelcontextprotocol/client` as a dev dependency for
  tests/smoke.
- Host: opencode v2.0.18+ (verified on this host that the local MCP config
  supports the `protocol` field and `mcp add/list` flows).
- Private repo: npx git installs use the user's existing git credentials;
  no registry auth available.
- Keep the repo's QA stack untouched in spirit: biome, knip, jscpd,
  dependency-cruiser, OSV-Scanner, semgrep, vitest, tsc.
- Repo rules: TDD (test first), files ≤ 300 lines, strict SOLID/SRP for new
  modules.
- The plugin bundle constraint is unchanged (bare-import-free
  `dist/plugin.js` for the global loader); the MCP bundle has the opposite
  context (real node_modules present in the npx cache) and may use static
  bare imports for the SDK, keeping `duckdb` lazy.

## Risks and Edge Cases

- **First-run npx latency** (clone + npm install + prepare build + duckdb
  native install) can exceed opencode's 30 s MCP `startup` timeout.
  Mitigation: dh-setup prewarm step; documented `timeout.startup` bump;
  node-dist fallback documented.
- **npx cache staleness** after repo updates — upgrades may keep serving an
  old build. Mitigation: documented cache-bust command; optional pinned
  `#vX.Y.Z` spec; dh-setup re-verification.
- **prepare-on-git-install**: npm runs the `prepare` script in the git
  checkout; it must build `dist/mcp/stdio.js` (and must not be required for
  plugin source-mode consumers). Gate the build on missing dist to avoid
  slowing local `pnpm install`.
- **Stdout pollution**: any `console.log`/`process.stdout.write` leaks into
  the JSON-RPC channel and bricks the connection. Enforcement: code review
  rule + smoke test asserting a clean handshake.
- **cwd assumption**: if a host starts the server with a different cwd, plan
  tools anchor to the wrong root. Mitigation: `DH_WORKSPACE_ROOT` override +
  tests + setup verifies the entry.
- **Naming flip atomicity**: mixed old/new references fail subtly at runtime
  (tool-not-found). Mitigation: single replacement-table sub-task + repo-wide
  grep verification as an acceptance check.
- **duckdb inside the npx cache**: native module install in the npx context
  must succeed (pnpm workspace approvals differ from npm postinstall). If it
  fails, sheet tools degrade but plan tools must keep working (lazy load
  already isolates this).
- **Hard cut timing**: a session running an old plugin + new MCP or vice
  versa sees either duplicate old names or missing tools; acceptable per
  requirement, noted for release notes.

## Acceptance Criteria

- **AC1:** Registration test proves the plugin registers exactly 7 agents,
  17 skills, **0 tools**, and never touches the tool domain (stub throws).
- **AC2:** In-memory MCP client tests pass: `tools/list` returns exactly the
  7 names; payload parity for plan_read/plan_update_status/plan_create,
  read_sheet/update_sheet/sheet_schema, logged_command; error cases
  (missing plan, phase gate, escapes, symlinks) return `isError` with the
  expected messages.
- **AC3:** `scripts/smoke-mcp.mjs` spawns the built `dist/mcp/stdio.js` via
  `StdioClientTransport`, lists 7 tools, calls `plan_read` against a fixture
  workspace, exits 0; wired into `qa:check:full`.
- **AC4:** `opencode mcp list` (fresh data dir, demo-project) reports the
  `dh` server connected; a real session tool call returns the expected
  payload (manual verification recorded in the plan's tasks notes).
- **AC5:** A cold-start npx verification
  (`npx clear-npx-cache` → `npx -y --package=github:andrescevp/development-harness dev-harness-mcp`)
  completes a handshake under the configured startup timeout (manual,
  recorded; if it cannot, the node-dist fallback is documented as primary).
- **AC6:** Repo-wide grep shows zero stale tool references; all updated
  references use the canonical naming from R8 (verification command in the
  plan).
- **AC7:** `pnpm qa:check:full` exits 0 on the final branch state.
- **AC8:** `docs/plans/index.md` carries the plan row; plan lifecycle
  statuses completed via the (still available in-repo) tooling or manual
  edits.

## Open Questions

- Exact `timeout.startup` value to document (suggest 300000 for cold starts);
  resolve during execution with a measured cold-start duration.
- Whether dh-setup should prefer the node-dist fallback when the plugin is
  clonable locally (decision: offer both, npx default — confirm at execution).
- Whether to pin the npx spec to `#vX.Y.Z` in released docs (deferred to the
  dh-semver step release notes).
