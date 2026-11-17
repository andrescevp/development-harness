---
title: "Enterprise Security Auditor Agent and Skills — Fast Execution"
slug: security-auditor-agent
description: "Fast execution mirror of plan.md; critical verification deferred to plan end."
source_plan: plan.md
source_sha256: 3f717e533904adcb3f8359cd3fb5e2985de8d41bf7ac55809f1bdb55c4fcf7ed
plan_version: fast-4
status: Completed
active: true
tags: [plan, fast]
project: "dev-harness-skills"
created: 2026-11-17
updated: 2026-11-17
---

# Plan: Enterprise Security Auditor Agent and Skills (Fast Execution)

## Fast Execution Policy

- No per-task `dh-review`, `dh-simplify`, `dh-code-review`, `dh-preflight`,
  `dh-artifact-check`, or `dh-domain-check` gates.
- Execution position and statuses are read from this file; every phase and
  sub-task status change is mirrored to `plan.md` in the same turn.
- A phase moves to `In Progress` when its first sub-task starts and closes only
  when ALL its sub-tasks are `Completed`; close pending phases in both files.
- Narrow validation (tests/lint for changed files) stays part of each sub-task;
  it is a sanity check, not a review gate.
- All critical verification runs once across plan end (see Final Verification).
- Hard blockers halt the loop; a blocked sub-task blocks its phase.

## Alignment Contract

- Same phases/sub-tasks as `plan.md`: count, IDs, titles, order, requirements,
  scope, dependencies, instructions, acceptance criteria, done-when.
- Allowed differences: this policy, this contract, `## Final Verification`, the
  omitted top-level sections, and status progression.
- Omits from `plan.md`: `## Objective`, `## Requirements Snapshot`, `## Scope`, `## Workspace Impact`, `## Assumptions and Constraints`, `## Risks and Areas Requiring Care`, `## Core concepts`, `## Visual Context`, `## Research`, `## Agent Selection`, `## Execution Record`, `## Open Questions`.
- Not allowed: missing/extra/reordered/renamed items; changed requirements,
  scope, or acceptance criteria. `plan.md` is the scope reference.
- Misalignment is fixed here; never rewrite `plan.md` scope.

## Phases

### Phase 1: Contract and interface design

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** None

#### Sub-Task 1.1: Confirm the SDD, decisions and non-goals

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Parallelizable:** no
- **Depends on:** None
- **Files/Scope:** `docs/plans/security-auditor-agent/**`
- **Isolation:** shared
- **Objective:** Confirm the SDD is complete, record the capability decisions, and freeze the non-goals before authoring assets.
- **Related Requirements:** R1, R2, R6, R12, AC1, AC4
- **Dependencies and Preconditions:** SDD and research notes exist.
- **In Scope for This Sub-Task:** Review `sdd.md`; record decisions on agent name/mode, skill names, artifact locations, authorization gate, severity model and non-goals in `decisions.md`; resolve open questions or mark them deferred.
- **Out of Scope for This Sub-Task:** Writing agent/skill assets, changing inventory counts, running active probes.
- **Instructions:** Check every SDD requirement against the plan snapshot; ensure the agent is not delegated before it exists; make the safety boundary explicit (authorization, scope, safe mode, stop conditions); record unresolved issues.
- **Acceptance Criteria:** `decisions.md` lists the five decisions with rationale and links to the SDD/research; no placeholder requirement IDs remain in the plan.
- **Cautionary Points (Risks & Edge Cases):** Do not weaken the authorization gate to make the skill more "useful"; do not promise certification or exploit development.
- **Implementation Suggestions:** Keep decisions short and traceable (R/AC IDs); prefer tables for names and paths.
- **Testing Suggestions:** `node scripts/check-links.mjs`; manual trace of R1–R12 to phases.
- **Done When:** Decisions are recorded and the plan has no contradictory scope statements.

