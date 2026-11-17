---
title: "Evolution — Enterprise Security Auditor Agent and Skills"
slug: security-auditor-agent-evolution
description: "How the harness gained a whole-application security auditor, standards-based audit, threat modeling and authorized probing capabilities."
tags: [evolution, security, agents, skills]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
stack: "Markdown agents/skills + TypeScript plugin inventory"
feature: "Enterprise Security Auditor Agent and Skills"
epic: "Security capability"
status: active
---

# Evolution — Enterprise Security Auditor Agent and Skills

## Overview

The harness gained a dedicated enterprise security capability: one
`dh-security-auditor` agent and three skills covering the audit engagement,
architecture/agentic threat modeling and authorized non-destructive probing.
The capability is standards-anchored, project-profile-driven and read-only by
default.

## What Changed

- **Agent:** `agents/dh-security-auditor.md` (`mode: all`) owns authorization,
  full-app inventory, method, severity, reporting and safety boundaries.
- **Skills:** `dh-security-audit` (engagement workflow), `dh-threat-model`
  (DFD/STRIDE/LINDDUN + agentic/MCP catalog), `dh-security-probe` (rules of
  engagement, tool tiers, per-surface playbooks).
- **Standards:** version-pinned matrix (ASVS 5.0.0, Top 10:2025, API 2023,
  WSTG 4.2, MASVS 2.1/MASTG 2.0, Desktop 2021/Electron, Agentic 2026, LLM
  2025, MCP 2026-07-28, AIVSS 0.8 preview, CVSS 4.0, CWE 2025, SLSA 1.2,
  NIST SSDF/CSF, SAMM 2.2, compliance anchors).
- **Project customization:** `dh-setup` detects surfaces and writes
  `docs/security/security-profile.md` + `standards.selection.md`; the audit
  consumes them, with safe defaults/drift reporting.
- **Safety:** no authorization → no probe; read-only default; Tier B requires
  per-test approval; evidence redaction; stop conditions.
- **Inventory:** 7 agents / 30 skills / 37 unique names; installer, smokes,
  audit, registration tests and docs updated.
- **Validation:** read-only self-audit produced one P2 trust-boundary finding
  (`dh_logged_command` local shell execution) with residual-risk guidance.

## Evidence

- Plan: `docs/plans/security-auditor-agent/plan.md`
- SDD/decisions/contracts: `sdd.md`, `decisions.md`, `contracts.md`
- Research: `docs/research/security-auditor-standards-2026.md`,
  `docs/research/security-probing-tooling-2026.md`
- Self-audit: `docs/plans/security-auditor-agent/tasks/security-self-audit.md`
- QA: `pnpm qa:check:full` + `pnpm test` (79 files / 1263 tests) + smokes

## Follow-ups

- First real delegated engagement using `dh-security-auditor`.
- Consider a confirmation/allowlist policy for `dh_logged_command`.
- Re-verify standards versions at each engagement; WSTG 5 and SOC 2 2027 are
  not yet current.
