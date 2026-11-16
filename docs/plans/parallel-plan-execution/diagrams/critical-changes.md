---
title: Parallel Plan Execution — Critical Changes
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown skills + TypeScript MCP/TUI tooling
feature: Parallel Plan Execution
epic: Orchestration
diagram_type: flowchart
---

# Parallel Plan Execution — Critical Changes

## Overview

The risky shifts are schema metadata, status ownership, isolation, and resume.
Everything else builds on the existing phased model and review gates.

```mermaid
flowchart LR
    subgraph Before
        one[One active task]:::changed
        ordered[Strict phase/task order]:::changed
        taskWrites[Task skills write status]:::removed
        noScope[No file-scope declaration]:::removed
        noWorktree[No worktree isolation]:::removed
    end

    subgraph After
        ready[Ready-set scheduler]:::new
        multi[Multiple In Progress]:::new
        orchWrites[Orchestrator-only status/ledger]:::new
        metadata[Parallelizable / Depends on / Files/Scope / Isolation]:::new
        hybrid[Shared disjoint + worktree overlap]:::new
        drain[Failure drain + multi-active resume]:::new
    end

    one --> multi
    ordered --> ready
    taskWrites --> orchWrites
    noScope --> metadata
    noWorktree --> hybrid
    ready --> drain

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
    classDef changed fill:#fff3cd,stroke:#f57f17,color:#000
    classDef removed fill:#f8d7da,stroke:#c62828,color:#000
```

**Legend:** green = new, amber = changed, red = removed.

## Notes

- The scheduler cannot infer independence; explicit plan metadata is the
  contract.
- Same-worktree concurrency requires disjoint declared scope; unknown scope
  serializes.
- Workers never commit in a shared worktree; the orchestrator serializes git
  operations.
- Fast mode uses the same scheduler with serialized ledger writes and end gates.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
