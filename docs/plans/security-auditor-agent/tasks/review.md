# Final Plan Review — Enterprise Security Auditor Agent and Skills

**Plan:** `docs/plans/security-auditor-agent/plan.md`
**Contract:** `docs/plans/security-auditor-agent/sdd.md`
**Diff reviewed:** `03736cf..1870c42` (re-review after final fixes, 64+ files)
**Workspace impact:** `None — standalone repository` (no `WORKSPACE.md`; full diff reviewed)
**Overall risk:** Medium
**Binding verdict:** **Approve with comments** (re-review after fixes)

> Independent final-review gate. This report supersedes the earlier draft at
> this path (committed in `121d664`); that draft recorded no P0/P1 and marked
> the gate green. The P1 below is reproducible at current HEAD.

## Completion Status

- **14/14 sub-tasks Completed** in both `plan.md` and `plan_fast.md`; phases 1–5
  are all `Completed` (2+4+2+3+3 = 14). No sub-task is open.
- The plan was finalized (execution record, index row, `plan_fast_skip_checks.md`
  end-gate rows) in `e9b7f73`/`1684b73`.
- **However:** the plan is marked `Completed` while the P1 below invalidates the
  recorded installer-smoke evidence. Reopen/fix before treating the plan as
  released.

## Requirements Verification

| Requirement | Status | Evidence |
|---|---|---|
| R1: `dh-security-auditor` asset | PASS | `agents/dh-security-auditor.md`, `mode: all`, no `permission`/`tools`; gate/method/severity/safety sections present; 116 lines |
| R2: three security skills | PASS | `skills/dh-security-audit/`, `skills/dh-threat-model/`, `skills/dh-security-probe/` with references |
| R3: frontmatter/line limits | PASS | 157 / 116 / 117 lines; `dh-setup` 249; frontmatter tests pass |
| R4: target standards selection | PASS | `skills/dh-security-audit/references/standards-matrix.md` covers web/API/desktop/mobile/agentic-MCP/supply-chain/CI |
| R5: threat modeling coverage | PASS | DFD/trust boundaries, STRIDE per element, LINDDUN, abuse cases, ASI01–ASI10 and MCP attack classes |
| R6: authorized probing | PASS | Written authorization, scope allowlist, window, test accounts, rate limits, read-only default, Tier B approval, stop conditions |
| R7: finding schema | PASS\* | ID/severity/CWE/controls/evidence/reproduction/impact/remediation/retest/coverage present; \*self-audit CVSS sample is not a valid v4.0 vector (P2) |
| R8: artifact locations/templates | PASS\* | Plan-scoped and long-lived paths defined; \*contract still names `security-audit.md` while delivery uses `security-self-audit.md` (P3) |
| R9: inventory integration | **PARTIAL** | Code/tests mostly at 7/30/37; audit `LOOP` still 6/27 and installer smoke still gates on 6/27 (P1/P2) |
| R10: docs | **PARTIAL** | README/LOADING/AGENTS/skills index updated, but stale 6/27 claims remain (P2) |
| R11: QA + self-audit | **PARTIAL** | Self-audit exists; recorded full gate is not a true installer-smoke pass (P1) |
| R12: read-only default/no runtime deps | PASS | No new dependency, no network requirement, probing opt-in |
| R13: `dh-setup` profile | PASS | `skills/dh-setup/references/security-profile.md`; project profile and selection exist in `docs/security/` |
| R14: audit reads profile first | PASS | Profile-first rules plus safe defaults and drift reporting in agent and audit skill |
| AC1: assets/registration 7/30/37 | PASS | `assets.test`, `frontmatter.test`, `registration.test` assert 7/30/37 |
| AC2: current standards matrix | PASS | Versions verified against both research notes; no stale SLSA 1.1/WSTG 5/API 2026 claims |
| AC3: sample threat model + audit report | **PARTIAL** | Audit report exists; no full sample threat model artifact with the template sections (P2) |
| AC4: negative probe test | PASS\* | Rules fail closed by construction; no recorded negative dry-run evidence (P3) |
| AC5: self-audit report | PASS\* | `tasks/security-self-audit.md` with SEC-001 and coverage; CVSS vector defective (P2) |
| AC6: full QA/no dead links/no secrets | **PARTIAL** | Link check OK; installer smoke false-green and stale docs (P1/P2) |
| AC7: profile consumed by audit | PASS | `docs/security/security-profile.md` + `standards.selection.md`; self-audit starts from them |

## Findings

### [P0] Blocking

None.

### [P1] High

#### 1. Installer smoke gate is silently skipped — `preflight()` still requires 6 agents / 27 skills

