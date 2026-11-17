---
title: "Security probing tooling 2026"
slug: security-probing-tooling-2026
description: "Verified 2026 inventory of non-destructive and intrusive security-testing tools for web, API, desktop/Electron, mobile, MCP/agentic and supply-chain targets, with licenses, maintenance status and safety limits."
tags: [research]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
stack: "DAST/SAST/SCA/reversing tooling across web, API, Electron, mobile, MCP and CI"
feature: "dh-security-auditor agent + dh-security-probe skill"
epic: "Security auditor capability"
status: active
---

# Research: security probing tooling 2026

- **Question:** Which non-destructive security testing tools and frameworks are appropriate in 2026 for authorized enterprise assessments of web applications, APIs, desktop/Electron apps, mobile apps, and agentic/MCP systems, and what are their official URLs, licenses/capabilities, and safety limits?
- **Caller:** `dh-software-architect`, preparing the SDD/plan for the `dh-security-auditor` agent and its `dh-security-probe` skill; the answer feeds the skill's tool matrix and rules of engagement.
- **Date:** 2026-11-17
- **Tools used:** HTTP fetch (Code Mode `fetch`) against primary-source pages; GitHub REST API v3 (repository, license and archival metadata); PyPI JSON API; OSV.dev query API. No `websearch` used.

## Findings