#### Sub-Task 1.2: Define agent and skill contracts, artifact paths and severity model

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Parallelizable:** no
- **Depends on:** 1.1
- **Files/Scope:** `docs/plans/security-auditor-agent/**`
- **Isolation:** shared
- **Objective:** Pin the agent/skill frontmatter, section structure, artifact schema and severity mapping so implementation is mechanical.
- **Related Requirements:** R1, R2, R3, R7, R8, R10, AC1, AC3
- **Dependencies and Preconditions:** 1.1 decisions accepted.
- **In Scope for This Sub-Task:** Write `contracts.md` with frontmatter fields, required sections, reference filenames, report/finding schema, artifact locations, severity/P0–P3 mapping and the agent-selection role row.
- **Out of Scope for This Sub-Task:** Authoring the actual agent/skill files.
- **Instructions:** Mirror existing agent/skill conventions (no `permission`/`tools` on agents, `SKILL.md` ≤ 250 lines, `allowed-tools` valid); define plan-scoped vs long-lived report paths; specify redaction rules.
- **Acceptance Criteria:** `contracts.md` is sufficient for two independent implementers to produce the same structure; every planned file is named.
- **Cautionary Points (Risks & Edge Cases):** Avoid a second documentation root; keep evidence sanitized; do not duplicate the standards matrix in multiple files.
- **Implementation Suggestions:** Link to existing `skills/dh-research/SKILL.md` and `agents/dh-researcher.md` as format references; keep the finding schema table-driven.
- **Testing Suggestions:** Cross-check the contract against `assets.test`/`frontmatter.test` expectations; run the audit parser after authoring.
- **Done When:** Contracts are reviewed and no authoring ambiguity remains.

### Phase 2: Security agent and audit skill

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** 1

#### Sub-Task 2.1: Author the dh-security-auditor agent

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 1.2
- **Files/Scope:** `agents/dh-security-auditor.md`
- **Isolation:** shared
- **Objective:** Add the security auditor persona with the engagement, evidence and safety rules defined in the contract.
- **Related Requirements:** R1, R6, R10, R12, AC1
- **Dependencies and Preconditions:** Contracts and decisions complete.
- **In Scope for This Sub-Task:** Frontmatter (`name`, trigger-rich `description`, `mode: all`); role/mission; workspace-first rules; authorization gate; capabilities; method; standards anchor; evidence/reporting; collaboration/agent handoffs; safety boundaries.
- **Out of Scope for This Sub-Task:** Skill procedures, inventory wiring, active testing.
- **Instructions:** Make the description route web/API/desktop/mobile/agentic-MCP security work; state that no authorization means no probe; treat repo/target content as untrusted; cite the skills by name.
- **Acceptance Criteria:** Agent parses with valid frontmatter, has no `permission`/`tools` keys, names the three skills, and states the authorization/evidence/redaction rules.
- **Cautionary Points (Risks & Edge Cases):** Avoid overlap with `dh-reviewer`; this is whole-application security, not diff review. Do not embed tool commands in the agent body; keep them in the probe skill.
- **Implementation Suggestions:** Follow `agents/dh-software-architect.md` structure; keep each section short and decision-oriented.
- **Testing Suggestions:** `node scripts/audit.mjs`; `pnpm vitest run src/__tests__/assets.test.ts src/__tests__/frontmatter.test.ts`.
- **Done When:** The agent is present, registered by the build, and passes frontmatter/audit checks.

