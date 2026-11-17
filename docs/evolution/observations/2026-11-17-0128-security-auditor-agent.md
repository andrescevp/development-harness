---
title: "Observation — Security Auditor Agent and Skills"
slug: security-auditor-agent-observation
description: "Session learnings from adding the enterprise security auditor capability, its standards research and safety model."
tags: [observation, security, agents, skills]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
stack: "Markdown agents/skills + TypeScript plugin inventory"
feature: "Enterprise Security Auditor Agent and Skills"
epic: "Security capability"
status: active
---

# Observation — Security Auditor Agent and Skills

## What worked

- Splitting the capability into one accountable auditor + three focused skills
  kept each `SKILL.md` well under 250 lines and made active probing separately
  deniable.
- Research-first paid off: SLSA 1.2 (v1.1 retired), SAMM 2.2, WSTG 4.2,
  ElectroNG (Electronegativity archived), and `snyk-agent-scan` (old
  `mcp-scan` is a stale fork) were all corrected before implementation.
- Profile-first control selection via `dh-setup` avoids hardcoding a
  one-size-fits-all standards matrix.
- The two-tier tool model (read-only default, approved Tier B) is simple enough
  to enforce in a skill and audit report.

## Friction

- The 250-line skill limit forced detail into references; that is healthy but
  makes cross-links important.
- Inventory counts are duplicated across code, tests, smokes and docs; the
  "bare" smoke-pack conditions hid hardcoded 6/27 checks until the full gate.
- The local MCP `dh_logged_command` is a privileged shell capability; the
  self-audit records it as a P2 trust-boundary finding rather than pretending
  the scan is clean.
- Node `HOME`-dependent shims can break package smoke tests; pinning `PATH` to
  the current Node fixed it.

## Decisions to carry forward

- Security reports are evidence, not certification; compliance anchors are
  cross-references.
- No dynamic testing without written authorization, scope, non-production
  target and a stop condition.
- MCP Inspector is pinned and local-only; it has two published advisories.
- Re-run `dh-setup` when stack/compliance changes; treat a stale profile as a
  finding.

## Next

- Run the first real engagement through `dh-security-auditor`.
- Consider a command confirmation/allowlist policy for the MCP shell tool.
- Refresh the standards matrix when WSTG 5 or a new API/Agentic edition ships.