| # | Claim | Source (URL + retrieval date) | Confidence |
|---|---|---|---|
| 1 | OWASP ZAP core is Apache-2.0 and actively maintained (last push 2026-11-16). | https://github.com/zaproxy/zaproxy (2026-11-17) | verified |
| 2 | ZAP's baseline Docker scan runs a spider then **passive** scanning only; the full scan adds an **active scan** — the documented boundary between non-intrusive and intrusive ZAP use. | https://www.zaproxy.org/docs/docker/baseline-scan/ · https://www.zaproxy.org/docs/docker/full-scan/ (2026-11-17) | verified |
| 3 | Burp Suite ships a free **Community Edition** (manual toolkit) plus commercial Professional / DAST editions. | https://portswigger.net/burp · https://portswigger.net/burp/communitydownload (2026-11-17) | verified |
| 4 | Nuclei is MIT-licensed, YAML-template driven, and exposes `-rate-limit` with a default of 150 requests/second and `-rate-limit-duration`. | https://github.com/projectdiscovery/nuclei · https://raw.githubusercontent.com/projectdiscovery/nuclei/dev/README.md (2026-11-17) | verified |
| 5 | ffuf is an MIT-licensed "fast web fuzzer written in Go" — request-flooding by design, so it is intrusive unless scope and rate are constrained. | https://github.com/ffuf/ffuf (2026-11-17) | verified |
| 6 | sqlmap is distributed under the GNU GPL (v2) and exposes `--risk` (1–3) and `--level` (1–5) to scale test invasiveness. | https://github.com/sqlmapproject/sqlmap · https://raw.githubusercontent.com/sqlmapproject/sqlmap/master/LICENSE · https://github.com/sqlmapproject/sqlmap/wiki/Usage (2026-11-17) | verified |
| 7 | httpx (ProjectDiscovery) is MIT-licensed and multi-purpose HTTP probing — read-only request/response inspection. | https://github.com/projectdiscovery/httpx (2026-11-17) | verified |
| 8 | Amass is Apache-2.0, an OWASP flagship project, and defaults to passive intelligence; `-active` explicitly "Enable active recon methods". | https://github.com/owasp-amass/amass · https://raw.githubusercontent.com/owasp-amass/amass/master/doc/user_guide.md (2026-11-17) | verified |
| 9 | testssl.sh is GPL-2.0 and tests TLS/SSL configuration on any port — handshake/cipher probing, no exploitation. | https://github.com/testssl/testssl.sh (2026-11-17) | verified |
| 10 | mitmproxy is an MIT-licensed interactive TLS-capable intercepting proxy — requires client-side CA trust and traffic consent. | https://github.com/mitmproxy/mitmproxy (2026-11-17) | verified |
| 11 | Schemathesis is MIT-licensed, generates tests from OpenAPI/GraphQL/gRPC schemas, and its own README warns it "sends real requests that create, change and delete data. Point it at a dev or staging environment, not production." | https://github.com/schemathesis/schemathesis · https://raw.githubusercontent.com/schemathesis/schemathesis/master/README.md (2026-11-17) | verified |
| 12 | RESTler (Microsoft) is MIT-licensed stateful REST API fuzzing driven by an OpenAPI spec, inferring producer-consumer dependencies. | https://github.com/microsoft/restler-fuzzer · https://raw.githubusercontent.com/microsoft/restler-fuzzer/main/README.md (2026-11-17) | verified |
| 13 | Newman is the Apache-2.0 command-line collection runner for Postman — deterministic, author-defined requests (safe when collections are read-only). | https://github.com/postmanlabs/newman (2026-11-17) | verified |
| 14 | jwt_tool is GPL-3.0; last push 2025-05-01, so treat maintenance as low and pin a commit. | https://github.com/ticarpi/jwt_tool (2026-11-17) | verified |
| 15 | graphql-cop is MIT-licensed and describes itself as a "Security Auditor Utility for GraphQL APIs"; last push 2025-11-20. | https://github.com/dolevf/graphql-cop (2026-11-17) | verified |
| 16 | **Electronegativity is archived**; its README directs users to **ElectroNG**, an Apache-2.0, actively maintained Electron security scanner. | https://github.com/doyensec/electronegativity · https://github.com/doyensec/ElectroNG (2026-11-17) | verified |
| 17 | The official Electron security checklist requires: no Node.js integration for remote content, context isolation, process sandboxing, restrictive CSP, no `webSecurity` disabling, limited navigation/window creation, no `shell.openExternal` on untrusted content, a current Electron version, IPC sender validation. | https://www.electronjs.org/docs/latest/tutorial/security (2026-11-17) | verified |
| 18 | MobSF is GPL-3.0, covers Android/iOS/Windows, offers **static and dynamic** analysis, and exposes REST APIs and CLI for CI/CD. | https://github.com/MobSF/Mobile-Security-Framework-MobSF (2026-11-17) | verified |
| 19 | Frida is distributed under the **wxWindows Library Licence 3.1**; objection (runtime mobile exploration, Frida-based) is GPL-3.0. Both instrument a *running* app — intrusive by nature. | https://github.com/frida/frida · https://raw.githubusercontent.com/frida/frida/main/COPYING · https://github.com/sensepost/objection (2026-11-17) | verified |
| 20 | Ghidra is Apache-2.0; radare2 is LGPLv3 (per its README, per-plugin licenses vary). Both are offline binary analysis — read-only on files. | https://github.com/NationalSecurityAgency/ghidra · https://github.com/radareorg/radare2 · https://raw.githubusercontent.com/radareorg/radare2/master/README.md (2026-11-17) | verified |
| 21 | Wireshark is GPL-2.0. | https://gitlab.com/wireshark/wireshark/-/blob/master/COPYING (2026-11-17) | verified |
| 22 | MCP spec revision **2026-07-28** is the current/latest version, and its Security Best Practices page enumerates: confused deputy, token passthrough, SSRF (including SSRF against authorization servers), state handle hijacking, local MCP server compromise, OAuth authorization URL validation, and stdio-transport proxying risks. | https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices (2026-11-17) | verified |
| 23 | MCP Inspector is an official *developer* tool (`@modelcontextprotocol/inspector`) with web, CLI, TUI and an experimental `mcpdo` connection mode; its licence is transitioning from MIT to Apache-2.0. | https://github.com/modelcontextprotocol/inspector · https://raw.githubusercontent.com/modelcontextprotocol/inspector/main/LICENSE (2026-11-17) | verified |
| 24 | MCP Inspector carries two published advisories: CVE-2025-49596 (no authentication between Inspector client and proxy, GHSA-7f8r-222p-6f5g) and CVE-2025-58444 (potential command execution via XSS when connecting to an untrusted MCP server, GHSA-g9hg-qhmf-q45m). | OSV.dev query for npm `@modelcontextprotocol/inspector` — https://api.osv.dev/v1/query (2026-11-17) | verified |
| 25 | PyPI package `mcp-scan` (v0.4.3) is now a redirect: "This package has been renamed to snyk-agent-scan"; `invariantlabs-ai/mcp-scan` resolves to **snyk/agent-scan** (Apache-2.0), which scans agents, MCP servers and agent skills for prompt injection and vulnerabilities. | https://pypi.org/pypi/mcp-scan/json · https://github.com/snyk/agent-scan (2026-11-17) | verified |
| 26 | `L3G5/mcp-scan` is a stale personal **fork** of that project (fork=true, parent snyk/agent-scan, created and last pushed 2025-04-29, 0 stars) — not an independent tool. | https://api.github.com/repos/L3G5/mcp-scan · https://github.com/L3G5/mcp-scan (2026-11-17) | verified |
| 27 | Cisco `mcp-scanner` is Apache-2.0 (PyPI `cisco-ai-mcp-scanner`, Python 3.11+) and scans MCP servers and tools for potential threats/security findings. | https://github.com/cisco-ai-defense/mcp-scanner (2026-11-17) | verified |
| 28 | promptfoo is MIT-licensed and documents three MCP testing modes: proxy-based red teaming with a legitimate + malicious server, agent-level red teaming, and direct MCP protocol testing (tool-invocation level); it also ships an "MCP Proxy". | https://github.com/promptfoo/promptfoo · https://www.promptfoo.dev/docs/red-team/mcp-security-testing/ (2026-11-17) | verified |
| 29 | osv-scanner is Apache-2.0 and consumes OSV.dev data. | https://github.com/google/osv-scanner (2026-11-17) | verified |
| 30 | Semgrep's OSS engine is LGPL-2.1, with a commercial platform (Pro/AppSec) and rule tiers sold separately. | https://github.com/semgrep/semgrep · https://semgrep.dev/pricing (2026-11-17) | verified |
| 31 | Trivy is Apache-2.0 and covers vulnerabilities, misconfigurations, secrets, SBOMs across containers, Kubernetes, repos and clouds. | https://github.com/aquasecurity/trivy (2026-11-17) | verified |
| 32 | Syft (SBOM generation) and Grype (vulnerability scanning) are both Apache-2.0. | https://github.com/anchore/syft · https://github.com/anchore/grype (2026-11-17) | verified |
| 33 | Gitleaks is MIT; **TruffleHog is AGPL-3.0**, which matters when embedding it in distributed or hosted product code. | https://github.com/gitleaks/gitleaks · https://github.com/trufflesecurity/trufflehog (2026-11-17) | verified |
| 34 | cosign (signing/transparency) and slsa-verifier (provenance verification) are both Apache-2.0; they verify artifacts and do not scan them. | https://github.com/sigstore/cosign · https://github.com/slsa-framework/slsa-verifier (2026-11-17) | verified |
| 35 | OpenSSF Scorecard (repo security-health metrics), Checkov (IaC misconfiguration), and kube-bench (CIS Kubernetes Benchmark checks) are all Apache-2.0. | https://github.com/ossf/scorecard · https://github.com/bridgecrewio/checkov · https://github.com/aquasecurity/kube-bench (2026-11-17) | verified |
| 36 | NIST SP 800-115 is the "Technical Guide to Information Security Testing and Assessment", the standard framing document for scoping, rules of engagement and reporting. | https://csrc.nist.gov/pubs/sp/800/115/final (2026-11-17) | verified |
| 37 | Read-only vs state-changing classification used below (e.g. httpx/testssl.sh/static analysers/SBOM scanners = read-only; sqlmap/ffuf/Nuclei intrusive templates/ZAP active scan/Schemathesis/RESTler/Frida/objection/mitmproxy/Amass `-active` = state-changing) is analyst judgement, except where the tool's own docs state it (rows 2, 6, 8, 11, 17). | derived from rows 2–21 (2026-11-17) | model knowledge |
| 38 | Standard rules-of-engagement safeguards — written authorization, scope allowlist, dedicated test accounts, non-production targets or snapshots/VMs, rate limits, no DoS payloads, no data exfiltration, defined stop conditions, local handling of captured secrets — are professional practice codified by NIST SP 800-115, not statements found verbatim on the tool sites. | https://csrc.nist.gov/pubs/sp/800/115/final (2026-11-17) | model knowledge |

