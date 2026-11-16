---
title: TOON Output Integration — Critical Changes
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: TypeScript + MCP + @opencode/plugin
feature: TOON Output Integration
epic: Output token efficiency
diagram_type: flowchart
---

# TOON Output Integration — Critical Changes

## Overview

The risky changes are the automatic MCP format switch, the two host hooks, the
process-local cache boundary, and shell-safe restoration. Everything else is a
shared codec plus tests and docs.

```mermaid
flowchart LR
    subgraph Before
        jsonOnly[MCP always JSON]:::changed
        rawBash[Native bash always raw]:::changed
        noHooks[No tool hooks]:::removed
        noRestore[Forwarded text unchanged]:::changed
    end

    subgraph After
        conditional[MCP JSON or TOON<br/>conditional]:::new
        afterHook[execute.after<br/>eligible tools]:::new
        beforeHook[execute.before<br/>quoted/heredoc restore]:::new
        lru[(LRU 100<br/>process-local)]:::new
        codec[Shared safe codec]:::new
        bundled[TOON bundled<br/>self-contained artifacts]:::new
    end

    jsonOnly --> conditional
    rawBash --> afterHook
    noHooks --> afterHook
    noHooks --> beforeHook
    noRestore --> beforeHook
    afterHook --> lru
    beforeHook --> lru
    conditional --> codec
    afterHook --> codec
    beforeHook --> codec
    codec --> bundled

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
    classDef changed fill:#fff3cd,stroke:#f57f17,color:#000
    classDef removed fill:#f8d7da,stroke:#c62828,color:#000
```

**Legend:** green = new, amber = changed, red = removed.

## Notes

- Automatic MCP TOON is a text-format change, not a payload change.
- The plugin contract changes from “zero tool-domain access” to “two execute
  hooks, zero tool/command/prompt transforms.”
- Exact-match restoration is process-local; MCP TOON uses valid-TOON fallback.
- Shell restoration is limited to quoted strings and heredocs; unquoted text
  is never rewritten.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
