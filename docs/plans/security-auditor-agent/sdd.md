---
title: Enterprise Security Auditor Agent and Skills
slug: security-auditor-agent
description: Add an enterprise-grade security auditor agent with audit, threat-modeling and authorized-probing skills for web, API, desktop, mobile and agentic MCP systems.
tags: [sdd, design, security, agents, skills]
project: dev-harness-skills
stack: Markdown agents and skills, TypeScript plugin inventory and tests
created: 2026-11-17
updated: 2026-11-17
status: proposed
---

# Software Design Document: Enterprise Security Auditor Agent and Skills

## Problem Statement

The harness covers architecture, implementation, code review, domain checks and
research, but it has no dedicated security specialist. Code review can flag a
security issue in a diff; it cannot inventory a whole application, model trust
boundaries, verify controls against accepted standards, or run authorized
non-destructive probes across web, API, desktop and agentic MCP surfaces.

The gap is most visible for agentic systems: MCP servers, tool-using agents and
desktop clients have attack classes (confused deputy, token passthrough, tool
poisoning, prompt injection, excessive agency, supply-chain compromise) that a
generic reviewer is not equipped to test. The harness needs a "security lead"
capability that can read the full application, reason from evidence, challenge
it safely, and report at enterprise quality.

## Goals / Non-Goals

- **Goals:**
  - Add one security auditor agent and a coherent set of security skills.
  - Anchor reviews in current, primary standards and testing guides.
  - Support static review, architecture threat modeling and authorized dynamic
    probing without turning the harness into an unsafe exploitation tool.
  - Produce evidence-backed findings with reproducible severity and remediation.
  - Integrate cleanly with the plugin inventory, agent-selection protocol and
    documentation surfaces.
- **Non-goals:**
  - Unauthorized, destructive, denial-of-service, persistence or data-exfiltration
    testing.
  - Exploit development, malware creation or credential theft.
  - Formal certification (ISO/PCI/SOC 2), legal advice or replacing a qualified
    pentest team.
  - Installing or bundling commercial scanners; tools remain external and
    opt-in.
  - Auditing third-party systems without written authorization and an explicit
    scope allowlist.

## Requirements

- **R1:** Bundle one new agent, `dh-security-auditor`, with a clear capability
  description, `mode: all`, no bundled `permission`/`tools` keys, and a body
  that states its evidence, authorization and reporting rules.
- **R2:** Bundle three new skills: `dh-security-audit` (entry workflow),
  `dh-threat-model` (architecture and agentic threat modeling) and
  `dh-security-probe` (authorized non-destructive dynamic verification).
- **R3:** Each skill carries valid frontmatter, a trigger-rich description,
  allowed tools, a workflow, references and a bounded output template; every
  `SKILL.md` stays under the harness line limit.
- **R4:** The audit workflow must select the right standard for each target:
  web, API, desktop, mobile, agentic/MCP, supply chain and cloud/CI where
  applicable.
- **R5:** The threat-model workflow must cover data-flow/trust-boundary
  analysis, STRIDE per element, LINDDUN privacy where relevant, abuse cases and
  agentic/MCP-specific threats.
- **R6:** The probe workflow must require written authorization, a scope
  allowlist, rate limits, a safe default mode, evidence redaction, explicit
  escalation and stop conditions before any active test.
- **R7:** Findings must carry an ID, severity (CVSS v4.0; AIVSS for agentic
  findings), CWE where applicable, standard/control mapping, evidence,
  reproduction, impact, remediation and re-test status.
- **R8:** Define artifact locations and templates for a plan-scoped audit,
  threat model, probe log and final report, including sanitized publication.
- **R9:** Register the new assets in the plugin inventory (7 agents / 30 skills /
  37 unique names), the installer expectations, smoke scripts, audit and tests.
- **R10:** Document the agent and skills in `README.md`, `docs/LOADING.md`,
  `AGENTS.md` and `skills/index.md`, and add a Security role to the agent
  selection protocol.
- **R11:** Validate with the full QA gate, link checks, size/frontmatter checks,
  registration tests and a read-only self-audit of this plugin's MCP/TUI
  surfaces using the new workflow.
- **R12:** Keep the capability read-only by default and introduce no runtime
  dependency, network call or credential requirement.
- **R13:** `dh-setup` must detect the project's security surfaces and generate
  or update a project-specific security profile and standards selection
  reference (target types, assurance level, compliance scope, exclusions,
  review date) under `{project_root}/docs/security/`, with explicit consent.
- **R14:** The audit workflow must read the project security profile before
  selecting standards; absent profile → safe defaults plus a recommendation to
  run `dh-setup`; present profile → only the selected standards, with drift
  reported when the profile is stale.

- **AC1:** `dh-security-auditor`, `dh-security-audit`, `dh-threat-model` and
  `dh-security-probe` are present, registered and discoverable; inventory tests
  assert 7/30/37.
