---
title: "Enterprise Security Auditor — Contracts"
slug: security-auditor-agent
description: "Frontmatter, section, artifact, finding and severity contracts for the security capability."
tags: [contracts, security, agents, skills]
project: dev-harness-skills
created: 2026-11-17
updated: 2026-11-17
status: accepted
---

# Contracts

## Asset files

| Asset | Path | Limit |
|---|---|---|
| Agent | `agents/dh-security-auditor.md` | body follows repo agent conventions; no `permission`/`tools` |
| Audit skill | `skills/dh-security-audit/SKILL.md` | ≤ 250 content lines |
| Audit standards | `skills/dh-security-audit/references/standards-matrix.md` | no fixed limit; table-first |
| Audit severity/report | `skills/dh-security-audit/references/severity-and-reporting.md` | no fixed limit |
| Audit artifacts | `skills/dh-security-audit/references/artifact-contract.md` | no fixed limit |
| Threat skill | `skills/dh-threat-model/SKILL.md` | ≤ 250 |
| Threat catalog | `skills/dh-threat-model/references/threat-catalog.md` | no fixed limit |
| Threat template | `skills/dh-threat-model/references/threat-model-template.md` | no fixed limit |
| Probe skill | `skills/dh-security-probe/SKILL.md` | ≤ 250 |
| Probe RoE | `skills/dh-security-probe/references/rules-of-engagement.md` | no fixed limit |
| Probe tools | `skills/dh-security-probe/references/tool-matrix.md` | no fixed limit |
| Probe playbooks | `skills/dh-security-probe/references/probe-playbooks.md` | no fixed limit |
| Setup profile | `skills/dh-setup/references/security-profile.md` | no fixed limit |

## Frontmatter

Agent:

```yaml
name: dh-security-auditor
description: >
  Enterprise security auditor for web, API, desktop, mobile and agentic/MCP
  systems. Use for whole-application security audits, threat modeling and
  authorized non-destructive probing.
mode: all
```

Skills: `name`, trigger-rich `description`, `license: MIT`,
`compatibility: opencode`, `allowed-tools`, `metadata.audience`,
`metadata.workflow`.

## Skill section order

1. Purpose and when to use.
2. Core rules (authorization, evidence, safety).
3. Workflow steps.
4. Output template.
5. References.
6. Safety and doc-search footer.

## Project security profile

`dh-setup` writes, with consent:

- `{project_root}/docs/security/security-profile.md` — detected surfaces,
  data classification, assurance target, compliance scope, test environment,
  authorized tools, review date.
- `{project_root}/docs/security/standards.selection.md` — selected standards
  and versions per surface, exclusions, profile version/date.

The audit reads both before selecting controls. Missing → safe defaults plus a
`dh-setup` recommendation. Stale (`reviewed` older than the configured
interval or stack/compliance changed) → drift warning.

## Finding schema

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable finding ID, e.g. `SEC-001` |
| `title` | yes | Short finding title |
| `severity` | yes | P0–P3 plus CVSS v4.0 vector/score; AIVSS preview for agentic |
| `cwe` | when applicable | CWE ID |
| `controls` | yes | ASVS/API/MASVS/MASTG/ASI/LLM/MCP/CWE/ISO/PCI/SOC2 anchors |
| `evidence` | yes | Redacted request/response, file/line, command, timestamp, tool version |
| `reproduction` | yes | Minimal safe steps or command, including rate limit |
| `impact` | yes | Business/technical impact and affected assets |
| `remediation` | yes | Concrete fix and verification |
| `retest` | yes | `pass` / `fail` / `not run` with date |
| `coverage` | report-level | What was tested, what was not, residual risk |

## Severity mapping

- **P0:** critical, actively exploitable, broad compromise or safety impact.
- **P1:** high, exploitable with meaningful impact; blocks release/merge.
- **P2:** medium, meaningful but constrained or requires preconditions.
- **P3:** low/informational, hardening or defense-in-depth.

CVSS v4.0 is the scoring record. AIVSS is an additive preview for agentic
findings and must be labelled non-normative.

## Artifact locations

| Artifact | Path |
|---|---|
| Plan-scoped audit report | `docs/plans/<slug>/tasks/security-audit.md` |
| Plan-scoped threat model | `docs/plans/<slug>/tasks/threat-model.md` |
| Plan-scoped probe log | `docs/plans/<slug>/tasks/probe-log.md` |
| Long-lived sanitized report | `docs/security/<engagement>/audit.md` via documentation owner |
| Project profile | `docs/security/security-profile.md` (setup-owned) |
| Standards selection | `docs/security/standards.selection.md` (setup-owned) |

Evidence must be redacted before it leaves the engagement working area; never
store secrets, tokens, PII or full production dumps.
