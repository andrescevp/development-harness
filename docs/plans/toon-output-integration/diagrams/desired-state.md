---
title: TOON Output Integration — Desired State
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: TypeScript + MCP + @opencode/plugin
feature: TOON Output Integration
epic: Output token efficiency
diagram_type: flowchart
---

# TOON Output Integration — Desired State

## Overview

MCP results and eligible native tool output become TOON when the JSON is at
least 256 characters and TOON is shorter. The plugin remembers the original
JSON for native bash output and restores it when that TOON is forwarded into a
quoted string or heredoc.

```mermaid
flowchart LR
    subgraph MCP["dh MCP server"]
        tool[12 tools]
        mcpText[textResult]:::changed
        codec[TOON codec<br/>256+ / valid JSON / shorter]:::new
        toonOut[TOON text]:::new
        jsonOut[JSON text]
    end

    subgraph Plugin["OpenCode plugin"]
        after[execute.after<br/>compress eligible tools]:::new
        before[execute.before<br/>restore forwarded TOON]:::new
        cache[(Exact-match cache<br/>LRU 100)]:::new
        toonCodec[TOON codec + parser]:::new
    end

    subgraph Host["OpenCode host"]
        bash[Native bash tool]
        context[Model context]
        forwarded[Later bash command]
    end

    tool --> mcpText
    mcpText --> codec
    codec --> toonOut
    codec --> jsonOut
    toonOut --> context
    jsonOut --> context

    bash --> after
    after --> toonCodec
    toonCodec --> toonOut
    after --> cache
    cache --> before
    before --> forwarded
    toonCodec --> before
    forwarded --> bash

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
    classDef changed fill:#fff3cd,stroke:#f57f17,color:#000
```

## Notes

- MCP and native bash share the codec and thresholds but not the cache: the MCP
  server is a separate process.
- Native bash compression is limited to eligible tools (default `bash`, override
  `OPENCODE_TOON_PLUGIN_TOOLS`).
- Restoration scans only quoted strings and heredocs; edited/invalid payloads
  stay unchanged.
- JSON remains the canonical internal/on-disk format.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
