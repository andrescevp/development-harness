---
title: "Standards Selection — dev-harness-skills"
slug: standards-selection
description: "Selected security standards and versions for this repository's MCP, agentic and supply-chain surfaces."
tags: [security, standards]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
status: active
reviewed: 2026-11-17
---

# Standards Selection

Narrowed from `skills/dh-security-audit/references/standards-matrix.md` by the
project security profile. Unselected surfaces are out of scope for this repo.

| Surface | Standard | Version | URL | Control focus |
|---|---|---|---|---|
| MCP/API | MCP Security Best Practices | 2026-07-28 | https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices | confused deputy, token passthrough, SSRF, state handles, local server, OAuth URL, stdio, mix-up, redirect, CIMD, scope |
| MCP/API | MCP Authorization | 2026-07-28 | https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization | OAuth subset, audience, protected resource metadata, scopes |
| MCP/API | OWASP ASVS | 5.0.0 | https://owasp.org/www-project-application-security-verification-standard/ | validation, authz, input handling, logging (local tool handlers) |
| Agentic | OWASP Top 10 for Agentic Applications | 2026 | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ | ASI01–ASI10 |
| LLM | OWASP Top 10 for LLM Applications | 2025 | https://genai.owasp.org/llm-top-10/ | LLM01–LLM10 |
| Agentic scoring | OWASP AIVSS | 0.8 preview | https://aivss.owasp.org/ | non-normative agentic risk preview |
| General | CWE Top 25 | 2025 | https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html | weakness mapping |
| Severity | CVSS | 4.0 | https://www.first.org/cvss/specification-document | scoring record |
| Supply chain | NIST SSDF | SP 800-218 v1.1 | https://csrc.nist.gov/pubs/sp/800/218/final | secure development practices |
| Supply chain | SLSA | 1.2 | https://slsa.dev/spec/v1.2/ | provenance/build track |
| Supply chain | OSV / Semgrep / Trivy / Gitleaks | installed versions | local tooling | dependencies, code patterns, secrets |

## Exclusions

- Web, mobile and packaged desktop testing (not present).
- PCI DSS, ISO 27001 certification, SOC 2 audit (no declared regulated scope).
- Active network probing and third-party targets (local repo only).
- WSTG 5 (unreleased), API Top 10 2026 (does not exist), SLSA 1.1 (retired).

## Review

Re-run `dh-setup` when the stack, CI, agent surface or data classification
changes. A stale `reviewed` date is a drift finding, not an automatic update.
