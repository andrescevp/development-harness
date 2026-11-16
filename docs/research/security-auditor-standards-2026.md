---
title: "Security auditor standards for web, API, desktop, mobile and agentic/MCP systems (November 2026)"
slug: security-auditor-standards-2026
description: "Version-pinned inventory of the authoritative standards, frameworks and testing guides that should define an enterprise security auditor across web, API, desktop, mobile and agentic/MCP targets."
tags: [research]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
stack: "OWASP, NIST, IETF, ISO/IEC, PCI SSC, AICPA, SLSA, MCP, FIRST, MITRE"
feature: "dh-security-auditor / dh-security-audit / dh-threat-model / dh-security-probe"
epic: "enterprise security auditor"
status: active
---

# Research: security-auditor-standards-2026

- **Question:** Which authoritative standards, frameworks, and testing guides should define an enterprise security auditor for web applications, APIs, desktop apps, mobile apps, and agentic/MCP systems as of November 2026, and what are their exact current versions, primary URLs, and key control domains?
- **Caller:** dh-software-architect (SDD + plan for `dh-security-auditor`, `dh-security-audit`, `dh-threat-model`, `dh-security-probe`)
- **Date:** 2026-11-17
- **Tools used:** webfetch, websearch (host tools; no search MCP)

## Findings

