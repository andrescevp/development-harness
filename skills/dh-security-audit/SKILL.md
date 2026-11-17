---
name: dh-security-audit
description: >
  Run an enterprise security audit of a whole application or system: establish
  authorization and scope, inventory assets, consume the project security
  profile, model threats, verify controls against current standards (OWASP ASVS,
  Top 10, API/MASVS/MASTG, Desktop, Agentic/MCP), delegate authorized probing,
  and write evidence-backed findings with CVSS/AIVSS severity and remediation.
  Use for security audits, control reviews, pre-release security gates or
  standards/compliance mapping. Never run active tests without written
  authorization.
license: MIT
compatibility: opencode
allowed-tools: read, write, bash, webfetch, websearch
metadata:
  audience: developers
  workflow: security
---

# Security Audit

Audit the whole system, not only a diff. Produce evidence and a fixable report;
never develop exploits or run destructive tests.

## Core Rules

- **Authorization first.** Active testing requires written authorization, a
  scope allowlist, a time window, a non-production target or snapshot/VM, test
  accounts and a stop contact. Static review of an owned repository may proceed
  without the active-test gate.
- **Profile first.** Read `docs/security/security-profile.md` and
  `docs/security/standards.selection.md` (written by `dh-setup`). Absent → use
  the reference matrix defaults and recommend `dh-setup`; stale → report drift.
- **Evidence, not assertion.** Every finding has evidence, a safe
  reproduction, impact, control anchors and remediation.
- **No secrets/PII in reports.** Redact tokens, cookies, keys, personal data and
  production payloads; keep raw evidence in the controlled engagement area.
- **No clean-scan claims.** Report coverage, exclusions and residual risk.
- **Stop on P0/P1:** report, preserve evidence and hand the halt decision to the
  orchestrator; never continue around a blocker.

## Inputs

- Target(s): repos, URLs/APIs, desktop/mobile builds, MCP servers, agent
  instructions, CI/IaC.
- Authorization reference, scope allowlist, exclusions, time window.
- Data classification and compliance scope from the profile.
- Existing architecture/threat model and previous findings.

## Workflow

### Step 1: Scope and inventory

Confirm the gate and record scope. Inventory repositories, services, entry
points, identities, data stores, external integrations, CI/CD, IaC, binaries,
MCP servers/tools and agent instructions. Use `dh-code-query`/`dh-explore` when
available. Record what is out of scope.

### Step 2: Threat model

Delegate to `dh-threat-model` unless a current model exists. Require data-flow
and trust-boundary diagrams, STRIDE per element, LINDDUN where personal data
exists, abuse cases and agentic/MCP threats.

### Step 3: Standards-based static review

Load the project selection; otherwise use
[`references/standards-matrix.md`](references/standards-matrix.md). Select only
the target surfaces present:

- **Web:** ASVS 5.0.0, Top 10:2025, WSTG 4.2.
- **API:** ASVS V4/V8/V9/V10, API Top 10 2023, RFC 9700/8725.
- **Desktop:** Desktop Top 10 (2021), Electron checklist, CIS Benchmarks.
- **Mobile:** MASVS 2.1, MASTG 2.0.
- **Agentic/MCP:** Agentic Top 10 2026, LLM Top 10 2025, MCP security and
  authorization 2026-07-28; AIVSS preview non-normative.
- **Supply chain/CI:** NIST SSDF, SLSA v1.2, CWE Top 25 2025, OSV/Semgrep/Trivy
  where installed.

Review authn, sessions/tokens, object/function/property authorization, input
and output handling, crypto, data protection, configuration, file handling,
logging/alerting, error handling, privacy, business-flow abuse and supply chain.
For every control record pass/fail/not-tested and evidence.

### Step 4: Authorized dynamic verification

Delegate to `dh-security-probe` only after the gate. Read-only checks first;
state-changing checks need per-test approval, non-production data, rate limits,
snapshots and a stop condition. If probing is not authorized, mark those
controls `not tested` and say why.

### Step 5: Score and report

Use [`references/severity-and-reporting.md`](references/severity-and-reporting.md)
and [`references/artifact-contract.md`](references/artifact-contract.md).

- P0 critical, P1 high (both blocking), P2 medium, P3 low.
- CVSS v4.0 vector/score; AIVSS preview for agentic findings, labelled
  non-normative.
- CWE ID and control anchors (ASVS/API/MASVS/MASTG/ASI/LLM/MCP/ISO/PCI/SOC2).
- Evidence, safe reproduction, impact, remediation and re-test status.
- Coverage: tested, not tested, excluded, residual risk.

### Step 6: Re-test and close

Re-test fixed findings against the control, not only the symptom. Update the
finding status and produce a short closure statement. Hand long-lived sanitized
reports to the documentation owner; keep plan-scoped evidence in
`docs/plans/<slug>/tasks/`.

## Finding Template

```markdown
## SEC-001 — <title>

- **Severity:** P1 · CVSS:4.0/AV:N/AC:L/... (score) · AIVSS preview: n/a
- **CWE:** CWE-XXX
- **Controls:** ASVS V8.2.1; API1:2023; ASI03; ISO 27001 A.8.3
- **Affected:** <asset / endpoint / file:line>
- **Evidence:** <redacted request/response, command, timestamp, tool version>
- **Reproduction:** <minimal safe steps, rate limit, test account>
- **Impact:** <business/technical impact>
- **Remediation:** <specific fix + verification>
- **Re-test:** not run
```

## Report Sections

1. Executive summary and release recommendation.
2. Scope, authorization, exclusions, dates and coverage.
3. Architecture and threat model summary.
4. Findings by severity with the template above.
5. Positive controls and standards coverage matrix.
6. Residual risk and follow-ups.
7. Evidence index and redaction statement.

## Stop Conditions

Stop and report when authorization/scope is missing, a target is out of scope, a
test would be destructive, production data appears, credentials/PII leak, a
rate/traffic limit is reached, or the target owner asks to stop. Do not resume
without explicit approval.

## References

- [`references/standards-matrix.md`](references/standards-matrix.md)
- [`references/severity-and-reporting.md`](references/severity-and-reporting.md)
- [`references/artifact-contract.md`](references/artifact-contract.md)
- [`../dh-threat-model/SKILL.md`](../dh-threat-model/SKILL.md)
- [`../dh-security-probe/SKILL.md`](../dh-security-probe/SKILL.md)
- [`../dh-setup/references/security-profile.md`](../dh-setup/references/security-profile.md)

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
