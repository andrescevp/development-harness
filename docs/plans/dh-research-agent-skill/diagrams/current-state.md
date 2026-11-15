---
title: Web Research Agent and Skill — Current State
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown harness assets + TypeScript tooling
feature: dh-research-agent-skill
epic: dh-research-agent-skill
diagram_type: flowchart
---

# Web Research Agent and Skill — Current State

## Overview

Planning and execution answer external-fact questions from model knowledge plus
the local codebase. There is no web-research capability, no research registry,
and a blocker either gets guessed at or halts the loop before any external
evidence is gathered.

```mermaid
flowchart LR
    subgraph Planning
        planner[dh-planning]
        sdd[dh-grill-sdd]
        contingency[dh-contingency]
    end

    subgraph Execution
        task[dh-execute-plan-task]
        fast[dh-execute-plan-task-fast]
        blocker{Hard blocker?}
    end

    subgraph Evidence
        local[dh-explore<br/>local codebase only]
        model[Model priors<br/>no citations]
    end

    planner --> model
    sdd --> model
    contingency --> model
    task --> local
    task --> model
    fast --> local
    fast --> model
    task --> blocker
    fast --> blocker
    blocker -- "not resolved" --> halt[Stop and ask guidance]
    blocker -- "keep trying" --> model

    classDef gap fill:#ffebee,stroke:#c62828,color:#000
    class model,halt gap
```

## Notes

- `dh-explore` only reads the local repository; it cannot verify versions, EOL
  status, upstream issues, or current API behavior.
- The hard-blocker halt is correct, but it fires without a bounded external
  evidence attempt.
- There is no `docs/research/` folder or registry in the workspace.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
