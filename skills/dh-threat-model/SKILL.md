---
name: dh-threat-model
description: >
  Build or refresh a threat model for a system architecture: inventory assets
  and data flows, draw trust boundaries, apply STRIDE per element and LINDDUN
  for personal data, capture abuse cases, and add agentic/MCP threats (goal
  hijack, tool misuse, identity abuse, supply chain, code execution, memory
  poisoning, inter-agent spoofing, cascading failures, trust exploitation,
  rogue agents). Use during design, before a security audit, or when a system
  or trust boundary changes.
license: MIT
compatibility: opencode
allowed-tools: read, write, bash
metadata:
  audience: developers
  workflow: security
---

# Threat Model

Model what can go wrong before testing what does. The output is a reviewable
model with assumptions, assets, boundaries, threats and test ideas — not a
generic checklist.

## Core Rules

- **Architecture evidence first.** Read the real system: repos, deployment,
  identity, data stores, integrations, client/server split, MCP/agent topology.
  Mark assumptions where evidence is missing.
- **One model, shared taxonomy.** Findings from `dh-security-audit` should use
  the same threat IDs/ASI IDs and control anchors.
- **Agentic/MCP is its own boundary set.** Model the model, tools, memory,
  inter-agent channels, human approvals and MCP authorization separately.
- **No secrets/PII** in the model; use data classes and redacted examples.
- **Actionable threats.** Each threat names an asset, boundary, abuse path,
  existing control, test idea and owner.

## Workflow

### Step 1: Scope and assets

Define the system, actors, entry points, data stores, privileged operations,
external services, build/deploy pipeline, MCP servers/tools, agent instructions
and memory. List assets by confidentiality/integrity/availability/safety value.

### Step 2: Data-flow and trust boundaries

Draw a DFD with processes, data stores, external entities and flows. Mark every
trust boundary (browser/server, service/service, tenant/tenant, user/admin,
agent/tool, model/memory, MCP client/server, build/runtime). Note where
authentication, authorization, validation and logging occur.

### Step 3: STRIDE per element

For each process, store, flow and external entity, ask:
Spoofing, Tampering, Repudiation, Information disclosure, Denial of service,
Elevation of privilege. Record the abuse path and existing/missing control.

### Step 4: Privacy and abuse cases (when applicable)

Apply LINDDUN (linking, identifying, non-repudiation, detecting, data
disclosure, unawareness, non-compliance) where personal data exists. Add
business-logic abuse cases (scalping, fake accounts, refund abuse, quota
bypass) and human-safety cases where relevant.

### Step 5: Agentic and MCP threats

Use [`references/threat-catalog.md`](references/threat-catalog.md) to cover:

- ASI01 goal hijack / prompt injection
- ASI02 tool misuse and exploitation
- ASI03 identity and privilege abuse
- ASI04 agentic supply chain
- ASI05 unexpected code execution
- ASI06 memory and context poisoning
- ASI07 insecure inter-agent communication
- ASI08 cascading failures
- ASI09 human-agent trust exploitation
- ASI10 rogue agents

MCP-specific: confused deputy, token passthrough, SSRF, state-handle hijacking,
local server compromise, OAuth URL validation, stdio proxy risk, mix-up,
localhost redirect impersonation, CIMD trust, scope minimization.

### Step 6: Prioritize and hand off

Score likelihood/impact, identify the control that should stop each threat, and
write test ideas for `dh-security-audit`/`dh-security-probe`. Mark accepted
risks with owner and rationale. Revisit when the architecture changes.

## Output

Use [`references/threat-model-template.md`](references/threat-model-template.md).
Store plan-scoped models in `docs/plans/<slug>/tasks/threat-model.md`; long-lived
sanitized models under `docs/security/<engagement>/threat-model.md` via the
documentation owner.

## Quality bar

- Every trust boundary has at least one threat or an explicit "no credible
  threat" rationale.
- Every threat has an asset, abuse path, control status and test idea.
- Agentic/MCP models include tool authorization, memory and inter-agent flows.
- Assumptions are listed; missing evidence is not hidden.

## References

- [`references/threat-catalog.md`](references/threat-catalog.md)
- [`references/threat-model-template.md`](references/threat-model-template.md)
- [`../dh-security-audit/SKILL.md`](../dh-security-audit/SKILL.md)

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