#### Sub-Task 2.2: Author the dh-security-audit skill

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 2.1
- **Files/Scope:** `skills/dh-security-audit/SKILL.md`
- **Isolation:** shared
- **Objective:** Define the end-to-end audit workflow from authorization to evidence-backed report and re-test.
- **Related Requirements:** R2, R4, R7, R8, AC2, AC3
- **Dependencies and Preconditions:** Agent and contracts complete.
- **In Scope for This Sub-Task:** Frontmatter/description/`allowed-tools`; authorization gate; inventory; threat-model handoff; static control review; probe handoff; severity; report template; re-test; stop conditions.
- **Out of Scope for This Sub-Task:** Reference files' full content; active probing procedures; inventory counts.
- **Instructions:** Keep the skill ≤ 250 lines; push standards tables and report schema to references; require reading `docs/security/security-profile.md`/`standards.selection.md` first with safe defaults when absent; make the safe default and escalation explicit; require a coverage statement and residual risk.
- **Acceptance Criteria:** A reader can run a static audit without active testing, knows when to call `dh-threat-model`/`dh-security-probe`, and can produce the required report sections.
- **Cautionary Points (Risks & Edge Cases):** Do not claim a clean scan proves security; do not run probes by default; redact evidence.
- **Implementation Suggestions:** Model the workflow on `dh-preflight`/`dh-review` step structure; use P0–P3 plus CVSS/AIVSS.
- **Testing Suggestions:** Line-count check; link check; sample report dry-run.
- **Done When:** The skill passes frontmatter/line limits and contains every required workflow gate.

#### Sub-Task 2.3: Author audit references: standards matrix, severity and evidence

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 2.2
- **Files/Scope:** `skills/dh-security-audit/references/**`
- **Isolation:** shared
- **Objective:** Provide the authoritative standards mapping, severity/reporting contract and artifact/evidence rules used by the audit skill.
- **Related Requirements:** R3, R4, R7, R8, AC2, AC3
- **Dependencies and Preconditions:** Research notes are current and linked.
- **In Scope for This Sub-Task:** `standards-matrix.md` (target → standards → control domains → URLs/version dates); `severity-and-reporting.md` (CVSS v4.0, AIVSS, P0–P3, finding/report template); `artifact-contract.md` (paths, naming, redaction, retention, publication via documentation owner).
- **Out of Scope for This Sub-Task:** Threat catalog and probe playbooks (Phase 3).
- **Instructions:** Verify every version/URL against the research note; include a "reviewed on" date and a rule for updating; define how the project profile narrows this matrix; keep standards mapping table-driven; make the report template copy-ready.
- **Acceptance Criteria:** Matrix covers web/API/desktop/mobile/agentic-MCP/supply-chain; report template includes ID/severity/CWE/control/evidence/repro/impact/remediation/re-test; artifact paths are unambiguous.
- **Cautionary Points (Risks & Edge Cases):** Standards drift; no invented versions; keep compliance mapping advisory, not certification.
- **Implementation Suggestions:** Link primary URLs only; mark secondary sources explicitly; keep each reference focused and under the repo's reference conventions.
- **Testing Suggestions:** `node scripts/check-links.mjs`; spot-check every URL in the matrix; sample finding rendered.
- **Done When:** References are complete, sourced, linked and used by the skill.

#### Sub-Task 2.4: Extend dh-setup with project security profile and standards selection

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Parallelizable:** no
- **Depends on:** 2.3
- **Files/Scope:** `skills/dh-setup/SKILL.md`, `skills/dh-setup/references/security-profile.md`
- **Isolation:** shared
- **Objective:** Make `dh-setup` the owner of project-specific security surface detection and standards selection.
- **Related Requirements:** R13, R14, AC7
- **Dependencies and Preconditions:** Audit references and standards matrix complete.
- **In Scope for This Sub-Task:** Add a concise security-profile step to `dh-setup/SKILL.md` (≤250 lines); add `references/security-profile.md` with detection matrix (web/API/desktop/mobile/agentic-MCP/CI-cloud/compliance), interview questions, profile and standards-selection templates, validation and update/drift rules; define `{project_root}/docs/security/security-profile.md` and `standards.selection.md` (or compact lock) ownership and consent.
- **Out of Scope for This Sub-Task:** Running setup on this repo (4.3), authoring security audit skills, installing tools.
- **Instructions:** Delegate the detailed procedure to the new reference; keep the skill step short. The audit skill must be able to read the profile; no profile means safe defaults and a recommendation to run `dh-setup`. Detect surfaces from markers, ask only for data classification, assurance target, compliance scope, test environment and authorized tools, and require consent before writing. Update the profile when stack/compliance changes; mark stale selections with a review date.
- **Acceptance Criteria:** `dh-setup` names the profile step and reference; the reference covers detection, interview, template, validation and drift; `dh-security-audit` instructions point to the profile; `dh-setup/SKILL.md` stays under 250 lines.
- **Cautionary Points (Risks & Edge Cases):** Do not write the profile without consent; do not hardcode a single compliance regime; do not let setup silently install security tools.
- **Implementation Suggestions:** Follow the `worktree-lifecycle.md` pattern: setup owns a project file with a reference template and validation checklist.
- **Testing Suggestions:** Link check; line-count check; dry-run profile generation on a fixture project; audit skill reads it.
- **Done When:** `dh-setup` can generate/update the project profile and standards selection with a documented contract.