- **Package:** `[workspace]`
- **Location:** `scripts/lib/install-smoke-checks.mjs:44,62-70`; `scripts/smoke-install.mjs:260`
- **Why it matters:** The printable checks were updated to 7/30, but the
  `preflight()` return expression still requires `agents.length === 6` and
  `skillDirs.length === 27`. With the new corpus (7/30), `preflight()` prints
  six successful checks and then returns `false`. `smoke-install.mjs` reads
  `if (preflight(REPO_ROOT, check)) await run(rootDir);`, so the entire
  project/global install, status, uninstall, JSON-envelope and isolation
  lifecycle is skipped. Because no `check()` call fails, `reportResult()` exits
  `0` and reports `[smoke-install] OK`.
- **Evidence:** `node scripts/smoke-install.mjs` at HEAD prints only the six
  preflight lines and exits `0` (verified independently); no lifecycle checks
  run. `qa:check:full` includes `node scripts/smoke-install.mjs`, so the
  recorded “full gate PASS” is not evidence that the installer still works.
- **Fix:** Update the return to `agents.length === 7 && skillDirs.length === 30`
  (and the stale comment at line 44), or better derive both from
  `scripts/lib/shared.mjs` / a single inventory constant so the printed checks
  and the return cannot diverge. Add a regression assertion that
  `preflight()` cannot pass while its checks disagree. Re-run
  `node scripts/smoke-install.mjs` and `pnpm qa:check:full`; refresh the
  skip-check ledger and QA claims afterwards.

### [P2] Medium

#### 2. Audit loop membership is still pinned to 6/27 (33 names)

- **Package:** `[workspace]`
- **Location:** `scripts/lib/shared.mjs:18-56`; generated `reports/audit.md:13,18`; `reports/audit.json`
- **Why it matters:** Plan 4.1 and R9 explicitly include `pnpm run audit` in the
  inventory sweep. `LOOP` still lists 27 skills and 6 agents, so the audit
  reports `Loop membership | 33 | PASS | 27/27 skills present; 6/6 agents
  present` while the same report’s inventory row says 37/7/30. The audit gate
  does not verify the new security assets, and the committed report is
  internally inconsistent.
- **Fix:** Add `dh-security-audit`, `dh-threat-model`, `dh-security-probe` and
  `dh-security-auditor` to `LOOP`, regenerate `reports/audit.json`/`audit.md`,
  and optionally add a test that keeps `LOOP` consistent with the source
  inventory.

#### 3. Stale 6/27 claims remain in active docs and the example config

- **Package:** `[workspace]`
- **Location:** `AGENTS.md:261-262` (`agents/ (6)`, `skills/ (27)`);
  `docs/LOADING.md:657-658` (“6 `dh-*` agents and 27 `dh-*` skills”);
  `opencode.example.jsonc:6,48,52`;
  `demo-project/docs/index.md:15,29,56,74`.
- **Why it matters:** Plan 4.2’s acceptance criterion is “no stale 6/27 claims
  remain in the active docs”, and AC6 requires consistent docs. `AGENTS.md` and
  `docs/LOADING.md` are explicitly in R10’s scope; the repo layout and the
  installation-troubleshooting section still tell users the old inventory.
  README and the main LOADING sections were updated, so this is an incomplete
  sweep, not a deliberate historical reference.
- **Fix:** Sweep with
  `rg -n '6 agents|27 skills|definitions \(6\)|skills \(27\)|6 \`dh-\*'`
  and update the active files. Keep `CHANGELOG.md`, `docs/evolution/` and
  `docs/evolve/` historical entries unchanged; the demo and example config can
  be updated or clearly marked as historical.

#### 4. No full sample threat model — AC3 is only partially evidenced

- **Package:** `[workspace]`
- **Location:** `docs/plans/security-auditor-agent/tasks/` (only
  `security-self-audit.md`); `security-self-audit.md` “Threat model summary”;
  contract path `tasks/threat-model.md` in
  `contracts.md:103` and `skills/dh-security-audit/references/artifact-contract.md:8`;
  template in `skills/dh-threat-model/references/threat-model-template.md`.
- **Why it matters:** AC3 requires a sample threat model and sample audit
  report that render with the required sections and traceable findings. The
  self-audit summary names assets, boundaries and key threats, but it has no
  DFD, no STRIDE-per-element table, no LINDDUN/abuse-case rows and no
  accepted-risk/handoff sections. The template has therefore not been
  demonstrated end-to-end, and the contracted artifact does not exist.
- **Fix:** Add a compact plan-scoped `tasks/threat-model.md` using the template
  (scope/assumptions, assets, DFD + trust boundaries, STRIDE table,
  agentic/MCP threats, abuse cases, accepted risks, audit handoff) and link it
  from the self-audit and evolution note; or expand the self-audit section to
  the full template shape.

