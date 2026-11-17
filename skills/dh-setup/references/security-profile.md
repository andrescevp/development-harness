# Project Security Profile and Standards Selection

`dh-setup` owns the project-specific answer to "which security standards apply
here?". The profile is project configuration, not a generated report: it lives
under `{project_root}/docs/security/` and is read by `dh-security-audit`.

## Detection matrix

Probe the project for markers, then confirm with the user. Do not infer a
compliance regime from one file.

| Surface | Markers to probe | Default standards |
|---|---|---|
| Web | React/Vue/Svelte/Angular/Next/Nuxt, HTML templates, auth middleware | ASVS 5.0.0, Top 10:2025, WSTG 4.2 |
| API | OpenAPI/Swagger, GraphQL schema, `.proto`, REST controllers, API gateway | ASVS V4/V8/V9/V10, API Top 10 2023, RFC 9700/8725 |
| Desktop | Electron, Tauri, Qt, .NET/WPF, JavaFX, native packaging/signing | Desktop Top 10 (2021), Electron checklist, CIS Benchmarks |
| Mobile | Android/iOS, Flutter, React Native, Expo, mobile signing | MASVS 2.1.0, MASTG 2.0.0 |
| Agentic/MCP | MCP config/servers, tool manifests, LLM SDKs, agent prompts/tools, vector stores | Agentic Top 10 2026, LLM Top 10 2025, MCP 2026-07-28, AIVSS preview |
| Supply chain/CI | lockfiles, Dockerfile, GitHub Actions/GitLab CI, Terraform, K8s, SBOM | NIST SSDF, SLSA v1.2, CWE Top 25 2025 |
| Compliance | policy docs, contracts, data classes, card/health markers, user statement | ISO 27001:2022, PCI DSS 4.0.1, SOC 2 TSC, CIS Benchmarks (mapping only) |

## Interview (only what detection cannot answer)

1. What data classes does the system handle (public/internal/PII/PHI/card/
   credentials)?
2. Which assurance level or internal target applies (ASVS L1/L2/L3; MASVS
   profile; risk tier)?
3. Which compliance regimes are in scope, and are they certification or
   mapping-only?
4. Is there a non-production environment, test accounts and a snapshot/VM for
   probing?
5. Which security tools are installed/approved, and who authorizes active tests?
6. What is excluded from the audit?

## Output files

With explicit consent, write:

### `docs/security/security-profile.md`

```markdown
---
title: "Security Profile — <project>"
slug: security-profile
tags: [security, profile]
project: "<project>"
status: active
reviewed: YYYY-MM-DD
---

# Security Profile

| Surface | Detected | Selected standards | Notes |
|---|---|---|---|
| Web | yes/no | ASVS 5.0.0; Top 10:2025 | |
| API | yes/no | API Top 10 2023; RFC 9700/8725 | |
| Desktop | yes/no | Desktop Top 10 (2021); Electron | |
| Mobile | yes/no | MASVS 2.1; MASTG 2.0 | |
| Agentic/MCP | yes/no | Agentic 2026; LLM 2025; MCP 2026-07-28 | |
| Supply chain | yes/no | SSDF; SLSA 1.2; CWE 2025 | |

- **Data classification:** <...>
- **Assurance target:** <...>
- **Compliance scope:** <mapping-only / certification / none>
- **Test environment:** <non-prod / snapshot / none>
- **Authorized tools:** <...>
- **Exclusions:** <...>
- **Review interval:** <e.g. 90 days or on stack/compliance change>
```

### `docs/security/standards.selection.md`

List only the selected standards with version, URL, retrieval date and the
applicable control domains. Link the audit matrix; do not copy the full matrix.

## Validation

- Frontmatter valid; `reviewed` is an ISO date; no secrets/PII in the file.
- Every selected standard exists in the audit matrix version lock; no stale
  versions (WSTG 4.2, API 2023, SLSA 1.2, MASVS 2.1, MASTG 2.0).
- `dh-security-audit` can read the profile and selection; missing/stale handling
  is documented.
- Re-running setup is idempotent: show the diff and ask before changing a
  project-owned profile.
- On stack/compliance change, update the profile/selection and bump `reviewed`;
  report drift instead of silently replacing.

## Safety

- Never write the profile without consent.
- Never mark a project PCI/SOC 2/ISO-scoped without the owner's confirmation.
- Compliance rows are mapping evidence, not certification.
- Do not install security tools as part of profiling; list approved tools only.