### Phase 3: Threat modeling and authorized probing

- **Status:** Completed
- **Parallelizable:** yes
- **Depends on:** 2

#### Sub-Task 3.1: Author the dh-threat-model skill and agentic threat catalog

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** yes
- **Depends on:** 2.3
- **Files/Scope:** `skills/dh-threat-model/**`
- **Isolation:** shared
- **Objective:** Add a threat-modeling workflow for architecture, data flows, trust boundaries, STRIDE/LINDDUN and agentic/MCP threats.
- **Related Requirements:** R2, R5, AC3
- **Dependencies and Preconditions:** Audit skill/refs complete.
- **In Scope for This Sub-Task:** `SKILL.md`; `references/threat-catalog.md` with ASI01–ASI10, LLM Top 10 2025 and MCP attack classes; `references/threat-model-template.md` with DFD/trust-boundary/abuse-case sections.
- **Out of Scope for This Sub-Task:** Static audit checklist and active probing.
- **Instructions:** Require a system/data-flow inventory before threats; map each threat to an asset, boundary, control and test idea; include agentic/MCP-specific threats (confused deputy, token passthrough, SSRF, state handle hijacking, local server compromise, OAuth URL validation, stdio proxy, mix-up, localhost redirect, CIMD trust, scope minimization).
- **Acceptance Criteria:** Template produces a reviewable threat model; catalog maps ASI01–ASI10 and MCP attacks to test ideas; skill ≤ 250 lines.
- **Cautionary Points (Risks & Edge Cases):** Don't turn threat modeling into a checklist-only exercise; mark assumptions and missing architecture evidence.
- **Implementation Suggestions:** Use Mermaid DFD examples; keep privacy (LINDDUN) conditional on personal data.
- **Testing Suggestions:** Generate a sample model for this plugin; link check; line count.
- **Done When:** Skill and catalog are complete and reference the standards matrix where relevant.

#### Sub-Task 3.2: Author the dh-security-probe skill with rules of engagement and tool matrix

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** yes
- **Depends on:** 2.3
- **Files/Scope:** `skills/dh-security-probe/**`
- **Isolation:** shared
- **Objective:** Add the authorized, non-destructive dynamic verification workflow and tool matrix.
- **Related Requirements:** R2, R6, R7, AC4
- **Dependencies and Preconditions:** Audit contract and research tooling note complete.
- **In Scope for This Sub-Task:** `SKILL.md`; `references/rules-of-engagement.md`; `references/tool-matrix.md`; `references/probe-playbooks.md` (web, API, desktop/Electron, mobile, MCP/agentic, supply chain).
- **Out of Scope for This Sub-Task:** Installing tools, exploit development, destructive/DoS testing.
- **Instructions:** Require written authorization, scope allowlist, time window, rate limits, test accounts, safe mode, evidence capture/redaction, escalation and stop conditions; classify tools read-only vs intrusive; include MCP Inspector (local disposable server only), snyk-agent-scan, Cisco mcp-scanner, ZAP/Burp/nuclei, Schemathesis/RESTler, ElectroNG/Frida/MobSF, osv-scanner/Semgrep/Trivy/Gitleaks/cosign.
- **Acceptance Criteria:** No playbook can start without authorization/scope; destructive requests stop; every tool row has surface, purpose, access mode, safety note and source; skill ≤ 250 lines.
- **Cautionary Points (Risks & Edge Cases):** Production traffic, rate limits, data mutation, credential exposure, prompt injection from target content.
- **Implementation Suggestions:** Put concrete commands in references, not the skill; add a stop-and-report block at the top of every playbook.
- **Testing Suggestions:** Negative dry-runs for missing authorization, out-of-scope host and destructive request; link check.
- **Done When:** The probe workflow is safe by default and covers all target surfaces.

