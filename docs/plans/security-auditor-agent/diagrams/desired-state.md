---
title: Enterprise Security Auditor — Desired State
tags: [diagram, plan, mermaid, security]
project: dev-harness-skills
created: 2026-11-17
updated: 2026-11-17
stack: Markdown agents and skills + TypeScript plugin inventory
feature: Enterprise Security Auditor Agent and Skills
epic: Security capability
diagram_type: flowchart
---

# Enterprise Security Auditor — Desired State

## Overview

One security auditor orchestrates three capabilities: standards-based audit,
architecture/agentic threat modeling, and authorized non-destructive probing.
Every finding is evidence-backed, mapped to a control, and reported with
remediation and re-test status.

```mermaid
flowchart LR
    subgraph Request["Engagement input"]
        auth[Written authorization<br/>scope + window + exclusions]
        assets[Repo / URLs / APIs /<br/>desktop builds / MCP servers]
    end

    auditor[dh-security-auditor]:::new

    subgraph Skills["New skills"]
        audit[dh-security-audit<br/>standards matrix + report]:::new
        tm[dh-threat-model<br/>DFD + STRIDE/LINDDUN + agentic]:::new
        probe[dh-security-probe<br/>safe mode + evidence]:::new
    end

    subgraph Standards["Current anchors"]
        asvs[OWASP ASVS 5.0]
        top10[OWASP Top 10:2025 / API 2023]
        mobile[MASVS 2.1 / MASTG 2.0]
        desktop[Desktop Top 10 / Electron]
        agentic[Agentic Top 10 2026 / AIVSS]
        mcp[MCP security 2026-07-28]
        supply[NIST SSDF / SLSA / CWE]
    end

    subgraph Output["Evidence + report"]
        findings[Findings<br/>CVSS v4.0 + CWE + control]
        model[Threat model]
        report[Sanitized report<br/>docs/security or plan tasks]
    end

    auth --> auditor
    assets --> auditor
    auditor --> audit
    auditor --> tm
    auditor --> probe
    audit --> asvs
    audit --> top10
    audit --> mobile
    audit --> desktop
    audit --> supply
    tm --> agentic
    tm --> mcp
    probe --> mcp
    probe --> top10
    audit --> findings
    tm --> model
    probe --> findings
    findings --> report
    model --> report
```

## Key changes

- Security becomes a selectable capability, not only a review dimension.
- Standards versions and source links are pinned in a reference matrix.
- Active testing is impossible without authorization, scope and safe mode.
- Agentic/MCP surfaces get first-class threat modeling and probe playbooks.
