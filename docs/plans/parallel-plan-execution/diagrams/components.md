---
title: Parallel Plan Execution — Components
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown skills + TypeScript MCP/TUI tooling
feature: Parallel Plan Execution
epic: Orchestration
diagram_type: flowchart
---

# Parallel Plan Execution — Components

## Overview

The change adds parallel metadata to the plan contract, a shared scheduler
reference, worker mode in the task skills, and hybrid isolation. Plan tools and
the TUI expose/tolerate multiple active tasks.

```mermaid
flowchart TB
    subgraph Contract["Plan contract"]
        template[phased-plan-template.md]:::changed
        parser[plan-lifecycle parser]:::changed
        scaffold[plan-template scaffold]:::changed
        fixture[canonical fixture]:::changed
    end

    subgraph Scheduler["Scheduling"]
        ref[parallel-scheduler.md]:::new
        standard[dh-execute-plan]:::changed
        fast[dh-execute-plan-fast]:::changed
        worker[dh-execute-plan-task / -fast<br/>parallel worker mode]:::new
    end

    subgraph Isolation["Isolation"]
        scope[scope overlap]:::new
        worktree[dh-create-worktree]:::changed
        commits[orchestrator commits]:::new
    end

    subgraph Readers["Readers"]
        planread[plan_read / plan_create]:::changed
        fastsync[plan_fast_sync]:::changed
        tui[TUI active tasks]:::changed
    end

    subgraph Docs["Docs/tests"]
        docs[README/AGENTS/LOADING]:::changed
        tests[scheduler/parser/TUI tests]:::new
    end

    template --> parser
    parser --> scaffold
    parser --> fixture
    parser --> planread
    parser --> tui
    ref --> standard
    ref --> fast
    worker --> standard
    worker --> fast
    scope --> worktree
    scope --> standard
    worktree --> standard
    commits --> standard
    standard --> fastsync
    fastsync --> tui
    standard --> docs
    fast --> docs
    tests --> parser
    tests --> ref

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
    classDef changed fill:#fff3cd,stroke:#f57f17,color:#000
```

## Notes

- `parallel-scheduler.md` is the single detailed contract; both orchestrators
  link it.
- `plan_read` exposes the metadata; `plan_create`/scaffold render it; the TUI
  shows multiple active tasks.
- `dh-create-worktree` supplies the per-task branch/worktree lifecycle; the
  orchestrator owns integration/merge order.
- Tests cover parser defaults, scheduler readiness, scope/worktree policy,
  worker envelopes, resume, and fast mirroring.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