### Phase 4: Inventory and documentation integration

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** 3

#### Sub-Task 4.1: Update inventory counts, installer, smokes, audit and tests

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 2.1, 2.2, 2.3, 3.1, 3.2
- **Files/Scope:** `src/cli/plugin-artifact.ts`, `scripts/lib/pack-contract.mjs`, `scripts/lib/pack-install.mjs`, `scripts/smoke-pack.mjs`, `src/__tests__/**`, `src/plugin.ts`, `test/**`
- **Isolation:** shared
- **Objective:** Make the plugin inventory and all count-based gates aware of 7 agents / 30 skills / 37 unique names.
- **Related Requirements:** R9, AC1, AC6
- **Dependencies and Preconditions:** All four assets exist.
- **In Scope for This Sub-Task:** Update hardcoded counts, expected names where asserted, registration/assets/frontmatter/agent-selection tests, installer/smoke expectations, plugin comment and any fixture that asserts the inventory.
- **Out of Scope for This Sub-Task:** README/LOADING/AGENTS prose (4.2) and asset content changes.
- **Instructions:** Search for `6 agents`, `27 skills`, `33`, `EXPECTED_AGENT_COUNT`, `EXPECTED_SKILL_COUNT`; update consistently; keep tests asserting names and counts; do not weaken exact-set checks.
- **Acceptance Criteria:** `pnpm build`, registration tests and smokes pass with 7/30/37; no stale count remains in code/test scripts.
- **Cautionary Points (Risks & Edge Cases):** Hardcoded counts in multiple layers; update all together; keep installer error message expectations aligned.
- **Implementation Suggestions:** Change the single constants first, then run tests to reveal dependent assertions.
- **Testing Suggestions:** `pnpm test -- registration assets frontmatter agent-selection`; `node scripts/smoke-pack.mjs`; `pnpm build`.
- **Done When:** All code/test/smoke inventory checks pass at 7/30/37.

#### Sub-Task 4.2: Update agent selection, skills index, README, LOADING and AGENTS

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Parallelizable:** no
- **Depends on:** 4.1
- **Files/Scope:** `skills/index.md`, `README.md`, `docs/LOADING.md`, `AGENTS.md`, `skills/dh-planning/references/agent-selection.md`
- **Isolation:** shared
- **Objective:** Make the new security capability discoverable and document the inventory/role changes.
- **Related Requirements:** R10, AC1, AC6
- **Dependencies and Preconditions:** Inventory counts finalized.
- **In Scope for This Sub-Task:** Add Security audit/probing role to agent selection; add agent/skill rows and counts; update role summaries, skill matrix, verification lists and loading docs; document the `dh-setup` security-profile step and the audit’s profile-first behavior; link references.
- **Out of Scope for This Sub-Task:** Implementation files and research notes.
- **Instructions:** Update 6→7 agents and 27→30 skills everywhere in these docs; add `dh-security-auditor` and the three skills with accurate descriptions; keep the existing matrix style and anchors.
- **Acceptance Criteria:** Docs consistently say 7/30/37; agent selection lists Security; link check passes; no stale 6/27 claims remain in the active docs.
- **Cautionary Points (Risks & Edge Cases):** Avoid duplicating the standards matrix in README; link the skill references instead.
- **Implementation Suggestions:** Use a single inventory table and link to it; keep AGENTS.md role summary concise.
- **Testing Suggestions:** `node scripts/check-links.mjs`; `rg "6 agents|27 skills|33-name"` on active docs.
- **Done When:** A new user can find and select the security capability from docs and agent selection.