| # | Claim | Source (URL + retrieval date) | Confidence |
|---|---|---|---|
| 1 | **OWASP ASVS 5.0.0** is the latest stable release, published **30 May 2025**; it is the requirement framework for web applications and web services, with three assurance levels and 17 chapters (V1 Encoding & Sanitization, V2 Validation & Business Logic, V3 Web Frontend Security, V4 API & Web Service, V5 File Handling, V6 Authentication, V7 Session Management, V8 Authorization, V9 Self-contained Tokens, V10 OAuth & OIDC, V11 Cryptography, V12 Secure Communication, V13 Configuration, V14 Data Protection, V15 Secure Coding & Architecture, V16 Security Logging & Error Handling, V17 WebRTC) | https://owasp.org/www-project-application-security-verification-standard/ (2026-11-17); chapter list https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en (2026-11-17) | verified |
| 2 | **OWASP Top 10:2025** is the current web release (8th edition): A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions. SSRF is folded into A01; A03 replaces "Vulnerable and Outdated Components" | https://owasp.org/Top10/2025/0x00_2025-Introduction/ (2026-11-17) | verified |
| 3 | **OWASP API Security Top 10 2023** remains the current edition (API1 BOLA, API2 Broken Authentication, API3 Broken Object Property Level Authorization, API4 Unrestricted Resource Consumption, API5 BFLA, API6 Unrestricted Access to Sensitive Business Flows, API7 SSRF, API8 Security Misconfiguration, API9 Improper Inventory Management, API10 Unsafe Consumption of APIs); OWASP lists no 2025/2026 API edition | https://owasp.org/www-project-api-security/ (2026-11-17) | verified |
| 4 | **OWASP WSTG v4.2** is the latest stable release; **v5.0 is in development and unreleased** — v5 content must not be cited as stable | https://owasp.org/www-project-web-security-testing-guide/ (2026-11-17) | verified |
| 5 | **OWASP MASVS v2.1.0** (published **2024-01-18**) is the latest tag; 8 control categories: MASVS-STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE, PRIVACY (PRIVACY added in 2.1.0); also shipped as CycloneDX | https://github.com/OWASP/masvs/releases/tag/v2.1.0 (2026-11-17); https://mas.owasp.org/MASVS/ (2026-11-17) | verified |
| 6 | **OWASP MASTG v2.0.0** (published **2026-06-30**) is the first stable v2 release: modular `MASTG-TEST-*`/`TECH-*`/`TOOL-*`/`DEMO-*`/`KNOW-*`/`BEST-*` IDs, 193 tests, 152 demos, 135 tools, ~860 components; v1 tests are deprecated and unmaintained | https://github.com/OWASP/mastg/releases/tag/v2.0.0 (2026-11-17) | verified |
| 7 | **OWASP Desktop App Security Top 10 (2021)** exists but is an **incubator** project with 10 risks DA1–DA10 (Injections; Broken Auth & Session Mgmt; Sensitive Data Exposure; Improper Cryptography; Improper Authorization; Security Misconfiguration; Insecure Communication; Poor Code Quality; Vulnerable Components; Insufficient Logging & Monitoring) | https://owasp.org/www-project-desktop-app-security-top-10/ (2026-11-17) | verified |
| 8 | **Electron security checklist** documents **17 mandatory recommendations** (secure content only; no Node integration for remote content; context isolation; sandboxing; permission request handler; do not disable `webSecurity`; CSP; no `allowRunningInsecureContent`; no experimental features; no `enableBlinkFeatures`; no `allowpopups`; verify webview options; limit navigation; limit new windows; avoid `shell.openExternal` on untrusted content; current Electron version; validate IPC `sender`) | https://www.electronjs.org/docs/latest/tutorial/security (2026-11-17) | verified |
| 9 | **OWASP SAMM 2.2.0** (released **2026-07-06**) is the latest; 5 business functions (Governance, Design, Implementation, Verification, Operations) and 15 security practices | https://github.com/owaspsamm/core/releases/tag/v2.2.0 (2026-11-17); https://owasp.org/www-project-samm/ (2026-11-17); https://owaspsamm.org/model/ (2026-11-17) | verified |
| 10 | **NIST CSF 2.0 = CSWP 29**, published **2024-02-26**; expanded scope beyond critical infrastructure and adds an explicit **GOVERN** focus alongside the existing functions | https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final (2026-11-17) | verified |
| 11 | **NIST SSDF SP 800-218 v1.1**, published **February 2022** (supersedes CSWP 13) — practice groups PO, PS, PW, RV | https://csrc.nist.gov/pubs/sp/800/218/final (2026-11-17) | verified |
| 12 | **NIST SP 800-218A**, published **July 2024** — SSDF Community Profile for generative AI and dual-use foundation models (AI model producers, AI system producers, acquirers) | https://csrc.nist.gov/pubs/sp/800/218/a/final (2026-11-17) | verified |
| 13 | **NIST SP 800-115**, published **September 2008** (supersedes SP 800-42) — technical guide to information security testing and assessment (planning, execution, post-execution analysis) | https://csrc.nist.gov/pubs/sp/800/115/final (2026-11-17) | verified |
| 14 | **PTES v1.0** is the current version — 7 phases (Pre-engagement Interactions, Intelligence Gathering, Threat Modeling, Vulnerability Analysis, Exploitation, Post Exploitation, Reporting), plus separate Technical Guidelines; the site announces a v2.0 that was never published and the wiki is effectively frozen | http://www.pentest-standard.org/index.php/Main_Page (2026-11-17); freeze evidence (secondary) https://dm11.com.br/en/standards/ptes (2026-11-17) | verified (version/7 phases); partially verified (staleness) |
| 15 | **CVSS v4.0**, released **2023-11-01**; current specification document v1.2 (**2024-06-18**); metric groups Base, Threat, Environmental, Supplemental; nomenclature CVSS-B / CVSS-BT / CVSS-BE / CVSS-BTE; Scope retired, Attack Requirements and Safety metrics added; FAQ v1.10 (2026-07-17) includes an AIVSS↔CVSS entry | https://www.first.org/cvss/specification-document (2026-11-17); https://www.first.org/cvss/v4-0/ (2026-11-17) | verified |
| 16 | **CWE Top 25 (2025)** is the current edition (page last updated **2025-12-15**); top five: CWE-79 XSS, CWE-89 SQLi, CWE-352 CSRF, CWE-862 Missing Authorization, CWE-787 Out-of-bounds Write | https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html (2026-11-17) | verified |
| 17 | **SLSA v1.2 is current**, released **2025-11-24**, adding a Source Track and retaining the Build Track; **v1.1 is marked Retired** on slsa.dev | https://slsa.dev/spec/v1.2/ (2026-11-17); https://slsa.dev/spec/v1.1/ (2026-11-17); https://slsa.dev/blog/2025/11/announce-slsa-v1.2 (2026-11-17) | verified |
| 18 | **OWASP Top 10 for Agentic Applications 2026** published **2025-12-09**, Version 2026: ASI01 Agent Goal Hijack, ASI02 Tool Misuse and Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution (RCE), ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ (2026-11-17); PDF https://genai.owasp.org/download/52117/ (2026-11-17) | verified |
| 19 | **OWASP Top 10 for LLM Applications 2025** is the current LLM edition: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption | https://genai.owasp.org/llm-top-10/ (2026-11-17) | verified |
| 20 | **OWASP AIVSS** is at **v0.8** ("AIVSS Scoring System For OWASP Agentic AI Core Security Risks"); an "AIVSS 1.0 calculator" is live but the framework package is still on a multi-year roadmap — not a stable, certifiable standard | https://aivss.owasp.org/ (2026-11-17) | verified |
| 21 | **MCP specification 2026-07-28** is the current revision (`/specification/latest` serves it) | https://modelcontextprotocol.io/specification/latest (2026-11-17) | verified |
| 22 | **MCP Security Best Practices (2026-07-28)** covers 11 attack/control classes: Confused Deputy Problem, Token Passthrough, Server-Side Request Forgery (SSRF), State Handle Hijacking, Local MCP Server Compromise, OAuth Authorization URL Validation, stdio Transport Security in Proxy Scenarios, Mix-Up Attacks, Localhost Redirect URI Impersonation, CIMD Trust Policies, Scope Minimization; Dynamic Client Registration is deprecated as of this version | https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices (2026-11-17) | verified |
| 23 | **MCP Authorization (2026-07-28)** is a selected subset of **OAuth 2.1 draft-ietf-oauth-v2-1-13** plus RFC 6750, 8414, 8707, 9728, 9207, OIDC Discovery, and Client ID Metadata Documents; DCR (RFC 7591) retained but deprecated; MCP servers MUST implement Protected Resource Metadata | https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization (2026-11-17) | verified |
| 24 | **RFC 9700 "Best Current Practice for OAuth 2.0 Security"**, **January 2025**, BCP 240; updates RFC 6749, 6750, 6819 | https://www.rfc-editor.org/rfc/rfc9700.html (2026-11-17) | verified |
| 25 | **RFC 8725 "JSON Web Token Best Current Practices"**, **February 2020**, BCP 225; updates RFC 7519 | https://www.rfc-editor.org/rfc/rfc8725.html (2026-11-17) | verified |
| 26 | **ISO/IEC 27001:2022**, Edition 3, dated **2022-10** — ISMS requirements with the Annex A control set | https://www.iso.org/standard/27001 (2026-11-17) | verified |
| 27 | **PCI DSS v4.0.1** published **2024-06-11** (limited revision, no new/deleted requirements); v4.0 retired **2024-12-31**; the 51 future-dated requirements became effective **2025-03-31** | https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1 (2026-11-17); https://www.pcisecuritystandards.org/about_us/press_releases/pci-security-standards-council-hosts-2024-europe-community-meeting/ (2026-11-17) | verified |
| 28 | **SOC 2** current criteria are the **2017 Trust Services Criteria with Revised Points of Focus – 2022**; five categories (Security, Availability, Processing Integrity, Confidentiality, Privacy) with only Security mandatory; AICPA issued an **exposure draft of proposed 2027 TSC** (not effective) | https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022 (2026-11-17); https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2 (2026-11-17) | verified |
| 29 | **CIS Benchmarks** are "100+ vendor-neutral configuration guides" with a community development process and CIS-CAT Pro assessment tooling | https://www.cisecurity.org/cis-benchmarks (2026-11-17) | verified |
| 30 | **OWASP Code Review Guide v2.0** is dated **July 2017** and is a **Lab** project using OWASP Top 10 2013 as its vulnerability taxonomy — usable as pedagogical guidance, not as a current control catalogue | https://github.com/OWASP/www-project-code-review-guide/blob/master/info.md (2026-11-17) | verified |
| 31 | **OWASP Cheat Sheet Series** is a living, continuously updated corpus (includes an **AI Agent Security** cheat sheet and indexes by ASVS/MASVS/Top 10); **OWASP Threat Dragon** is a production project supporting STRIDE, LINDDUN, CIA, DIE and PLOT4ai, runnable as web or desktop app | https://cheatsheetseries.owasp.org/ (2026-11-17); https://owasp.org/www-project-threat-dragon/ (2026-11-17) | verified |

