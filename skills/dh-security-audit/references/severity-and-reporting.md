# Severity and Reporting

## Scoring

- **P0 / Critical:** active exploitation, broad compromise, safety impact or
  trivial unauthenticated admin/tenant access. Stop and escalate.
- **P1 / High:** exploitable with meaningful confidentiality, integrity or
  availability impact; blocks release/merge.
- **P2 / Medium:** meaningful but constrained, requires preconditions or has
  limited blast radius.
- **P3 / Low:** hardening, defense-in-depth, informational.

CVSS v4.0 is the scoring record: vector, score and metric group (CVSS-B/BT/BE/
BTE). AIVSS is an additive preview for agentic findings and must be labelled
`non-normative (v0.8)`. Never replace CVSS with AIVSS.

## Finding fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `SEC-001`, stable across re-tests |
| `title` | yes | Outcome, not tool name |
| `severity` | yes | P0–P3 + CVSS vector/score; AIVSS preview when agentic |
| `cwe` | when applicable | CWE ID |
| `controls` | yes | ASVS/API/MASVS/MASTG/ASI/LLM/MCP/CWE/ISO/PCI/SOC2 |
| `affected` | yes | Asset, endpoint, file:line, build ID |
| `evidence` | yes | Redacted request/response, command, timestamp, tool/version |
| `reproduction` | yes | Minimal safe steps; rate limit; test account |
| `impact` | yes | Business and technical impact |
| `remediation` | yes | Specific fix and verification |
| `retest` | yes | `pass` / `fail` / `not run` + date |
| `coverage` | report | tested / not tested / excluded / residual risk |

## Report structure

1. **Executive summary** — scope, dates, top risks, release recommendation.
2. **Authorization and scope** — reference, allowlist, exclusions, window,
   environments, test accounts, stop contact.
3. **Architecture and threat model** — trust boundaries, data flows, key
   assumptions.
4. **Findings** — grouped by severity, each with the finding fields.
5. **Controls coverage** — standards matrix with pass/fail/not-tested.
6. **Residual risk and follow-ups** — accepted risks, deferred items, owners.
7. **Evidence index and redaction statement.**

## Evidence rules

- Redact tokens, cookies, API keys, passwords, personal data and production
  payloads before writing a report.
- Store raw evidence only in the controlled engagement area; link a redacted
  excerpt, not the raw dump.
- Record tool name/version, command, timestamp and target.
- Never archive production data or credentials in `docs/`.

## Quality bar

- A finding must be reproducible from the report without access to the
  auditor's shell history.
- Do not report a finding from a scanner alone; confirm it or label it
  `unconfirmed`.
- A clean scan is a coverage statement, not a security guarantee.
- P0/P1 findings block the plan loop; preserve evidence and recommend
  `dh-pause-plan` rather than continuing.
