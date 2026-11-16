---
title: Parallel Plan Execution — Desired State
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown skills + TypeScript MCP/TUI tooling
feature: Parallel Plan Execution
epic: Orchestration
diagram_type: flowchart
---

# Parallel Plan Execution — Desired State

## Overview

Both orchestrators run a shared DAG scheduler over explicitly declared phases
and sub-tasks. Up to three workers run concurrently; disjoint work shares a
worktree, overlapping/resource-heavy work uses a worktree; the orchestrator is
the only status/ledger writer.

```mermaid
flowchart LR
    subgraph Plan["plan.md metadata"]
        ph[Phases]
        deps[Depends on]
        par[Parallelizable]
        scope[Files/Scope + Isolation]
    end

    scheduler[Scheduler<br/>ready set / max 3 / DAG]:::new
    dispatch[Dispatch workers]:::new

    subgraph Pool["Worker pool"]
        w1[Worker 1<br/>2.1 shared]:::new
        w2[Worker 2<br/>2.2 shared]:::new
        w3[Worker 3<br/>2.3 worktree]:::new
    end

    subgraph Orchestrator["Orchestrator-owned"]
        review[dh-review / code-review]
        status[dh_plan_update_status / ledger]
        close[Phase close only all complete]:::new
    end

    subgraph Isolation["Hybrid isolation"]
        shared[Same worktree<br/>disjoint scopes]:::new
        worktree[Dedicated worktree<br/>merge in order]:::new
    end

    ph --> scheduler
    deps --> scheduler
    par --> scheduler
    scope --> scheduler
    scheduler --> dispatch
    dispatch --> w1
    dispatch --> w2
    dispatch --> w3
    w1 --> shared
    w2 --> shared
    w3 --> worktree
    w1 --> review
    w2 --> review
    w3 --> review
    review --> status
    status --> close
    shared -. serialized commits .-> status

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
```

## Notes

- Default concurrency is 3; hard cap 8.
- Legacy plans without metadata stay sequential.
- Workers return a result envelope and never edit plan files or commit in a
  shared worktree.
- Multiple `In Progress` phases/sub-tasks are expected; phase closure is still
  all-sub-tasks-complete.
- Worktree tasks integrate in dependency/plan order; conflicts block.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