## Implications

- **Two-tier tool matrix is mandatory.** Tier A (default, read-only): ZAP baseline, httpx, testssl.sh, ElectroNG, MobSF *static*, Ghidra/radare2 offline, gitleaks, trufflehog, osv-scanner, syft, grype, trivy, semgrep, checkov, kube-bench, scorecard, cosign/slsa-verifier (verify), Amass passive, jwt_tool decode-only, MCP Inspector (against a local disposable server only). Tier B (explicit opt-in flag): ZAP full/active scan, Nuclei with intrusive templates, ffuf, sqlmap, Schemathesis, RESTler, Burp Scanner/Intruder, MobSF *dynamic*, Frida/objection, mitmproxy, Amass `-active`, promptfoo red-team scenarios.
- **`dh-security-probe` needs a `--read-only` default.** Tier B must require: an authorization reference, a scope allowlist file, a target classified as non-production, an explicit rate limit (Nuclei `-rate-limit`, sqlmap `--risk 1 --level 1`, ffuf `-rate`), and a documented stop condition. Without them the skill should refuse, not warn.
- **Never point probes at third-party or shared production without a snapshot/VM.** Schemathesis's own README ("not production") is the benchmark wording to reuse in the skill.
- **MCP section must be defensive, not offensive.** Prefer static/config scanning (snyk-agent-scan, Cisco mcp-scanner, promptfoo config scans) over live proxying. MCP Inspector must be pinned and run only against a locally hosted disposable server — CVE-2025-49596 and CVE-2025-58444 make it a liability on a privileged workstation.
- **Drop `L3G5/mcp-scan` from the matrix entirely**, and record `mcp-scan` as an alias of `snyk-agent-scan` (via `uvx`, no npm package).
- **Drop Electronegativity as the primary Electron check; use ElectroNG**, keeping the archived repo only as a rule-catalogue reference.
- **Licence gate for the product itself:** TruffleHog (AGPL-3.0), jwt_tool/MobSF/objection (GPL-3.x) and testssl.sh/sqlmap (GPL-2.0) are fine as *externally invoked CLI tools* but cannot be vendored into proprietary distributed code without review; LGPL tools (Semgrep engine, radare2) need the usual dynamic-linking/notice handling.
- **CI-safe subset:** osv-scanner, Semgrep, Trivy, Syft/Grype, Gitleaks, cosign verify, slsa-verifier, Scorecard, Checkov, kube-bench (read-only, no live target traffic) — these belong in preflight/CI, not in the interactive probe skill.
- **Every finding needs evidence and a reproduction command**, since several tools here mutate state; the skill should emit the exact invocation, the rate limit used, and the target classification alongside each finding.