#### 5. SEC-001’s CVSS vector is not valid CVSS v4.0

- **Package:** `[workspace]`
- **Location:** `docs/plans/security-auditor-agent/tasks/security-self-audit.md:44`
- **Why it matters:** The finding uses
  `CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N`. CVSS v4.0 retired the Scope
  (`S`) metric and renamed the impact metrics to `VC/VI/VA` plus
  `SC/SI/SA`; it also adds `AT`. This is a v3.1-style vector with a v4.0
  prefix, contradicting the plan’s own standards matrix (“Scope retired”) and
  R7/AC5’s CVSS v4.0 claim. The sample report is the demonstration of the
  reporting contract, so the error is material.
- **Fix:** Use a valid v4.0 vector and record the score/metric group, e.g.
  `CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N`, or
  explicitly mark the vector as a v3.1 estimate if that is intended. Add a
  valid example to `references/severity-and-reporting.md`.

### [P3] Low

#### 6. Tool matrix Tier B rows have no source link and no explicit purpose column

- **Location:** `skills/dh-security-probe/references/tool-matrix.md:30-45`;
  acceptance criterion in plan 3.2.
- **Why it matters:** Plan 3.2 asks every tool row to carry surface, purpose,
  access mode, safety note and source. Tier A rows include a URL in Notes;
  Tier B rows carry surface/tool/risk/required controls but no source, and
  neither table has an explicit purpose column. The top-of-file research link
  partially compensates, but a row-level source is missing.
- **Fix:** Add a Source column (or footnotes) and a one-line purpose per tool;
  keep the Tier A/Tier B split unchanged.

#### 7. No recorded negative probe dry-run evidence (AC4)

- **Location:** `skills/dh-security-probe/SKILL.md` and playbooks;
  `tasks/security-self-audit.md` is read-only.
- **Why it matters:** AC4 asks the probe rules to pass a negative test for
  missing authorization/scope, out-of-scope targets and destructive requests.
  The control language is strong and fail-closed, but no artifact records the
  three negative dry-runs, so the acceptance criterion is asserted rather than
  evidenced.
- **Fix:** Add a short “negative gate dry-run” record (scenario, expected stop
  message, observed stop) to the self-audit or a plan fixture. A runtime test
  is unnecessary for a Markdown skill; a documented dry-run is enough.

#### 8. Minor contract/template consistency nits

- `docs/plans/security-auditor-agent/contracts.md:102` and
  `skills/dh-security-audit/references/artifact-contract.md:7` name the
  plan-scoped audit `security-audit.md`, while the delivered file is
  `security-self-audit.md` (explicitly required by plan 5.2). Align the
  contract name or document the self-audit variant.
- `skills/dh-threat-model/references/threat-model-template.md:53` contains the
  placeholder `<threat or ->`, which renders as an HTML-ish tag; use `<none>`
  or `—`.
- `docs/security/security-profile.md:19` and
  `diagrams/desired-state.md:38` say “ASVS 5.0” while the matrix and selection
  pin “ASVS 5.0.0”. Unify the pinned version.

## Safety / Security Review

**PASS.** The probing capability is fail-closed and non-destructive by design:

- No authorization/scope → stop is stated in the agent’s engagement gate, the
  audit skill’s core rules and the probe skill’s “No gate, no probe”.
- Read-only is the default (Tier A); Tier B requires per-test approval, rate
  limits, disposable/non-production data, snapshots/VMs and a stop condition.
- Scope allowlist, DNS resolution, no redirects outside the allowlist, no
  third-party/shared infrastructure.
- No destructive, DoS, persistence, lateral-movement, credential-theft or
  data-exfiltration testing; no exploit development.
- MCP Inspector is pinned and local-only, with CVE-2025-49596 and
  CVE-2025-58444 documented in both the rules of engagement and tool matrix.
- Evidence redaction, no production dumps/tokens/PII, coverage and residual-risk
  statements, and no clean-scan claims are all required.

No secrets or credentials are present in the new assets, research notes,
profile/selection, self-audit or evolution notes (targeted signature scan and
the harness audit both found no high-signature secrets). The only security
finding carried forward is SEC-001 (pre-existing `dh_logged_command` local
shell trust boundary, P2), which the self-audit reports honestly rather than
claiming a clean scan.

## Standards Matrix Verification