#### Sub-Task 4.3: Run dh-setup to generate this project's security profile and standards selection

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Parallelizable:** no
- **Depends on:** 2.4, 4.2
- **Files/Scope:** `docs/security/**`
- **Isolation:** shared
- **Objective:** Exercise the new `dh-setup` security-profile workflow on this repository and produce the profile the audit/self-audit will consume.
- **Related Requirements:** R13, R14, AC7
- **Dependencies and Preconditions:** `dh-setup` extension and docs complete.
- **In Scope for This Sub-Task:** Run `dh-setup` in profile mode (with consent) to detect this repo's surfaces (TypeScript plugin, MCP server, TUI, agentic assets, CI/Node), interview/record data classification and compliance assumptions, write `docs/security/security-profile.md` and `docs/security/standards.selection.md` (or lock), and verify `dh-security-audit` reads them.
- **Out of Scope for This Sub-Task:** Active probing, installing security tools, changing runtime code.
- **Instructions:** Use the `dh-setup` skill; mark the profile as dev/internal tooling with no production customer data unless the user says otherwise; select ASVS/API/MCP/agentic and supply-chain controls that actually apply; record excluded standards and a review date. This is the explicit `dh-setup` delegation for standards customization.
- **Acceptance Criteria:** Profile and selection files exist with frontmatter, detected surfaces, selected versions, exclusions and review date; audit dry-run consumes them; missing/stale behavior documented.
- **Cautionary Points (Risks & Edge Cases):** Do not over-classify a dev plugin as PCI/SOC 2 scope; do not claim compliance; keep the profile editable and project-owned.
- **Implementation Suggestions:** Keep this repo's profile compact: MCP/TUI/agentic surface, ASVS/API/MCP/agentic/supply-chain rows, no mobile/desktop unless detected.
- **Testing Suggestions:** `node scripts/check-links.mjs`; audit dry-run; `dh-setup` idempotent re-run.
- **Done When:** This repo has a valid profile/selection that the security audit reads.

### Phase 5: Validation and read-only self-audit

- **Status:** Completed
- **Parallelizable:** no
- **Depends on:** 4

#### Sub-Task 5.1: Run the full asset and QA validation gate

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** no
- **Depends on:** 4.1, 4.2
- **Files/Scope:** `reports/**`, `docs/plans/security-auditor-agent/tasks/**`
- **Isolation:** shared
- **Objective:** Prove the plugin still builds, registers and passes every quality gate with the new assets.
- **Related Requirements:** R3, R9, R11, AC1, AC6
- **Dependencies and Preconditions:** Inventory and docs integrated.
- **In Scope for This Sub-Task:** Run `pnpm build`, `pnpm test`, `pnpm typecheck`, Biome, Knip, jscpd, dependency-cruiser, link check, `pnpm run audit`, smoke-load/MCP/install/pack, and `pnpm qa:check:full`; record exact results.
- **Out of Scope for This Sub-Task:** Fixing unrelated pre-existing failures or changing feature scope.
- **Instructions:** Run from the repo root; stop on the first unexplained failure; record commands and outcomes; do not weaken checks to pass.
- **Acceptance Criteria:** All gates pass; 7/30/37 asserted; no secrets/dead links/over-limit skills; output recorded.
- **Cautionary Points (Risks & Edge Cases):** Docker-based scans may need network; record skips explicitly.
- **Implementation Suggestions:** Use `dh-execute-cli` with logged output; run smokes after build.
- **Testing Suggestions:** `pnpm qa:check:full`.
- **Done When:** A complete green gate is recorded with commands and counts.