## Standards matrix

| Target type | Primary normative standards (pin these) | Procedure / test guides | Control domains the auditor must cover |
|---|---|---|---|
| **Web application** | OWASP ASVS 5.0.0; OWASP Top 10:2025 | OWASP WSTG v4.2; OWASP Cheat Sheet Series | Access control, misconfiguration, supply chain, crypto, injection, secure design, authentication, integrity, logging/alerting, exception handling (V1–V17 of ASVS) |
| **API / web service** | OWASP ASVS 5.0.0 ch. V4 + V8/V9/V10; OWASP API Security Top 10 2023; RFC 9700; RFC 8725 | WSTG v4.2 API/authorization tests; ASVS-derived API checks | Object-level (BOLA) and function-level (BFLA) authorization, property-level authorization, resource consumption, business-flow abuse, SSRF, inventory/versioning, third-party API consumption, token/OAuth/JWT handling |
| **Desktop app** | OWASP Desktop App Security Top 10 (2021); Electron 17-point security checklist; CIS Benchmarks (host/OS) | No authoritative OWASP desktop testing guide exists — derive from WSTG + ASVS V1/V4/V5/V13/V14 and platform hardening guides | DA1–DA10: injection, auth/session, local data exposure, crypto misuse, local authorization, configuration/registry/permissions, transport security, binary/code quality, component CVEs, logging |
| **Mobile app** | OWASP MASVS v2.1.0 (+ MAS Profiles L1/L2/R) | OWASP MASTG v2.0.0 (atomic `MASTG-TEST-*` + `MASTG-TECH-*`); MASWE weakness catalogue | STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE, PRIVACY |
| **Agentic / MCP system** | OWASP Top 10 for Agentic Applications 2026 (ASI01–ASI10); OWASP LLM Top 10 2025; MCP spec 2026-07-28 (Security Best Practices + Authorization); RFC 9700; RFC 8725; OWASP AI Agent Security Cheat Sheet | Agentic Top 10 per-ASI mitigations; MCP attack-class tests (confused deputy, token passthrough, SSRF, state-handle hijacking, local server compromise, mix-up, localhost redirect impersonation); LLM evals/red-team | Goal/tool/identity integrity, agentic supply chain, code execution, memory & context integrity, inter-agent comms, cascading failure containment, human-agent trust, rogue-agent containment, authorization/consent, scope minimization, secrets & token handling |
| **Program & governance (cross-cutting)** | NIST CSF 2.0 (CSWP 29); NIST SSDF SP 800-218 v1.1; SP 800-218A (AI); OWASP SAMM 2.2.0 | NIST SP 800-115 (assessment technique classes); PTES v1.0 (engagement phases) | Governance, risk identification, protective controls, detection, response, recovery; SSDF PO/PS/PW/RV; SAMM 15 practices; engagement scoping, rules of engagement, reporting |
| **Supply chain & severity (cross-cutting)** | SLSA v1.2 (Build + Source tracks); CWE Top 25 2025; CVSS v4.0 | SLSA provenance verification guidance; CWE mapping | Source integrity, build provenance, dependency/components, weakness classification, severity scoring (CVSS-B/BT/BE/BTE) |
| **Compliance anchors** | ISO/IEC 27001:2022; PCI DSS 4.0.1; AICPA 2017 TSC (2022 points of focus); CIS Benchmarks | Audit/assessment procedures per scheme | ISMS Annex A controls; cardholder-data requirements (incl. the 51 future-dated reqs live since 2025-03-31); SOC 2 common criteria + optional categories; OS/DB/cloud hardening baselines |

