---
title: Domain & Architecture Check — TOON Output Integration (Implementation)
slug: toon-output-integration-domain-check-final
description: Post-implementation boundary and SOLID validation for the TOON integration.
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
| Shared serialization | `src/lib/toon.ts` | Low |
| Native tool hooks + cache | `src/tools/toon-hooks.ts` | Medium |
| MCP output contract | `src/mcp/tool-results.ts`, `server.ts`, `stdio.ts` | High |
| Plugin lifecycle | `src/plugin.ts` | Medium |
| Build/package | `tsdown.config.ts`, `package.json`, smokes | Medium |
| Verification/docs | `src/__tests__`, README/AGENTS/LOADING | Low |

Standalone harness repository; these are module boundaries, not domain
aggregates.

## Cross-Context Concerns

- **MCP ↔ plugin process boundary:** the MCP server and native plugin hooks are
  separate processes. Exact-match restoration is limited to native bash output
  compressed in the plugin process; MCP TOON forwarded into bash uses the
  valid-TOON decode fallback. Documented in the plan, README, LOADING, and SDD.
- **Host hook contract:** V2 `Tool.Result` content can be a string or block
  array. The compression helper replaces only the eligible text payload and
  leaves file blocks/metadata untouched; malformed shapes are inert.
- **Build boundary:** TOON is bundled into `dist/plugin.js` and
  `dist/mcp/stdio.js`; `smoke-load`/`smoke-pack` prove no bare runtime import.
- **Format boundary:** MCP successful payloads are JSON or TOON; errors remain
  plain text. Test helpers parse both without weakening payload assertions.

## SOLID Compliance

| Principle | Change | Status | Note |
|---|---|---|---|
| SRP | Codec vs hooks vs MCP serialization vs plugin lifecycle | ✅ | Each module has one reason to change. |
| OCP | `textResult` single MCP conversion point; additive hooks | ✅ | All 12 tools benefit without handler changes; host behavior is additive. |
| LSP | No inheritance/type hierarchy | ✅ | Structural result types only. |
| ISP | Minimal codec/hook exports | ✅ | MCP imports encode/decode; plugin imports hooks; no fat shared interface. |
| DIP | MCP/plugin depend on the codec contract, not TOON internals | ✅ | `@toon-format/toon` stays behind `src/lib/toon.ts`; host API stays behind hook registration. |

## Verdict

Clear to proceed.

## Blocking Issues

None. The process-boundary limitation is explicit and tested via the valid-TOON
fallback; the automatic MCP format change is covered by the updated test
contract and docs.