**PASS.** `skills/dh-security-audit/references/standards-matrix.md` pins:
ASVS 5.0.0, OWASP Top 10:2025, API Top 10 2023, WSTG 4.2, MASVS 2.1.0,
MASTG 2.0.0, Desktop App Security Top 10 (2021), Agentic Top 10 2026 (ASI01–
ASI10), LLM Top 10 2025, MCP 2026-07-28, AIVSS 0.8 preview, CVSS 4.0,
CWE Top 25 2025, SLSA 1.2, SAMM 2.2.0, NIST CSF 2.0/SSDF 1.1 and PCI DSS 4.0.1.
Both research notes support the versions and primary URLs. The matrix
explicitly forbids citing WSTG v5, API Top 10 2026, SLSA v1.1 and the SOC 2
2027 draft as current. No stale claim found. (The profile’s “ASVS 5.0” label is
a minor pinning nit, P3 above.)

## Docs, Index, Links and Rollback

- README, `docs/LOADING.md`, `AGENTS.md`, `skills/index.md` and the
  agent-selection reference contain the new capability and the 7/30 headline
  counts; the security profile/standards selection are documented as
  `dh-setup`-owned.
- `docs/evolution/index.md` registers both the evolution and observation
  notes; `docs/plans/index.md` has the execution record and a Completed plan
  row.
- `node scripts/check-links.mjs` → **OK**, 556 references checked.
- Rollback/recovery is straightforward: the capability is additive Markdown +
  reference files; revert the feature commits, remove `docs/security/` (project
  configuration) and the generated `dist/assets` copies on the next build.
  Probe safety requires snapshots/rollback plans per engagement, and the
  self-audit’s SEC-001 remediation path is documented.
- No runtime dependency, network call or credential requirement was added.

## QA Evidence

- Recorded by execution: `pnpm qa:check:full` PASS, `pnpm test` 79 files /
  1263 tests, build/typecheck/smokes/audit. I did not re-run the full gate.
- Targeted re-verification: `node scripts/check-links.mjs` (PASS) and
  `node scripts/smoke-install.mjs` (EXIT 0 but only the six preflight checks;
  P1). `LOOP` lengths are 27 skills / 6 agents (P2), and the committed
  `reports/audit.md` shows 33 loop members.
- The recorded QA claim should not be treated as green for the installer until
  P1 is fixed and the gate is re-run.

## Workspace Impact

- **Affected packages:** None — standalone repository.
- No package was skipped: the full diff was reviewed. No package-scoped
  validation applies.
- Untouched packages: none (not a workspace).

## Suggested Next Steps

- [ ] Fix P1 (`preflight()` return + comment), add the regression guard, re-run
      `node scripts/smoke-install.mjs` and `pnpm qa:check:full`, and append a
      corrective row to `plan_fast_skip_checks.md`.
- [ ] Update `scripts/lib/shared.mjs` `LOOP` to 30/7 and regenerate
      `reports/audit.json`/`audit.md`.
- [ ] Sweep the stale 6/27 docs (`AGENTS.md`, `docs/LOADING.md`,
      `opencode.example.jsonc`, demo docs).
- [ ] Add the sample `tasks/threat-model.md` and fix the SEC-001 CVSS v4.0
      vector.
- [ ] Add Tier B source links/purpose, record the negative probe dry-run, and
      align the audit artifact/version labels.
- [ ] Re-run this final-review gate and only then keep the plan Completed /
      release `v0.14.0`.

## Re-Review After Fixes

The P1/P2/P3 findings above were fixed and re-verified:

| Finding | Fix | Evidence |
|---|---|---|
| P1 installer preflight return | Return now uses `EXPECTED_AGENTS=7` / `EXPECTED_SKILLS=30` | `node scripts/smoke-install.mjs` PASS with full install/status/uninstall lifecycle |
| P2 LOOP inventory | Added security skills/agent to `scripts/lib/shared.mjs` | `reports/audit.md`: 37 loop members, 30/30 skills, 7/7 agents |
| P2 stale docs | Swept AGENTS/LOADING/example/demo counts | `rg` for 6/27 returns no active hits |
| P2 AC3 sample model | Added `tasks/threat-model.md` using the full template | linked from self-audit/evolution |
| P2 SEC-001 CVSS | Replaced with a valid CVSS v4.0 vector (`AT`, `VC/VI/VA`, `SC/SI/SA`) | self-audit line |
| P3 probe evidence | Added `tasks/probe-negative-tests.md` (5/5 stop) | self-audit coverage |
| P3 Tier B rows | Added per-row official source links | `tool-matrix.md` |
| P3 naming/placeholder/version labels | Contract self-audit allowance, `<threat or "none">`, ASVS 5.0.0 | artifact/template/profile |

## Verdict

**Approve with comments.** The capability is coherent and the safety and
standards work is strong. The P1 release-gate defect and P2/P3 evidence gaps are
resolved; SEC-001 remains a documented P2 local trust-boundary finding, not a
blocker for this capability.
