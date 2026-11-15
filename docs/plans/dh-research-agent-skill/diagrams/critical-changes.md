---
title: Web Research Agent and Skill — Critical Changes
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown harness assets + TypeScript tooling
feature: dh-research-agent-skill
epic: dh-research-agent-skill
diagram_type: flowchart
---

# Web Research Agent and Skill — Critical Changes

## Overview

The change adds a research capability and changes where evidence lives. The
risky parts are the ownership handoff, the single registry, and making the
execution integration optional rather than a new loop gate.

```mermaid
flowchart LR
    subgraph Before
        prior[Model priors]:::removed
        localOld[dh-explore local only]
        planLocal[Plan-local research folder<br/>docs/plans/slug/research]:::removed
        haltOld[Halt without external evidence]:::changed
    end

    subgraph After
        researcherNew[dh-researcher]:::new
        skillNew[dh-research]:::new
        registryNew[docs/research/index.md]:::new
        noteNew[docs/research/topic.md]:::new
        planSection[## Research in plan.md]:::new
        optional[Optional unblock line<br/>execute-plan-task(-fast)]:::new
        haltNew[One cited pass, then halt if unresolved]:::changed
    end

    prior --> researcherNew
    localOld --> researcherNew
    planLocal --> registryNew
    haltOld --> optional
    optional --> haltNew
    researcherNew --> noteNew
    noteNew --> registryNew
    noteNew --> planSection

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
    classDef changed fill:#fff3cd,stroke:#f57f17,color:#000
    classDef removed fill:#f8d7da,stroke:#c62828,color:#000
```

**Legend:** green = new, amber = changed, red = removed.

## Notes

- The plan-local research folder is removed as a concept before it is ever
  created; the registry is the only location.
- The hard-blocker halt is changed only by adding one optional evidence attempt,
  not by weakening the stop condition.
- Counts move from 5/26/31 to 6/27/33 across tests, CLI, package smokes, and
  docs.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