## Implications

- **Pin versions in one registry, not in prose.** `dh-security-auditor` should own a machine-readable `standards.lock` (id, version, publication date, URL, retrieval date, authority tier) and refuse to emit a finding that cites a standard not present in it. This research note is the seed for that file.
- **Three authority tiers, enforced.** Tier 1 normative (ASVS 5.0.0, MASVS 2.1.0, MCP 2026-07-28, RFC 9700/8725, ISO 27001:2022, PCI DSS 4.0.1); Tier 2 consensus awareness (Top 10:2025, API Top 10 2023, LLM Top 10 2025, Agentic Top 10 2026, CWE Top 25); Tier 3 draft/incubator (AIVSS v0.8, Desktop App Security Top 10, Code Review Guide v2.0). Never gate a release or a "fail" verdict on Tier 3.
- **Correct four stale premises in the SDD.** SLSA **v1.2**, not v1.1 (v1.1 Retired); WSTG **v4.2**, not v5; API Top 10 **2023**, not 2026; SOC 2 **2017 TSC (2022 points of focus)**, not the 2027 exposure draft. Stating v1.1/v5/2026 in the plan would make the auditor ship outdated citations on day one.
- **`dh-security-audit` should be target-class dispatched.** Detect target type → load the matrix row → load only that row's requirement IDs + test IDs. This keeps the skill under its file/line budget and prevents web checks leaking into mobile or agentic audits.
- **Requirement-ID granularity is the differentiator.** Findings should carry `ASVS V8.2.1`-style IDs, `WSTG-*` test IDs, `API1:2023`, `MASVS-AUTH-1` / `MASTG-TEST-*`, `ASI0x`, `LLM0x`, `CWE-*`, and MCP section anchors. Free-text findings cannot be re-verified or regression-tested.
- **Machine-readable ASVS is available.** ASVS 5.0.0 ships CSV/JSON/CycloneDX from the `v5.0.0` tag, so the auditor can validate requirement IDs offline instead of hallucinating chapter numbers.
- **Mobile must be MASTG-driven.** MASVS 2.1.0 gives "what"; only MASTG v2.0.0 gives "how" with stable `MASTG-TEST-*` IDs and runnable demos. Treat MASTG v1 tests as deprecated and never cite them.
- **Desktop is the known coverage gap.** There is no authoritative OWASP desktop testing guide; the Desktop Top 10 is a 2021 incubator list and the Electron checklist is vendor guidance. The skill should declare a documented gap and compose coverage from ASVS (adapted) + Electron 17 points + CIS Benchmarks, rather than claiming a standard it does not have.
- **Agentic/MCP needs three documents together.** Agentic Top 10 2026 (risk taxonomy), LLM Top 10 2025 (model-layer risks), and MCP 2026-07-28 (protocol attack classes + OAuth 2.1 authorization profile). Using only one leaves either the model layer, the tool layer, or the authorization layer uncovered.
- **Score with CVSS v4.0, not AIVSS.** CVSS v4.0 is stable and tool-supported; AIVSS v0.8 is draft. The auditor may report an AIVSS-style preview for agentic findings but must label it non-normative and keep CVSS-BTE as the scoring record.
- **`dh-threat-model` should be tool-compatible.** Threat Dragon's model formats and its STRIDE/LINDDUN/CIA/DIE/PLOT4ai support make it the export target; map agentic threats onto ASI IDs inside the same model so threat modeling and audit findings share one taxonomy.
- **`dh-security-probe` needs a hard non-exploitation boundary.** PTES includes an Exploitation/Post-Exploitation phase and SP 800-115 includes penetration testing; a read-only probe skill must default to PTES phases 1–4 and SP 800-115 assessment (not penetration) techniques, with explicit opt-in for anything state-changing.
- **Compliance output is a mapping layer, not a second audit.** ISO 27001:2022 Annex A, PCI DSS 4.0.1 requirements, SOC 2 common criteria and CIS Benchmark IDs should be emitted as cross-references from technical findings — one finding, many anchors — so the auditor never runs four parallel audits.
- **Currency check is a first-class step.** Each run should re-verify the registry's `retrieved` dates and flag drift (e.g., SLSA v1.2 → next, WSTG v5.0 release, Agentic Top 10 2027, SOC 2 2027 finalization).