## Sources

- https://github.com/zaproxy/zaproxy (2026-11-17)
- https://www.zaproxy.org/docs/docker/baseline-scan/ (2026-11-17)
- https://www.zaproxy.org/docs/docker/full-scan/ (2026-11-17)
- https://portswigger.net/burp (2026-11-17)
- https://portswigger.net/burp/communitydownload (2026-11-17)
- https://github.com/projectdiscovery/nuclei (2026-11-17)
- https://raw.githubusercontent.com/projectdiscovery/nuclei/dev/README.md (2026-11-17)
- https://github.com/ffuf/ffuf (2026-11-17)
- https://github.com/sqlmapproject/sqlmap (2026-11-17)
- https://raw.githubusercontent.com/sqlmapproject/sqlmap/master/LICENSE (2026-11-17)
- https://github.com/sqlmapproject/sqlmap/wiki/Usage (2026-11-17)
- https://github.com/projectdiscovery/httpx (2026-11-17)
- https://github.com/owasp-amass/amass (2026-11-17)
- https://raw.githubusercontent.com/owasp-amass/amass/master/doc/user_guide.md (2026-11-17)
- https://github.com/testssl/testssl.sh (2026-11-17)
- https://github.com/mitmproxy/mitmproxy (2026-11-17)
- https://github.com/schemathesis/schemathesis (2026-11-17)
- https://raw.githubusercontent.com/schemathesis/schemathesis/master/README.md (2026-11-17)
- https://github.com/microsoft/restler-fuzzer (2026-11-17)
- https://raw.githubusercontent.com/microsoft/restler-fuzzer/main/README.md (2026-11-17)
- https://github.com/postmanlabs/newman (2026-11-17)
- https://github.com/ticarpi/jwt_tool (2026-11-17)
- https://github.com/dolevf/graphql-cop (2026-11-17)
- https://github.com/doyensec/electronegativity (2026-11-17)
- https://github.com/doyensec/ElectroNG (2026-11-17)
- https://www.electronjs.org/docs/latest/tutorial/security (2026-11-17)
- https://github.com/MobSF/Mobile-Security-Framework-MobSF (2026-11-17)
- https://github.com/frida/frida (2026-11-17)
- https://raw.githubusercontent.com/frida/frida/main/COPYING (2026-11-17)
- https://github.com/sensepost/objection (2026-11-17)
- https://github.com/NationalSecurityAgency/ghidra (2026-11-17)
- https://github.com/radareorg/radare2 (2026-11-17)
- https://raw.githubusercontent.com/radareorg/radare2/master/README.md (2026-11-17)
- https://gitlab.com/wireshark/wireshark/-/blob/master/COPYING (2026-11-17)
- https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices (2026-11-17)
- https://github.com/modelcontextprotocol/inspector (2026-11-17)
- https://raw.githubusercontent.com/modelcontextprotocol/inspector/main/LICENSE (2026-11-17)
- https://api.osv.dev/v1/query (npm `@modelcontextprotocol/inspector`) (2026-11-17)
- https://pypi.org/pypi/mcp-scan/json (2026-11-17)
- https://github.com/snyk/agent-scan (2026-11-17)
- https://github.com/L3G5/mcp-scan (2026-11-17)
- https://github.com/cisco-ai-defense/mcp-scanner (2026-11-17)
- https://github.com/promptfoo/promptfoo (2026-11-17)
- https://www.promptfoo.dev/docs/red-team/mcp-security-testing/ (2026-11-17)
- https://github.com/google/osv-scanner (2026-11-17)
- https://github.com/semgrep/semgrep (2026-11-17)
- https://semgrep.dev/pricing (2026-11-17)
- https://github.com/aquasecurity/trivy (2026-11-17)
- https://github.com/anchore/syft (2026-11-17)
- https://github.com/anchore/grype (2026-11-17)
- https://github.com/gitleaks/gitleaks (2026-11-17)
- https://github.com/trufflesecurity/trufflehog (2026-11-17)
- https://github.com/sigstore/cosign (2026-11-17)
- https://github.com/slsa-framework/slsa-verifier (2026-11-17)
- https://github.com/ossf/scorecard (2026-11-17)
- https://github.com/bridgecrewio/checkov (2026-11-17)
- https://github.com/aquasecurity/kube-bench (2026-11-17)
- https://csrc.nist.gov/pubs/sp/800/115/final (2026-11-17)

## Confidence

**partially verified.** Tool identities, official URLs, licenses (SPDX), archival/rename status, documented scan modes, documented flags (`-rate-limit`, `--risk`, `--level`, `-active`) and the two MCP Inspector advisories were all verified against primary sources on 2026-11-17. Two claim classes remain analyst judgement rather than sourced fact, and are labelled `model knowledge` in the table: (a) the read-only vs state-changing classification (rows 37), and (b) the generic rules-of-engagement safeguards (row 38). No source conflict was found; where the brief's premises were wrong (`L3G5/mcp-scan` as a project, Electronegativity as current), the verified position is stated in rows 16, 25 and 26. Capability depth of Nuclei templates and Burp Scanner was not benchmarked — only their documented nature is asserted.
