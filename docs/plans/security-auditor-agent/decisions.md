---
title: "Enterprise Security Auditor — Decisions"
slug: security-auditor-agent
description: "Frozen decisions for the security auditor agent and skills."
tags: [decisions, security, agents, skills]
project: dev-harness-skills
created: 2026-11-17
updated: 2026-11-17
status: accepted
---

# Decisions

| ID | Decision | Rationale | Requirements |
|---|---|---|---|
| D1 | Agent name `dh-security-auditor`, `mode: all`. | One accountable security owner selectable directly and by plans; no `permission`/`tools` keys, matching bundled agent conventions. | R1 |
| D2 | Three skills: `dh-security-audit`, `dh-threat-model`, `dh-security-probe`. | Separates reading, modeling and touching a target; probing can be denied independently; each skill stays within the 250-line limit. | R2, R3 |
| D3 | `dh-setup` owns project-specific security profiling and standards selection. | Setup already detects stacks and owns project configuration; the audit skill consumes the profile and never silently overrides it. | R13, R14 |
| D4 | Dynamic probing is opt-in, read-only by default, and requires written authorization + scope + safe mode. | Destructive or unauthorized testing is out of scope and must fail closed. | R6, R12 |
| D5 | Plan-scoped evidence lives in `docs/plans/<slug>/tasks/`; long-lived sanitized reports live in `docs/security/<engagement>/`. | Keeps execution evidence with the plan while giving a durable, documentation-owned report location. | R8 |

## Non-goals (frozen)

- No unauthorized, destructive, DoS, persistence or data-exfiltration testing.
- No exploit development, malware or credential theft.
- No certification claim (ISO/PCI/SOC 2) and no replacement for a qualified
  pentest team.
- No bundled scanners, commercial licenses or new runtime dependency.
- No MCP tool-count change.

## Open questions

None blocking. The first real engagement and tool installation are follow-up
decisions.
