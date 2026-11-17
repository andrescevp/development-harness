---
title: Enterprise Security Auditor — Components
tags: [diagram, plan, mermaid, security]
project: dev-harness-skills
created: 2026-11-17
updated: 2026-11-17
stack: Markdown agents and skills + TypeScript plugin inventory
feature: Enterprise Security Auditor Agent and Skills
epic: Security capability
diagram_type: flowchart
---

# Enterprise Security Auditor — Components

## Component graph

```mermaid
flowchart TB
    subgraph Plugin["dev-harness-skills plugin"]
        subgraph Agent["Agent"]
            auditor[dh-security-auditor<br/>mode: all]
        end
        subgraph Skills["Skills"]
            audit[dh-security-audit]
            tm[dh-threat-model]
            probe[dh-security-probe]
        end
        subgraph Refs["References"]
            matrix[standards-matrix.md]
            severity[severity-and-reporting.md]
            roe[rules-of-engagement.md]
            tools[tool-matrix.md]
            plays[probe-playbooks.md]
        end
        subgraph Inventory["Inventory + docs"]
            counts[7 agents / 30 skills / 37 names]
            selection[agent-selection Security role]
            docs[README / LOADING / AGENTS / index]
        end
    end

    auditor --> audit
    auditor --> tm
    auditor --> probe
    audit --> matrix
    audit --> severity
    probe --> roe
    probe --> tools
    probe --> plays
    tm --> agentic[Agentic/MCP threat catalog]
    audit --> inventory
    probe --> inventory
```

## Interface boundaries

- The agent owns the engagement narrative; skills own repeatable procedures.
- The audit skill consumes the threat model and probe results; it does not run
  active tests itself.
- The probe skill is the only path to active targets and is authorization-gated.
- Reports are written through the documentation owner for long-lived artifacts;
  plan-scoped evidence stays under `docs/plans/<slug>/tasks/`.
