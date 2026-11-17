# Standards Matrix

Pin versions here. The project profile narrows this matrix; it never expands a
selection silently. Reviewed: 2026-11-17. Primary sources:
[`docs/research/security-auditor-standards-2026.md`](../../../docs/research/security-auditor-standards-2026.md).

## Authority tiers

- **Tier 1 normative:** ASVS 5.0.0, MASVS 2.1.0, MCP 2026-07-28, RFC 9700,
  RFC 8725, ISO/IEC 27001:2022, PCI DSS 4.0.1.
- **Tier 2 consensus awareness:** Top 10:2025, API Top 10 2023, LLM Top 10
  2025, Agentic Top 10 2026, CWE Top 25 2025.
- **Tier 3 draft/incubator:** AIVSS v0.8, Desktop App Security Top 10 (2021),
  Code Review Guide v2.0. Never gate a release on Tier 3 alone.

## Target matrix

| Target | Normative standards | Test/procedure guides | Control domains |
|---|---|---|---|
| Web | ASVS 5.0.0; Top 10:2025 | WSTG 4.2; Cheat Sheet Series | access control, misconfiguration, supply chain, crypto, injection, design, auth, integrity, logging, exceptions |
| API | ASVS V4/V8/V9/V10; API Top 10 2023; RFC 9700; RFC 8725 | WSTG API/auth tests; ASVS-derived checks | BOLA/BFLA, property authz, resource consumption, business flows, SSRF, inventory, third-party consumption, OAuth/JWT |
| Desktop | Desktop Top 10 (2021); Electron 17-point checklist; CIS Benchmarks | No authoritative OWASP desktop testing guide — compose ASVS + WSTG + platform hardening | DA1–DA10: injection, auth/session, local data, crypto, local authz, config/permissions, transport, binary quality, components, logging |
| Mobile | MASVS 2.1.0 | MASTG 2.0.0; MASWE | storage, crypto, auth, network, platform, code, resilience, privacy |
| Agentic/MCP | Agentic Top 10 2026 (ASI01–ASI10); LLM Top 10 2025; MCP security/authorization 2026-07-28; RFC 9700/8725 | per-ASI mitigations; MCP attack-class tests; LLM evals/red-team | goal/tool/identity integrity, supply chain, code execution, memory/context, inter-agent, cascading, trust, rogue agents, authorization/consent, scope |
| Program/governance | NIST CSF 2.0; SSDF SP 800-218 v1.1; SP 800-218A; SAMM 2.2.0 | NIST SP 800-115; PTES v1.0 phases 1–4 | governance, risk, protective controls, detection, response, recovery; SSDF PO/PS/PW/RV; engagement scoping/reporting |
| Supply chain/severity | SLSA v1.2; CWE Top 25 2025; CVSS v4.0 | SLSA verification; CWE mapping | source integrity, provenance, dependencies, weakness classification, scoring |
| Compliance anchors | ISO/IEC 27001:2022; PCI DSS 4.0.1; SOC 2 2017 TSC (2022 POF); CIS Benchmarks | scheme procedures | mapping only — never a certification claim |

## Version lock

| ID | Version | Published | URL |
|---|---|---|---|
| ASVS | 5.0.0 | 2025-05-30 | https://owasp.org/www-project-application-security-verification-standard/ |
| Top10 | 2025 | 2025 | https://owasp.org/Top10/2025/ |
| API Top10 | 2023 | 2023 | https://owasp.org/www-project-api-security/ |
| WSTG | 4.2 | 2020 | https://owasp.org/www-project-web-security-testing-guide/ |
| MASVS | 2.1.0 | 2024-01-18 | https://mas.owasp.org/MASVS/ |
| MASTG | 2.0.0 | 2026-06-30 | https://mas.owasp.org/MASTG/ |
| Desktop Top10 | 2021 | 2021 | https://owasp.org/www-project-desktop-app-security-top-10/ |
| Agentic Top10 | 2026 | 2025-12-09 | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ |
| LLM Top10 | 2025 | 2025 | https://genai.owasp.org/llm-top-10/ |
| MCP | 2026-07-28 | 2026-07-28 | https://modelcontextprotocol.io/specification/2026-07-28/ |
| AIVSS | 0.8 (preview) | — | https://aivss.owasp.org/ |
| CVSS | 4.0 (doc 1.2) | 2023-11-01 | https://www.first.org/cvss/specification-document |
| CWE Top25 | 2025 | 2025-12-15 | https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html |
| SLSA | 1.2 | 2025-11-24 | https://slsa.dev/spec/v1.2/ |
| SAMM | 2.2.0 | 2026-07-06 | https://owaspsamm.org/model/ |
| NIST CSF | 2.0 (CSWP 29) | 2024-02-26 | https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final |
| SSDF | 1.1 (SP 800-218) | 2022-02 | https://csrc.nist.gov/pubs/sp/800/218/final |
| PCI DSS | 4.0.1 | 2024-06-11 | https://www.pcisecuritystandards.org/document_library/ |

## Selection rules

1. Read the project profile; use only the selected surfaces.
2. A finding cites at least one Tier 1/2 control and, where possible, a CWE.
3. Do not cite WSTG v5, API Top 10 2026, SLSA v1.1 or the SOC 2 2027 draft as
   current.
4. Compliance anchors are cross-references from technical findings; never run a
   second parallel audit for each regime.
5. Re-verify versions and retrieval dates at the start of an engagement; record
   drift in the profile/report.
