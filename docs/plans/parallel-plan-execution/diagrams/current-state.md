---
title: Parallel Plan Execution — Current State
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown skills + TypeScript MCP/TUI tooling
feature: Parallel Plan Execution
epic: Orchestration
diagram_type: flowchart
---

# Parallel Plan Execution — Current State

## Overview

Execution is strictly sequential: `dh-execute-plan` walks phases in order, one
sub-task at a time; `dh-execute-plan-task` selects exactly one active sub-task;
the fast orchestrator has the same single-task model. Plans cannot declare
dependencies or parallel-safe scopes.

```mermaid
flowchart LR
    subgraph Plan["plan.md"]
        p1[Phase 1]
        p2[Phase 2]
        t11[1.1]
        t12[1.2]
        t21[2.1]
    end

    orch[dh-execute-plan]
    task[dh-execute-plan-task]
    review[dh-review]
    status[dh_plan_update_status]
    fast[dh-execute-plan-fast]

    p1 --> t11 --> review --> status --> t12
    t12 --> p2 --> t21
    orch --> task
    fast --> task
    task -. one active task .-> status

    classDef seq fill:#e3f2fd,stroke:#1565c0,color:#000
    class orch,task,review,status,fast seq
```

## Notes

- One active sub-task at a time; multiple `In Progress` is treated as ambiguous.
- No `Parallelizable`, `Depends on`, `Files/Scope`, or `Isolation` metadata.
- No worktree isolation for concurrent work because there is no concurrency.
- TUI derives a single current sub-task.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
