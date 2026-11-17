# Artifact Contract

## Locations

| Artifact | Path | Owner |
|---|---|---|
| Plan-scoped audit | `docs/plans/<slug>/tasks/security-audit.md` (self-audits may use `security-self-audit.md`) | security auditor / plan |
| Plan-scoped threat model | `docs/plans/<slug>/tasks/threat-model.md` | security auditor / plan |
| Plan-scoped probe log | `docs/plans/<slug>/tasks/probe-log.md` | security auditor / plan |
| Long-lived sanitized audit | `docs/security/<engagement>/audit.md` | documentation owner |
| Project profile | `docs/security/security-profile.md` | `dh-setup` |
| Standards selection | `docs/security/standards.selection.md` | `dh-setup` |

Plan-scoped artifacts stay with the plan. Long-lived reports are generated
documents and must be persisted by the documentation owner
(`dh-create-documentation`). Never create a second plan directory under a
package.

## Engagement naming

- `<engagement>` is a short lowercase slug: repo or product plus year, e.g.
  `checkout-api-2026`.
- Do not put secrets, customer names or personal data in a path.

## Evidence handling

1. Capture in the controlled engagement area (not `docs/`).
2. Redact secrets/PII immediately; keep only the minimum excerpt needed.
3. Record source, tool/version, timestamp, command and target.
4. Link redacted excerpts from the finding; delete raw captures after retention
   expires or the owner requests deletion.
5. Never commit production dumps, tokens, cookies or private keys.

## Frontmatter

```yaml
---
title: "Security Audit — <target>"
slug: <engagement>
description: "Scope, findings, severity and remediation."
tags: [security, audit]
project: "<project>"
stack: "<stack>"
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
---
```

## Handoff

The auditor writes plan-scoped findings and the sanitized report draft. The
documentation owner writes the long-lived `docs/security/<engagement>/audit.md`,
updates any index, and verifies link/redaction rules. The project profile and
standards selection are setup-owned; the auditor reports drift but does not
rewrite them.
