---
title: Enterprise Security Auditor — Current State
tags: [diagram, plan, mermaid, security]
project: dev-harness-skills
created: 2026-11-17
updated: 2026-11-17
stack: Markdown agents and skills + TypeScript plugin inventory
feature: Enterprise Security Auditor Agent and Skills
epic: Security capability
diagram_type: flowchart
---

# Enterprise Security Auditor — Current State

## Overview

The harness has architecture, implementation, review, research and domain
checks. Security is a review dimension inside `dh-code-review`, not a dedicated
capability with standards coverage, threat modeling or authorized probing.

```mermaid
flowchart TB
    user[User / plan] --> arch[dh-software-architect]
    user --> eng[dh-software-engineer]
    user --> rev[dh-reviewer]
    user --> res[dh-researcher]

    arch --> plan[dh-planning / SDD]
    eng --> code[Implementation + TDD]
    rev --> diff[Scoped diff review<br/>security is one dimension]
    res --> note[Cited research note]

    diff --> gap{{No full-app inventory,<br/>no threat model,<br/>no authorized probing}}
    gap --> risk[Web / API / desktop / MCP<br/>risk coverage depends on reviewer]
```

## Key observations

- Security findings are diff-scoped and ad hoc; there is no control matrix.
- Agentic/MCP threats are not modeled.
- There is no safe, authorization-gated probe workflow.
