# Threat Catalog

Use this catalog as a prompt, not a checklist. Each row must be instantiated
with the system's asset, boundary and abuse path.

## STRIDE

| Letter | Threat | Question |
|---|---|---|
| S | Spoofing | Can an actor claim another identity? |
| T | Tampering | Can data/code/config be changed without detection? |
| R | Repudiation | Can an action be denied without evidence? |
| I | Information disclosure | Can data leak to an unauthorized party? |
| D | Denial of service | Can availability be exhausted? |
| E | Elevation of privilege | Can an actor gain unauthorized capability? |

## LINDDUN (privacy)

Linking, Identifying, Non-repudiation, Detecting, Data disclosure,
Unawareness, Non-compliance. Apply where personal data is processed.

## OWASP Agentic Top 10 2026 (ASI01–ASI10)

| ID | Risk | Typical abuse path | Control/test idea |
|---|---|---|---|
| ASI01 | Agent Goal Hijack | prompt injection in content/tool output changes objective | instruction/data separation, goal allowlist, adversarial prompt tests |
| ASI02 | Tool Misuse and Exploitation | agent calls a tool with unsafe args or over-broad scope | least-privilege tools, schema/arg validation, dry-run/approval |
| ASI03 | Identity and Privilege Abuse | inherited human/service credentials; no per-agent identity | workload identity, short-lived scoped tokens, separation of duties |
| ASI04 | Agentic Supply Chain Vulnerabilities | poisoned model/tool/MCP package or prompt | provenance, pinning, signature/SBOM, review of MCP servers/tools |
| ASI05 | Unexpected Code Execution | generated code/command executed with host privileges | sandbox, no shell by default, allowlisted interpreters, resource limits |
| ASI06 | Memory and Context Poisoning | attacker writes malicious long-term/vector memory | memory provenance, tenant isolation, write validation, retrieval filters |
| ASI07 | Insecure Inter-Agent Communication | spoofed/tampered agent messages | authenticated channels, message integrity, capability tokens |
| ASI08 | Cascading Failures | one failed agent/tool propagates and amplifies | circuit breakers, budgets, bulkheads, bounded retries |
| ASI09 | Human-Agent Trust Exploitation | user over-trusts a confident agent recommendation | uncertainty display, approval gates, provenance, safety copy |
| ASI10 | Rogue Agents | compromised agent acts outside policy | kill switch, behavior monitoring, scoped credentials, containment |

## MCP attack classes (2026-07-28)

| Attack | What to model/test |
|---|---|
| Confused deputy | proxy uses a static client ID/consent cookie so a malicious client obtains codes without consent |
| Token passthrough | MCP server forwards a token to an upstream API without audience/scope validation |
| SSRF | MCP server fetches attacker-controlled URLs, including authorization metadata |
| State handle hijacking | leaked state/session handles let another client resume or tamper |
| Local MCP server compromise | local stdio server is a supply-chain/execution boundary |
| OAuth authorization URL validation | open redirect/malicious authorization endpoint |
| stdio transport in proxy scenarios | proxy mixes local stdio with remote auth assumptions |
| Mix-up attack | client confuses tokens/endpoints across authorization servers |
| Localhost redirect URI impersonation | malicious local app captures the redirect |
| CIMD trust policies | untrusted client metadata is accepted as identity |
| Scope minimization | over-broad scopes/tokens grant unrelated capabilities |

## OWASP LLM Top 10 2025

LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply
Chain, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06
Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding
Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption.

## Threat statement format

```markdown
### T-01 — <threat>

- **Asset:** <data/service/capability>
- **Boundary:** <trust boundary crossed>
- **Actor/path:** <who does what>
- **Existing control:** <present / partial / missing>
- **Impact:** <C/I/A/safety/business>
- **Test idea:** <audit control or probe>
- **Owner:** <team>
```
