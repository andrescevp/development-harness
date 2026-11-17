---
title: "Security Profile — dev-harness-skills"
slug: security-profile
description: "Project security surfaces, data classification, assurance target and standards selection for the dev-harness-skills plugin."
tags: [security, profile]
project: "dev-harness-skills"
stack: "TypeScript plugin, MCP server, TUI, Markdown agents/skills"
created: 2026-11-17
updated: 2026-11-17
status: active
reviewed: 2026-11-17
---

# Security Profile

| Surface | Detected | Selected standards | Notes |
|---|---|---|---|
| Web | no | — | No web frontend served by this repo; documentation is static. |
| API / MCP | yes | ASVS 5.0.0 (input/validation controls), MCP 2026-07-28, CWE Top 25 2025 | Local stdio MCP server with 12 tools; no remote API. |
| Desktop | no | — | TUI is a terminal client, not a packaged desktop app. |
| Mobile | no | — | Not applicable. |
| Agentic/MCP | yes | Agentic Top 10 2026, LLM Top 10 2025, MCP security/authorization 2026-07-28, AIVSS preview | Agents, skills, subagent delegation and tool-use surfaces. |
| Supply chain / CI | yes | NIST SSDF, SLSA 1.2, OSV, Semgrep, Trivy, Gitleaks | pnpm lockfile, GitHub Actions, published package/installer. |
| Compliance | none | — | No customer production data, card data, PHI or regulated scope declared. |

- **Data classification:** internal / developer tooling; no production customer
  data.
- **Assurance target:** internal engineering baseline; ASVS L1-equivalent for
  local input/tool handlers, full MCP/agentic controls for the delegation
  surface.
- **Compliance scope:** none; compliance anchors are not certification.
- **Test environment:** local repository and temporary directories only.
- **Authorized tools:** static/read-only scanners installed in the dev
  environment (OSV, Semgrep, Trivy, Biome, TypeScript, tests); no active
  network probing.
- **Exclusions:** web/mobile/desktop production testing, third-party systems,
  destructive or state-changing probes, penetration testing.
- **Review interval:** on stack/CI/agent-surface change or every 90 days.

## Notes

This profile is intentionally narrow. It does not claim ASVS/PCI/SOC 2/ISO
coverage. `dh-security-audit` must report any requested surface not selected
here as out of scope or require a profile update.
