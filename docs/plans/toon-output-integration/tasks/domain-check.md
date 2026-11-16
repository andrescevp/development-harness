---
title: Domain & Architecture Check — TOON Output Integration
slug: toon-output-integration-domain-check
description: Bounded-context and SOLID validation for the TOON output plan.
tags: [domain-check, plan]
project: dev-harness-skills
stack: TypeScript + MCP + @opencode/plugin
created: 2026-11-16
updated: 2026-11-16
status: active
---

# Domain & Architecture Check: TOON Output Integration

## Bounded Contexts Touched

| Context | Module(s) | Risk |
|---|---|---|
| Shared serialization | `src/lib/toon.ts`, `src/lib/toon-hooks.ts` | Medium |
| MCP output contract | `src/mcp/tool-results.ts`, `src/mcp/server.ts`, `src/mcp/stdio.ts` | High |
| Native host integration | `src/plugin.ts`, `@opencode/plugin` tool hooks | High |
| Build/package | `tsdown.config.ts`, `package.json`, `pnpm-lock.yaml`, smokes | Medium |
| Verification/docs | `src/__tests__`, `docs/`, `AGENTS.md`, `README.md`, `CHANGELOG.md` | Low |

The repository is a standalone harness project, not a DDD application. The
contexts above are module boundaries, not domain aggregates.

## Cross-Context Concerns

- **MCP ↔ plugin process boundary:** the MCP server is a separate process from
  the native plugin hooks. The exact-match cache cannot be shared; MCP TOON
  forwarded into bash relies on the valid-TOON fallback. This is documented,
  not hidden.
- **Host hook contract:** the V2 `Tool.Result` shape (`content` string or block
  array, optional `output`) is a host contract. The compression helper must
  preserve file blocks/metadata and fall back to JSON on ambiguity.
- **Build boundary:** the managed plugin install has no `node_modules`; TOON
  must be bundled, and a bare import would break `smoke-load`. The MCP `npx`
  artifact also must be self-contained.
- **Format boundary:** MCP tool text becomes JSON or TOON. Tests and docs must
  parse either without weakening payload assertions. Payload semantics stay
  JSON.

## SOLID Compliance

| Principle | Sub-Task / Change | Status | Note |
|---|---|---|---|
| SRP | Codec vs hooks vs MCP result vs plugin registration | ✅ | The codec encodes/decodes; hooks handle host events; `textResult` only serializes; setup only registers. |
| OCP | `textResult` single conversion point; additive hooks | ✅ | All 12 MCP tools benefit without handler changes; native behavior is added through two hooks. |
| LSP | No new inheritance/type hierarchy | ✅ | TypeScript helpers and host hook types only. |
| ISP | Minimal exports from the codec/hooks | ✅ | MCP imports encode/decode; plugin imports hooks; no fat shared interface. |
| DIP | MCP/plugin depend on the codec contract, not TOON internals | ✅ | The official package stays behind `src/lib/toon.ts`; host APIs stay behind hook helpers. |

## Verdict

Proceed with caution.

## Blocking Issues (if any)

None. The two tracked cautions are the automatic MCP text-format change
(compatibility/tests) and the process-local exact-match boundary; both have
explicit tests and documentation requirements in the plan.
