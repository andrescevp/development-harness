---
title: TOON Output Integration — Components
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: TypeScript + MCP + @opencode/plugin
feature: TOON Output Integration
epic: Output token efficiency
diagram_type: flowchart
---

# TOON Output Integration — Components

## Overview

The integration adds one shared codec, one bounded cache, one MCP conversion
point, and two native tool hooks. The existing agent/skill registration and the
12-tool MCP surface stay unchanged.

```mermaid
flowchart TB
    subgraph Codec["Shared TOON layer"]
        toon[src/lib/toon.ts]:::new
        hooks[src/lib/toon-hooks.ts]:::new
        cache[(LRU 100)]:::new
        pkg[@toon-format/toon 4.4.x]:::new
    end

    subgraph MCP["MCP server"]
        server[server.ts · 12 tools]
        results[tool-results.ts · textResult]:::changed
        stdio[stdio.ts · instructions]:::changed
    end

    subgraph Plugin["OpenCode plugin"]
        setup[src/plugin.ts · setup]
        after[execute.after]:::new
        before[execute.before]:::new
        agents[agents + skills · 6/27]
    end

    subgraph Host["Host + package"]
        bash[Native bash tool]
        build[tsdown bundle]:::changed
        smoke[smoke-load · smoke-mcp · smoke-pack]
    end

    pkg --> toon
    toon --> results
    toon --> hooks
    hooks --> after
    hooks --> before
    hooks --> cache
    server --> results
    stdio --> server
    setup --> after
    setup --> before
    setup --> agents
    after --> bash
    before --> bash
    toon --> build
    build --> smoke

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
    classDef changed fill:#fff3cd,stroke:#f57f17,color:#000
```

## Notes

- `textResult` is the single MCP conversion point; every tool benefits without
  changing handlers.
- `toon-hooks` owns eligibility, compression, restoration, and the cache; the
  plugin setup only registers hooks and cleanup.
- The cache is in-memory and process-local; it is not persisted or shared with
  the MCP server.
- `@toon-format/toon` must be bundled by tsdown so managed installs and `npx`
  remain self-contained.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
