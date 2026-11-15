---
title: Web Research Agent and Skill — Components
tags: [diagram, plan, mermaid]
project: dev-harness-skills
created: 2026-11-16
updated: 2026-11-16
stack: Markdown harness assets + TypeScript tooling
feature: dh-research-agent-skill
epic: dh-research-agent-skill
diagram_type: flowchart
---

# Web Research Agent and Skill — Components

## Overview

The research capability sits beside the existing planning and execution loop.
It adds one agent, one skill, and one workspace registry; the plugin continues
to register assets only, while documentation writes stay with the documentation
agent.

```mermaid
flowchart TB
    subgraph Plugin[dev-harness-skills plugin]
        agents[agents/ · 6]
        skills[skills/ · 27]
        researcher[dh-researcher]:::new
        researchSkill[dh-research]:::new
        planner[dh-planning]
        contingency[dh-contingency]
        sdd[dh-grill-sdd]
        task[dh-execute-plan-task]
        fast[dh-execute-plan-task-fast]
        documentor[dh-documentor]
        docsRef[dh-create-documentation]
    end

    subgraph Workspace[Workspace docs]
        plan[plan.md<br/>## Research]
        registry[docs/research/index.md]:::new
        notes[docs/research/topic.md]:::new
    end

    subgraph Tests[Verification surface]
        inventory[inventory tests<br/>6 / 27 / 33]
        contract[research contract tests]:::new
        audit[audit loop membership]
        links[link check]
    end

    agents --> researcher
    skills --> researchSkill
    planner --> researchSkill
    contingency --> researchSkill
    sdd --> researchSkill
    task --> researchSkill
    fast --> researchSkill
    researchSkill --> researcher
    researcher --> documentor
    documentor --> docsRef
    docsRef --> notes
    docsRef --> registry
    docsRef --> plan
    researcher -. payload .-> task
    contract --> researcher
    contract --> researchSkill
    contract --> registry
    inventory --> agents
    inventory --> skills
    audit --> agents
    audit --> skills
    links --> plan
    links --> registry

    classDef new fill:#d4edda,stroke:#2e7d32,color:#000
```

## Notes

- The plugin’s registration surface stays agents + skills only; research adds no
  tool, command, or prompt domain.
- `dh-documentor`/`dh-create-documentation` own persistence; the researcher
  returns a payload.
- Tests enforce the inventory, the registry contract, the plan section, and the
  optional execution line.

## Related

- [Plan](../plan.md) · [Diagram index](./index.md)