#### Sub-Task 5.2: Run the new audit workflow on this plugin read-only

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Parallelizable:** no
- **Depends on:** 4.3, 5.1
- **Files/Scope:** `docs/plans/security-auditor-agent/tasks/security-self-audit.md`
- **Isolation:** shared
- **Objective:** Exercise the new audit and threat-model workflows against this plugin without active probing or runtime changes.
- **Related Requirements:** R11, R14, AC5, AC7
- **Dependencies and Preconditions:** New skills exist and pass validation; the project security profile exists.
- **In Scope for This Sub-Task:** Read-only static audit of the MCP server, TUI and plugin asset pipeline; threat model of the agentic/MCP surface; findings with severity/control/evidence; coverage statement.
- **Out of Scope for This Sub-Task:** Network probing, production targets, exploit development, code fixes.
- **Instructions:** Start from `docs/security/security-profile.md` and `standards.selection.md`; use `dh-security-audit` + `dh-threat-model`; scope to the local repo; treat the plugin's own MCP tools as the agentic surface; record at least one concrete observation or a coverage-qualified no-findings result.
- **Acceptance Criteria:** `security-self-audit.md` exists with scope, method, findings (or qualified none), standards mapping and residual risk.
- **Cautionary Points (Risks & Edge Cases):** Do not expose secrets from test fixtures; do not run the MCP server against external services.
- **Implementation Suggestions:** Focus on tool input validation, symlink/path ACL, TOON restoration, subagent delegation and plugin asset loading.
- **Testing Suggestions:** Cross-check findings against existing tests; link the report.
- **Done When:** The new workflow has produced a usable, reviewed report.

#### Sub-Task 5.3: Write evolution and observation notes and close the plan

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Parallelizable:** no
- **Depends on:** 5.1, 5.2
- **Files/Scope:** `docs/evolution/**`, `docs/plans/security-auditor-agent/**`, `docs/plans/index.md`
- **Isolation:** shared
- **Objective:** Capture the capability's evolution/observation notes and close the plan record.
- **Related Requirements:** R11, AC6
- **Dependencies and Preconditions:** Validation and self-audit complete.
- **In Scope for This Sub-Task:** Evolution note, observation note, `docs/evolution/index.md`, plan execution record, plan index row.
- **Out of Scope for This Sub-Task:** New features or code changes.
- **Instructions:** Follow `dh-create-documentation`; record what changed, evidence, decisions, residual risks and follow-ups; do not overstate certification or coverage.
- **Acceptance Criteria:** Notes registered and linked; plan record complete; no broken links.
- **Cautionary Points (Risks & Edge Cases):** Keep secrets/PII out; distinguish "designed" from "validated".
- **Implementation Suggestions:** Link the standards/tooling research, self-audit and QA results.
- **Testing Suggestions:** Link check; plan read/validation.
- **Done When:** Documentation and plan records are complete.

## Final Verification

### Plan-specific verification (copied from plan.md, unchanged)

- **System-Wide Test:** `pnpm qa:check:full` plus `node scripts/smoke-pack.mjs`; verify 7/30/37 inventory, registration, links and line limits; run `dh-setup` to generate this repo's security profile/standards selection; review the self-audit report for coverage and redaction.
- **Completion Checklist:** All sub-tasks Completed; all four assets present; standards matrix current and project-customized by `dh-setup`; negative probe gates tested; docs consistent; no secrets; evolution notes written.

### End gates (run once across plan end)

1. `dh-review` Plan Alignment Mode `phase: plan-end` → `tasks/review-fast-final.md`.
2. Execute the plan-specific System-Wide Test and Completion Checklist above.
3. `dh-simplify` + `dh-code-review` (software only).
4. `dh-domain-check` (architectural software plans only; otherwise not applicable).
5. `dh-preflight` + `dh-artifact-check`.
6. `dh-final-review` (reuse results; do not re-run preflight/artifact/semver).
7. `dh-create-documentation` + `dh-semver` (software only).
8. Append every outcome to `plan_fast_skip_checks.md` via `dh_plan_fast_skip_check`.
