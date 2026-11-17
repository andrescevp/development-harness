---
title: "Contingency Analysis: Enterprise Security Auditor Agent and Skills"
slug: security-auditor-agent
description: "Alternatives for decomposing the security capability, probing safety and artifact ownership."
tags: [contingency, security, agents, skills]
project: dev-harness-skills
stack: Markdown agents and skills + TypeScript plugin inventory
created: 2026-11-17
updated: 2026-11-17
status: proposed
---

# Contingency Analysis: Enterprise Security Auditor Agent and Skills

## Architectural Decision Areas

1. **Capability decomposition** — one agent with one skill, one agent with
   several skills, or several specialist agents.
2. **Active probing boundary** — embed commands in the audit workflow or keep a
   separate authorization-gated probe skill.
3. **Evidence/report ownership** — plan-local reports, a long-lived
   `docs/security/` area, or documentation-agent-only publication.
4. **Standards mapping** — one broad matrix or per-surface reference files.
5. **Project customization** — hardcoded standards or a `dh-setup`-owned
   project profile/standards selection.

## Plan A: Unified auditor agent + three focused skills — Recommended

### Approach

1. Add `dh-security-auditor` (`mode: all`) as the engagement owner.
2. Add `dh-security-audit` for authorization, inventory, static controls,
   severity/reporting and re-test.
3. Add `dh-threat-model` for DFD/trust boundaries/STRIDE/LINDDUN and agentic/MCP
   threats.
4. Add `dh-security-probe` for authorized, non-destructive dynamic verification,
   with rules of engagement and a tool matrix.
5. Put the standards matrix, severity/reporting schema and artifact contract in
   `dh-security-audit/references/`; put the threat catalog and playbooks in the
   owning skill's references.
6. Extend `dh-setup` to detect project surfaces and write a project security
   profile/standards selection; the audit reads it before choosing controls.

### Risk: Medium

- Three skills create more surface to keep consistent.
- The auditor must correctly route work between static review, modeling and
  probing.
- Mitigation: one shared standards matrix, one severity schema and explicit
  handoffs in the agent/skill contracts.

### Complexity: M (1 agent, 3 skills, 6–8 reference files, inventory/doc churn)

### Trade-offs

- **Gain:** clear separation between reading, modeling and touching a target;
  active testing can be denied independently; skills stay under the line limit.
- **Sacrifice:** more files and cross-links than a single skill.

## Plan B: One auditor agent + one monolithic security skill

### Approach

- Put authorization, static review, threat modeling, probing, standards and
  reporting into `dh-security-audit/SKILL.md` plus a few references.
- No separate threat-model or probe skill.

### Risk: High

- The skill exceeds the 250-line limit or hides active-test rules in a long
  document.
- Probing becomes an implicit part of "audit", weakening the authorization gate.
- Hard to select only the modeling or probing capability.

### Complexity: S (one skill, fewer files)

### Trade-offs

- **Gain:** fewer assets and simpler inventory.
- **Sacrifice:** safety boundary, discoverability and line-limit compliance.

## Plan C: Three specialist agents + shared references

### Approach

- Add `dh-security-auditor`, `dh-threat-modeler` and `dh-security-prober` as
  separate agents, with shared reference files.
- The architect/planner orchestrates them directly.

### Risk: High

- Three new agent personas increase selection ambiguity and maintenance.
- Users must know which specialist to invoke; the harness prefers one
  accountable owner per capability.
- More inventory churn (9 agents) for little gain.

### Complexity: L (3 agents + skills + references + docs)

### Trade-offs

- **Gain:** maximum separation of duties.
- **Sacrifice:** orchestration simplicity, discoverability and the single
  engagement owner.

## Recommendation

**Proceed with Plan A** — it keeps one accountable security owner while making
the active-probing boundary an explicit, separately selectable skill. Adopt
Plan B only if the harness ever enforces a one-skill-per-capability limit;
adopt Plan C only if a future enterprise deployment requires formal separation
of duties between assessment, modeling and testing roles.