## Sources

- https://owasp.org/www-project-application-security-verification-standard/ (2026-11-17)
- https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en (2026-11-17)
- https://owasp.org/Top10/2025/0x00_2025-Introduction/ (2026-11-17)
- https://owasp.org/www-project-api-security/ (2026-11-17)
- https://owasp.org/www-project-web-security-testing-guide/ (2026-11-17)
- https://mas.owasp.org/MASVS/ (2026-11-17)
- https://github.com/OWASP/masvs/releases/tag/v2.1.0 (2026-11-17)
- https://github.com/OWASP/mastg/releases/tag/v2.0.0 (2026-11-17)
- https://owasp.org/www-project-desktop-app-security-top-10/ (2026-11-17)
- https://www.electronjs.org/docs/latest/tutorial/security (2026-11-17)
- https://owasp.org/www-project-samm/ (2026-11-17)
- https://owaspsamm.org/model/ (2026-11-17)
- https://github.com/owaspsamm/core/releases/tag/v2.2.0 (2026-11-17)
- https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final (2026-11-17)
- https://csrc.nist.gov/pubs/sp/800/218/final (2026-11-17)
- https://csrc.nist.gov/pubs/sp/800/218/a/final (2026-11-17)
- https://csrc.nist.gov/pubs/sp/800/115/final (2026-11-17)
- http://www.pentest-standard.org/index.php/Main_Page (2026-11-17)
- https://www.first.org/cvss/specification-document (2026-11-17)
- https://www.first.org/cvss/v4-0/ (2026-11-17)
- https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html (2026-11-17)
- https://slsa.dev/spec/v1.2/ (2026-11-17)
- https://slsa.dev/spec/v1.1/ (2026-11-17)
- https://slsa.dev/blog/2025/11/announce-slsa-v1.2 (2026-11-17)
- https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ (2026-11-17)
- https://genai.owasp.org/download/52117/ (2026-11-17)
- https://genai.owasp.org/llm-top-10/ (2026-11-17)
- https://aivss.owasp.org/ (2026-11-17)
- https://modelcontextprotocol.io/specification/latest (2026-11-17)
- https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices (2026-11-17)
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization (2026-11-17)
- https://www.rfc-editor.org/rfc/rfc9700.html (2026-11-17)
- https://www.rfc-editor.org/rfc/rfc8725.html (2026-11-17)
- https://www.iso.org/standard/27001 (2026-11-17)
- https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1 (2026-11-17)
- https://www.pcisecuritystandards.org/about_us/press_releases/pci-security-standards-council-hosts-2024-europe-community-meeting/ (2026-11-17)
- https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022 (2026-11-17)
- https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2 (2026-11-17)
- https://www.cisecurity.org/cis-benchmarks (2026-11-17)
- https://github.com/OWASP/www-project-code-review-guide/blob/master/info.md (2026-11-17)
- https://cheatsheetseries.owasp.org/ (2026-11-17)
- https://owasp.org/www-project-threat-dragon/ (2026-11-17)

## Confidence

**verified** — 29 of 31 findings rest on a primary source read directly (OWASP project sites, GitHub release tags, NIST CSRC, IETF RFCs, FIRST, MITRE, SLSA, MCP specification, ISO, PCI SSC, AICPA, CIS). Two findings are qualified: PTES staleness is `partially verified` (the v1.0/7-phase claim is primary; the "frozen since ~2015" claim rests on a secondary source), and the desktop-target row records a **documented absence** of an authoritative testing guide rather than a standard. Known unresolved items for a later pass (out of this question's scope): no verified publication date for WSTG v4.2; no verified OWASP position on a future API Top 10 edition; AIVSS has no stable 1.0; SOC 2 2027 criteria are an exposure draft only.
