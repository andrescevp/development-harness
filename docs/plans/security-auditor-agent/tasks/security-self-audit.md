---
title: "Security Self-Audit — dev-harness-skills"
slug: security-self-audit
description: "Read-only static audit and agentic/MCP threat review of the plugin, using the new security workflow."
tags: [security, audit, self-audit]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
status: completed
---

# Security Self-Audit — dev-harness-skills

- **Engagement:** `dev-harness-skills` self-audit, read-only
- **Authorization:** repository owner; no network probing
- **Profile:** `docs/security/security-profile.md`
- **Selection:** `docs/security/standards.selection.md`
- **Method:** `dh-security-audit` + `dh-threat-model` (static review; no active
  probing)
- **Date:** 2026-11-17

## Scope

In scope: MCP server tools (`src/mcp/`, `src/tools/`), TUI read path
(`src/tui/`), plugin asset loading/registration, CI/package pipeline.
Out of scope: third-party systems, active network tests, production data,
mobile/web/desktop targets (not present).

## Coverage

| Area | Method | Result |
|---|---|---|
| MCP tool input/path handling | static review of `plan-paths`, `plan-io`, schemas | no finding |
| Plan/scaffold content injection | static + tests | no finding (YAML quoted, single-line fields, round-trip) |
| TUI plan-file modal | static review of traversal/limits | no finding (symlinks skipped, 200-node/1 MB caps) |
| Asset loading/registration | static review | no finding (frontmatter-only, no code execution) |
| Agentic command execution | threat model + static review | **SEC-001 (P2)** |
| Probe gate negative cases | `probe-negative-tests.md` dry-run | PASS (5/5 stop as expected) |
| Supply chain/CI | read-only policy review | no finding in this pass; OSV/Semgrep/Trivy remain the gate |

## Findings

### SEC-001 — MCP `dh_logged_command` exposes unrestricted shell execution to any local client

- **Severity:** P2 · CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N
  (local trusted-client assumption; adjust if the MCP server is exposed beyond
  the developer account)
- **CWE:** CWE-78 (OS command injection by design), CWE-250 (execution with
  unnecessary privileges)
- **Controls:** MCP local-server trust boundary; ASVS V1/V13 input/config;
  Agentic ASI02 (tool misuse), ASI03 (identity/privilege), ASI05 (unexpected
  code execution)
- **Affected:** `src/tools/logged-command.ts`; `dh_logged_command` tool
- **Evidence:** `runLoggedCommand` executes the caller-provided `command`
  string through `node:child_process.exec` with the MCP server's OS user and no
  confirmation or allowlist. The design is intentional for the harness command
  strategy, but the trust boundary is the local OpenCode/MCP client.
- **Reproduction:** call `dh_logged_command` with any shell command from a
  connected client; the command runs as the server user.
- **Impact:** a compromised/malicious MCP client or prompt-injected agent with
  tool access can run arbitrary commands as the developer. Local-only stdio
  reduces exposure but does not remove it.
- **Remediation:** document the trust boundary; run OpenCode with a
  least-privilege account; add a confirmation/allowlist policy for destructive
  commands; keep logs local and redacted; consider a read-only mode for
  untrusted sessions. Re-test after a policy change.
- **Re-test:** not run (design/trust-boundary finding; requires a policy
  change).

## Threat model summary

Full sample model: [`threat-model.md`](./threat-model.md).

- Assets: workspace files, plan status, local shell, developer credentials
  reachable by the server user.
- Boundaries: MCP client ↔ local stdio server; TUI ↔ plan files; plugin ↔
  bundled assets; CI ↔ package.
- Key threats: tool misuse/command execution (SEC-001), plan-path traversal
  (mitigated by ACL/symlink checks), asset injection (frontmatter-only), supply
  chain (gated by OSV/Semgrep/Trivy).
- Agentic/MCP: local trust boundary; no remote authorization or multi-tenant
  surface in this repo.

## Residual risk

The local MCP server is a privileged capability. Treat the OpenCode session and
its MCP client as trusted; do not connect untrusted MCP servers or run the
server under a broad-privilege account. No clean-scan claim is made.

## Evidence handling

No secrets, tokens or personal data were collected. This report is plan-scoped;
no long-lived sanitized report was published.
