---
title: TOON Output Integration — Current State
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: TypeScript + MCP + @opencode/plugin
feature: TOON Output Integration
epic: Output token efficiency
diagram_type: flowchart
---

# TOON Output Integration — Current State

## Overview

Every MCP tool serializes its payload with `JSON.stringify` through
`textResult`; the native bash tool returns its output as plain text. Neither
surface compresses JSON, and a later bash command that forwards output receives
the original text unchanged.

```mermaid
flowchart LR
    subgraph MCP["dh MCP server"]
        tool[12 tools]
        textResult[textResult]
        json[JSON text]
    end

    subgraph Plugin["OpenCode plugin"]
        assets[agents + skills]
    end

    subgraph Host["OpenCode host"]
        bash[Native bash tool]
        context[Model context]
    end

    tool --> textResult --> json --> context
    bash --> context
    bash -. forwarded text .-> bash
    assets -. no tool hooks .-> bash

    classDef plain fill:#eceff1,stroke:#546e7a,color:#000
    class json,bash,context plain
```

## Notes

- MCP payloads are JSON even when the data is highly tabular.
- Native bash output is raw text; no JSON detection or TOON conversion.
- The plugin registers agents/skills only; it has no `execute.after` or
  `execute.before` hooks.
- Forwarded bash output is never rewritten to JSON.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