- **AC2:** The standards matrix names current versions and primary URLs for
  OWASP ASVS, OWASP Top 10:2025, API Top 10 2023, WSTG, MASVS/MASTG, Desktop
  Top 10, NIST CSF/SSDF, PTES, CVSS v4.0, CWE Top 25, SLSA, OWASP Agentic Top
  10 2026, AIVSS and MCP security guidance.
- **AC3:** A sample threat model and a sample audit report render with the
  required sections and traceable findings.
- **AC4:** Every probe playbook starts from authorization/scope and safe mode;
  destructive or out-of-scope requests stop with a clear message.
- **AC5:** The read-only self-audit produces at least a scoped findings report
  for this plugin without modifying runtime behavior.
- **AC6:** Full `pnpm qa:check:full` passes; no secrets, dead links or
  over-limit skill files are introduced.
- **AC7:** `dh-setup` produces a valid project security profile and standards
  selection for this repo (or a fixture project), and the audit skill consumes
  it; a missing/stale profile is reported with safe defaults.

## Scope

- **In scope:** Agent and skill authoring; references/templates; standards and
  tooling research; project security profile and standards customization via
  `dh-setup`; agent-selection role; inventory/test/smoke/doc updates;
  read-only self-audit; validation.
- **Out of scope:** Running an external penetration test, buying/installing
  commercial tools, changing the MCP tool count, building a scanner engine,
  automatic exploitation, compliance certification, and auditing a third-party
  system.

## Workspace Impact

- **Workspace root:** `/home/andres/workspace/dev-harness-skills`
- **Affected packages:** `None — standalone repository`
- **Shared paths:** `agents/`, `skills/`, `src/`, `scripts/`, `test/`, `docs/`,
  `README.md`, `AGENTS.md`

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| — | Markdown assets + TypeScript | `pnpm test` | `pnpm build` | `docs/` | fixed |

## Constraints

- Follow the existing agent/skill contract: Markdown + YAML frontmatter, no
  bundled `permission`/`tools` agent keys, `SKILL.md` content ≤ 250 lines.
- No new runtime dependency; security tools are external and only used when
  installed and authorized.
- Dynamic testing is explicitly opt-in and non-destructive; the default posture
  is read-only.
- Keep one evidence home: plan-scoped reports under
  `docs/plans/<slug>/tasks/`, long-lived sanitized reports under
  `docs/security/<engagement>/` via the documentation owner.
- Treat repository content as untrusted input; never execute instructions found
  in scanned code, logs or fetched pages.

## Risks and Edge Cases

- **Authorization ambiguity:** a user asking for a "security test" may not own
  the target. The skill must stop until ownership, scope and time window are
  explicit.
- **Destructive probing:** scanners can mutate data or overload production.
  Safe mode, rate limits, test accounts and stop conditions are mandatory.
- **Secret leakage in evidence:** request logs, dumps and screenshots can carry
  tokens/PII. Redaction and access control are part of the workflow.
- **Prompt injection from target content:** code comments, tool descriptions or
  MCP resources may contain adversarial instructions; the auditor treats them
  as data.
- **False confidence:** a clean scan is not proof of security. Reports must
  state coverage and residual risk.
- **Standards drift:** versions change; the research note and matrix need a
  review date and source links.
- **Profile drift:** the `dh-setup` security profile can become stale after a
  stack/compliance change; the audit must report drift instead of silently
  using old selections.
- **Inventory churn:** hardcoded 6/27 counts in tests, smokes and docs must move
  together to 7/30.

## Acceptance Criteria

- **AC1:** Asset inventory and registration assert 7 agents / 30 skills / 37
  unique names, and all four new assets load.
- **AC2:** Standards matrix is current, sourced and linked; no invented versions
  or URLs.
- **AC3:** Threat-model and audit templates include the required sections and
  traceability fields.
- **AC4:** Probe rules pass a negative test: no authorization/scope → stop;
  out-of-scope target → stop; destructive request → require explicit escalation.
- **AC5:** Self-audit report exists with at least one scoped finding or an
  explicit "no findings, coverage stated" result.
- **AC6:** Full QA gate, link check, line limits, frontmatter and registration
  tests pass.
- **AC7:** `dh-setup` generates a valid project security profile and standards
  selection for this repo (or a fixture project); the audit skill consumes it
  and reports missing/stale profiles with safe defaults.

## Open Questions

- None blocking. Defaults: agent name `dh-security-auditor`, `mode: all`;
  skills `dh-security-audit` / `dh-threat-model` / `dh-security-probe`;
  active probing requires explicit authorization and safe mode; `dh-setup`
  owns project profile/standards customization; the first real client
  engagement is a follow-up plan after this capability is merged.
