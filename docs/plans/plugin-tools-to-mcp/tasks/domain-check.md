# Domain & Architecture Check: Plugin tools → project-scope MCP server

Scope: the refactor described in `contingency.md` (Plan A): remove the opencode tool
registration from `src/plugin.ts`, add an in-repo MCP stdio server (`src/mcp/`), expose the
same 7 tools (full parity), wire it per-project via `mcp.servers.dh`.

## Bounded Contexts Touched

| Context | Module(s) | Risk |
|---|---|---|
| Harness assets (agents/skills parsing + registration) | `src/lib/assets.ts`, `src/lib/records.ts`, `src/lib/frontmatter.ts`, `src/plugin.ts` | Low — plugin keeps only the agent/skill transforms; a deletion, not a rewrite |
| Plan lifecycle (core tool logic) | `src/tools/plan-lifecycle.ts`, `src/tools/plan-template.ts` | Low — consumed unchanged by the new adapter; only a behavior-preserving atomic-write hardening lands here |
| Tabular data (DuckDB) | `src/tools/sheet-tools.ts` | Low — lazy `duckdb` require preserved; adapter swaps only the caller |
| Command execution | `src/tools/logged-command.ts` | Low — pure execution strategy reused as-is |
| Host integration — plugin grader (being removed) | `src/plugin.ts` tool block | Med — deleting the `ctx.tool.transform` registration is a contract removal; all consumer docs/skills must flip in the same release (hard cut) |
| Host integration — MCP adapter (new) | `src/mcp/stdio.ts`, `src/mcp/tools.ts`, `src/mcp/workspace.ts` | Med — new anti-corruption layer between MCP protocol shapes and the pure helpers |

The repo is a single deployment unit (one package, one bounded context) with internal
module layers; there is no multi-context DDD structure to respect. The relevant architecture
move is: **core tool helpers stay; the host adapter swaps** (plugin tool API → MCP stdio).

## Cross-Context Concerns

- **Input-contract change (workspace root).** The plugin resolved the workspace via the host
  context (`ctx.location.directory`); the MCP server must resolve it via `process.cwd()`
  (opencode's default local-server cwd is the workspace) plus a `DH_WORKSPACE_ROOT` env
  override. This is a genuine boundary change — isolate it in `src/mcp/workspace.ts` (the ACL)
  so every tool receives an already-resolved root, never reading env/cwd itself.
- **External naming contract change.** Tools `dh.plan_read…` (plugin namespace) become
  `dh_plan_read…` (opencode normalization of server `dh` + tool) / `tools.dh.plan_read` under
  Code Mode. Every in-repo reference (docs, skills, agents, demo config) must flip in the same
  change; permissions in consumer projects match `dh_*`.
- **Lifecycle change.** Plugin tools lived and died with the opencode process; the MCP server
  is its own child process (stdin EOF teardown, `serveStdio` handle). Keep-alive hazards must
  stay out: `duckdb` remains per-operation + closed (already true in `sheet-tools.ts`), no
  module-level timers/watchers.
- **Concurrency invariant (preserve).** `plan_update_status`/`plan_create` are read-modify-write
  on plan files; the current helpers are fully synchronous between read and write, so
  interleaving is impossible in one process. The MCP handlers must not introduce an `await`
  between read and write, and writes become atomic (temp + rename).
- **No cross-context reads/writes** beyond these: sheets/logged-command operate on
  caller-provided paths as before.

## SOLID Compliance

| Principle | Sub-Task / Change | Status | Note |
|---|---|---|---|
| SRP | Split adapter into `stdio.ts` (lifecycle/entry), `tools.ts` (registration), `workspace.ts` (root resolution) | ✅ | Each module has one reason to change; `plugin.ts` loses its tool concern entirely (agents+skills only) |
| SRP | Remove tool block from `src/plugin.ts` | ✅ | Restores single responsibility; plugin becomes a pure asset-registration adapter |
| OCP | Consumption of `src/tools/*` helpers by the new adapter | ✅ | Core helpers extended via a new adapter, not modified; only the small atomic-write hardening touches `plan-lifecycle.ts` and is covered by new tests |
| LSP | Tool input/output payload contracts | ✅ | No type hierarchy involved; payloads stay byte-identical (`{ ok, path, plan }`, sheet result, logged window) so docs/skills/tests remain valid |
| ISP | MCP adapter surface | ✅ | Exposes exactly the 7 tool handlers; no fat context object; helpers keep narrow function signatures |
| DIP | `src/mcp/*` depending on helpers, not host concretions | ✅ | Adapter depends on pure functions + injectable workspace root; `@modelcontextprotocol/server` is confined to the entry module (infrastructure), mirroring how `@opencode/plugin` is confined to `plugin.ts` |

## Verdict

**Clear to proceed** — with two recorded cautions:

1. The naming contract flip must be atomic across docs/skills/agents/demo-config in the same
   release (hard cut; no aliases).
2. The workspace-root resolution change must be isolated behind `src/mcp/workspace.ts` and
   covered by tests for: env override, cwd default, `..` escape rejection, symlink rejection.

## Blocking Issues

None.

## Post-implementation Note

Adapters live in `src/mcp/server.ts` — no separate `tools.ts` was needed; the
registration stayed under the 300-line cap.
