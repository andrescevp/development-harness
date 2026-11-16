---
title: Web Research Agent and Skill — Desired State
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown harness assets + TypeScript tooling
feature: dh-research-agent-skill
epic: dh-research-agent-skill
diagram_type: flowchart
---

# Web Research Agent and Skill — Desired State

## Overview

Planning, contingency, SDD, and execution can delegate one bounded question to
`dh-researcher`, which returns cited findings. The documentation agent persists
the note and index in `docs/research/`, plans link the note, and execution gets
one optional unblock attempt before the hard-blocker halt.

```mermaid
flowchart LR
    subgraph Callers
        planner[dh-planning]
        sdd[dh-grill-sdd]
        contingency[dh-contingency]
        task[dh-execute-plan-task]
        fast[dh-execute-plan-task-fast]
    end

    researcher[dh-researcher]:::new
    researchSkill[dh-research]:::new
    web[(Web sources)]
    payload[Note payload + index row]
    documentor[dh-documentor]:::new
    registry[docs/research/index.md]:::new
    note[docs/research/topic.md]:::new
    plan[plan.md → ## Research]:::new
    blocker{Hard blocker?}

    planner --> researchSkill
    sdd --> researchSkill
    contingency --> researchSkill
    task --> researchSkill
    fast --> researchSkill
    researchSkill --> researcher
    researcher --> web
    researcher --> payload
    payload --> documentor
    documentor --> note
    documentor --> registry
    documentor --> plan
    plan -. linked note .-> planner
    plan -. linked note .-> task
    task --> blocker
    fast --> blocker
    blocker -- "evidence resolves" --> proceed[Continue sub-task]:::new
    blocker -- "inconclusive" --> halt[Stop and ask guidance]

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
```

## Notes

- `dh-researcher` does not write; it composes the note payload and the proposed
  index row.
- `dh-documentor` writes the note, updates `docs/research/index.md`, and adds or
  updates the plan’s `## Research` links.
- The optional unblock is one pass; an unresolved blocker still halts.
- The fast mirror omits `## Research` because it sits outside the phases region.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
