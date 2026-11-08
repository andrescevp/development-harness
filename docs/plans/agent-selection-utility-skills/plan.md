---
title: Agent Selection and Utility Skills
slug: agent-selection-utility-skills
description: Replace hardcoded dh-agent delegation with runtime agent selection and migrate dh-executor/dh-explorer to dh-execute-cli/dh-explore skills.
created: 2026-11-08
updated: 2026-11-08
status: Completed
active: true
tags: [plan]
project: dev-harness-skills
---

# Plan: Agent Selection and Utility Skills

## Objective

Make every harness skill select the **best available agent** for each
delegated role instead of hardcoding bundled `@dh-*` agents. Project-specific
agents must win over harness fallbacks. Migrate `dh-executor` and
`dh-explorer` from agents to the `dh-execute-cli` and `dh-explore` skills,
delete their agent files, and align every reference, count, test, and doc.

## Requirements Snapshot

- **R1:** Shared agent-selection protocol reference with discovery, ranking, fallback, and recording rules.
- **R2:** `dh-planning` selects the best architecture/engineering agents and records `## Agent Selection`.
- **R3:** All delegating skills use the protocol; no hardcoded `@dh-*` in skill bodies.
- **R4:** `dh-executor` → `dh-execute-cli` skill; `dh-explorer` → `dh-explore` skill; agent files removed.
- **R5:** All `@dh-executor`/`@dh-explorer` references become skill references.
- **R6:** Planning, execution, review, final review, docs, setup, semver, preflight, and artifact-check behavior is preserved.
- **R7:** Inventory becomes 5 agents / 24 skills (29 unique names); all counts/tests/scripts/reports updated.
- **R8:** AGENTS, README, LOADING, skills index, demo docs, and examples explain the protocol and new skills.
- **R9:** Selection is inspectable and deterministic for a run; execution re-validates availability.
- **R10:** Validation proves zero hardcoded `@dh-*` in skills, removed agent files gone, 5/24 counts, and full gates pass.

## Scope

- In scope: selection reference and plan section; planning/execution/review/docs/setup/semver/preflight/artifact skills; utility skills; agent files; inventory/tests/scripts/docs; audit reports.
- Out of scope: renaming `dh-` IDs, MCP tools/server, CLI/package/env; aliases for removed agents; changing the plan status model or MCP behavior; rewriting historical plans.

## Assumptions and Constraints

- Skill/agent IDs keep the `dh-` prefix; only hardcoded **agent references** are removed from skills.
- Agent discovery uses the runtime agent list first, then project config/directories; if enumeration is unavailable, state the limitation.
- Bundled harness agents remain available as capability fallbacks but are not named in skill delegation prose.
- The plan's `## Agent Selection` table is authoritative for that plan; if absent or stale, execution reruns the protocol.
- Hard cut for `dh-executor`/`dh-explorer`: no aliases.
- Skill files stay ≤250 lines; the plan template/scaffold remain parser-compatible.

## Risks and Areas Requiring Care

- Ambiguous or tied agent choices → prefer the more specific agent, record rationale, ask when tied.
- No enumerable agents → inspect config/directories and record the limitation; never invent an agent.
- Missing project and fallback agents → stop and report the missing capability.
- Stale `@dh-executor`/`@dh-explorer` references → repo-wide `rg` gate and contract test.
- Count drift 7→5 agents and 22→24 skills (unique names stay 29) → update every explicit count and smoke check.
- Stale plan agent choices → execution re-validates the selected agent and records changes.
- Fast-plan alignment lists must treat `## Agent Selection` as an intentionally omitted top-level section.

## Core concepts

**Selection is data, not prose.** A skill states the capability it needs
("architecture", "implementation", "review", "final sign-off", "documentation")
and the selection protocol resolves that capability against the environment's
agents. The chosen agent and fallback are recorded in the plan's
`## Agent Selection` table, so execution is reviewable and deterministic.

**Utility roles are skills.** Command execution and codebase exploration do
not need selectable personas: they are instruction layers that any executing
agent can follow. `dh-execute-cli` and `dh-explore` replace the two agents and
their behavior is preserved.

## Phases

### Phase 1: Agent-selection contract

- **Status:** Completed

#### Sub-Task 1.1: Author the agent-selection protocol

- **Status:** Completed
- **Objective:** Define how skills discover, rank, select, record, and re-validate agents.
- **Related Requirements:** R1, R2, R9
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:** `skills/dh-planning/references/agent-selection.md` with discovery sources (runtime agent list, project config, `.opencode/agents`, global agents), capability roles (architecture, implementation, review, final review, documentation, testing/QA), preference rules (project-specific > specialized > bundled fallback), tie handling, recording table, re-validation, and failure behavior.
- **Out of Scope for This Sub-Task:** Skill body edits, inventory counts, agent deletion.
- **Instructions:** Define a capability-first protocol; prefer descriptions/project instructions over name matching; list the fallback capabilities without hardcoding `@dh-*` IDs; explain how to record `None — no specialized agent required`; include a worked `## Agent Selection` table with a project agent and a generic fallback.
- **Acceptance Criteria:** Protocol covers discovery, ranking, ties, fallback, recording, and re-validation; no hardcoded `@dh-*`; reference ≤250 lines.
- **Cautionary Points (Risks & Edge Cases):** Do not invent agents; do not treat name similarity as capability; do not silently fall back when a plan names a missing agent.
- **Implementation Suggestions:** Model the table on the plan template; include a short decision flow and a selection-record example.
- **Testing Suggestions:** Read-through; `rg "@dh-"` in the reference → zero.
- **Done When:** The protocol is complete, self-contained, and referenced by the planning sub-task.

#### Sub-Task 1.2: Add `## Agent Selection` to the plan template

- **Status:** Completed
- **Objective:** Give plans a canonical place to record selected agents and fallbacks.
- **Related Requirements:** R2, R7, R9
- **Dependencies and Preconditions:** Sub-Task 1.1.
- **In Scope for This Sub-Task:** `skills/dh-planning/references/phased-plan-template.md`, `src/tools/plan-template.ts`, `src/__tests__/fixtures/plans/phased-plan.md`, and the fast-plan omitted-section lists (`skills/dh-execute-plan-fast/SKILL.md`, `references/plan-fast-template.md`, `skills/dh-review/SKILL.md`, `src/tools/plan-fast-template.ts`).
- **Out of Scope for This Sub-Task:** Planning workflow text, counts, agent deletion.
- **Instructions:** Add a `## Agent Selection` table before `## Phases` with columns Role, Selected agent, Why, Fallback; default to `None — no specialized agent required` in the scaffold/fixture; add the section to the fast omitted lists and renderer constant so fast alignment does not flag it.
- **Acceptance Criteria:** Template, scaffold, and fixture agree; parser accepts the section; `## Agent Selection` appears in all fast omitted lists; tests for the renderer reflect it.
- **Cautionary Points (Risks & Edge Cases):** Keep parser markers intact; do not introduce dead links; do not make the section mandatory when no delegation is needed.
- **Implementation Suggestions:** Use a compact table; put the section after `## Visual Context` and before `## Phases`.
- **Testing Suggestions:** `parsePlan` on the fixture; renderer test; plan-fast contract test.
- **Done When:** Plans can record agent choices and fast alignment ignores the section.

#### Sub-Task 1.3: Update `dh-planning` to select and record agents

- **Status:** Completed
- **Objective:** Make planning inspect available agents and remove hardcoded agent delegation.
- **Related Requirements:** R1, R2, R3, R9
- **Dependencies and Preconditions:** Sub-Tasks 1.1 and 1.2.
- **In Scope for This Sub-Task:** `skills/dh-planning/SKILL.md` Core Rules, project-type section, workflow, Final Check, and references.
- **Out of Scope for This Sub-Task:** Execution/review/docs skills, counts.
- **Instructions:** Replace `@dh-software-architect`/`@dh-software-engineer` delegation with the selection protocol; inspect the runtime/config list; choose the best architecture/engineering/testing agents; record them in `## Agent Selection`; state the fallback generically; remove all `@dh-*` mentions.
- **Acceptance Criteria:** `dh-planning` references the protocol, populates `## Agent Selection`, and contains zero `@dh-*`; the planning workflow explains when selection happens.
- **Cautionary Points (Risks & Edge Cases):** Do not hardcode fallbacks; do not select an agent not present; record ties/limitations.
- **Implementation Suggestions:** Add a "Select agents" workflow step before delegation; reuse the reference table.
- **Testing Suggestions:** `rg "@dh-" skills/dh-planning/SKILL.md` → zero; review against the protocol.
- **Done When:** Planning is selection-driven and auditable.

### Phase 2: Utility agent-to-skill migration

- **Status:** Completed

#### Sub-Task 2.1: Create the `dh-execute-cli` skill

- **Status:** Completed
- **Objective:** Preserve executor behavior as a skill instead of an agent.
- **Related Requirements:** R4, R6
- **Dependencies and Preconditions:** Sub-Task 1.1 (selection context).
- **In Scope for This Sub-Task:** New `skills/dh-execute-cli/SKILL.md` from `agents/dh-executor.md`; delete `agents/dh-executor.md`.
- **Out of Scope for This Sub-Task:** Other agent files, counts, docs.
- **Instructions:** Adapt the executor rules: execute only what is asked; never fix or suggest; use the `dh_logged_command` MCP tool (or manual temp-log head/tail fallback); report exit code, key failure, files/lines, and log path; compact output; least privilege. Make it a skill (frontmatter name/license/compatibility/allowed-tools/metadata).
- **Acceptance Criteria:** Skill exists and loads; executor behavior and safety rules preserved; agent file removed; no `@dh-*` references.
- **Cautionary Points (Risks & Edge Cases):** Do not turn the skill into an agent; do not weaken the logged-command strategy; no full logs.
- **Implementation Suggestions:** Reuse the agent body, convert "on behalf of another agent" to "when invoked by a caller".
- **Testing Suggestions:** Frontmatter parse; `rg "@dh-"` → zero; skill asset loader.
- **Done When:** Executor behavior is available as `dh-execute-cli` and the agent file is gone.

#### Sub-Task 2.2: Create the `dh-explore` skill

- **Status:** Completed
- **Objective:** Preserve explorer behavior as a skill instead of an agent.
- **Related Requirements:** R4, R6
- **Dependencies and Preconditions:** Sub-Task 1.1.
- **In Scope for This Sub-Task:** New `skills/dh-explore/SKILL.md` from `agents/dh-explorer.md`; delete `agents/dh-explorer.md`.
- **Out of Scope for This Sub-Task:** Other agent files, counts, docs.
- **Instructions:** Adapt the exploration rules: smallest search first, glob/grep/targeted reads, batch, ignore generated dirs, stop when evidence supports the answer, summarize with exact file refs, no edits/secrets/destructive commands.
- **Acceptance Criteria:** Skill exists and loads; exploration behavior/safety preserved; agent file removed; no `@dh-*` references.
- **Cautionary Points (Risks & Edge Cases):** Do not broaden scans; do not read secrets; do not edit files.
- **Implementation Suggestions:** Reuse the agent body, convert to invocation instructions.
- **Testing Suggestions:** Frontmatter parse; `rg "@dh-"` → zero; asset loader.
- **Done When:** Exploration is available as `dh-explore` and the agent file is gone.

#### Sub-Task 2.3: Replace executor/explorer references

- **Status:** Completed
- **Objective:** Point every old agent reference at the new skills.
- **Related Requirements:** R5, R8
- **Dependencies and Preconditions:** Sub-Tasks 2.1 and 2.2.
- **In Scope for This Sub-Task:** All skills, agents, AGENTS/README/index docs containing `@dh-executor` or `@dh-explorer`.
- **Out of Scope for This Sub-Task:** Other `@dh-*` agent references (Phase 3), counts.
- **Instructions:** Replace `@dh-executor` with `dh-execute-cli` and `@dh-explorer` with `dh-explore`; adjust grammar ("use the skill", "run via the skill"); do not leave `@`-prefixed old names.
- **Acceptance Criteria:** `rg "@dh-executor|@dh-explorer"` → zero; new skill references resolve; no behavior change.
- **Cautionary Points (Risks & Edge Cases):** Do not mechanically replace inside historical plan files; do not confuse the `dh` MCP server with an agent.
- **Implementation Suggestions:** Work file-by-file; run the rg gate after each group.
- **Testing Suggestions:** `rg` gate; `node scripts/check-links.mjs`.
- **Done When:** No old utility-agent references remain.

### Phase 3: Delegation cleanup

- **Status:** Completed

#### Sub-Task 3.1: Execution and review delegation

- **Status:** Completed
- **Objective:** Remove hardcoded implementation/review/final-review agents from execution skills.
- **Related Requirements:** R3, R6, R9
- **Dependencies and Preconditions:** Phase 1 and Sub-Task 2.3.
- **In Scope for This Sub-Task:** `skills/dh-execute-plan/SKILL.md`, `dh-execute-plan-task/SKILL.md`, `dh-execute-plan-fast/SKILL.md`, `dh-execute-plan-task-fast/SKILL.md`, `dh-review/SKILL.md`, `dh-final-review/SKILL.md`, `dh-simplify/SKILL.md`.
- **Out of Scope for This Sub-Task:** Docs/setup/semver/preflight/artifact skills, counts.
- **Instructions:** Read `## Agent Selection`; if absent, run the selection protocol; use the selected implementation/review/final-review agent; fall back generically to the bundled capability; validation uses `dh-execute-cli`; remove all `@dh-*`; keep single-executor semantics (one selected implementation agent per task, no builder split).
- **Acceptance Criteria:** No `@dh-*`; selected-agent flow documented; validation via skill; review/final-review selection; fast variants aligned.
- **Cautionary Points (Risks & Edge Cases):** Do not hardcode fallbacks; do not allow multiple implementation agents per sub-task; preserve phase/status rules.
- **Implementation Suggestions:** Add a "Resolve agent" step; reference the selection table.
- **Testing Suggestions:** `rg "@dh-"` in the files → zero; targeted skill tests; `dh-review` alignment mode unaffected.
- **Done When:** Execution/review skills are agent-agnostic and selection-driven.

#### Sub-Task 3.2: Docs, setup, semver, preflight, artifact, and footers

- **Status:** Completed
- **Objective:** Remove hardcoded documentation and utility-agent delegation from the remaining skills.
- **Related Requirements:** R3, R6, R8
- **Dependencies and Preconditions:** Phase 1 and Sub-Task 2.3.
- **In Scope for This Sub-Task:** `dh-create-documentation`, `dh-setup`, `dh-semver`, `dh-preflight`, `dh-artifact-check`, `dh-pause-plan`, `dh-resume-plan`, `dh-mermaid`, `dh-planning` footers, and the repeated "Doc search" footer across skills.
- **Out of Scope for This Sub-Task:** Execution/review skills (3.1), counts.
- **Instructions:** Replace `@dh-documentor` with the selection protocol (best documentation agent, bundled fallback); use `dh-execute-cli` for commands; update `dh-setup`'s delegation table to capabilities + skills; remove all `@dh-*`.
- **Acceptance Criteria:** No `@dh-*` in these skills; docs delegation is capability-based; command execution uses `dh-execute-cli`; footers consistent.
- **Cautionary Points (Risks & Edge Cases):** Do not lose the documentation ownership rule (plans excluded); do not weaken command logging.
- **Implementation Suggestions:** Use the same generic footer everywhere; keep the "documentation owner" concept without an agent ID.
- **Testing Suggestions:** `rg "@dh-"` across skills → zero; link check.
- **Done When:** Remaining skills are agent-agnostic.

#### Sub-Task 3.3: Update agent definitions and harness docs

- **Status:** Completed
- **Objective:** Align the remaining agents and top-level docs with selection and utility skills.
- **Related Requirements:** R4, R8
- **Dependencies and Preconditions:** Sub-Tasks 2.1–2.3 and 3.1–3.2.
- **In Scope for This Sub-Task:** Remaining `agents/*.md`, `AGENTS.md`, `README.md`, `docs/LOADING.md`, `skills/index.md`.
- **Out of Scope for This Sub-Task:** Counts (Phase 4), historical plans.
- **Instructions:** Remove executor/explorer from agent lists; add `dh-execute-cli`/`dh-explore` to skill lists; document the selection protocol and plan `## Agent Selection`; update delegation tables to capabilities, not IDs.
- **Acceptance Criteria:** Docs explain selection; agent count list is 5; skill list includes the two new skills; no stale executor/explorer agent claims.
- **Cautionary Points (Risks & Edge Cases):** Keep the `dh` MCP/tool references; do not rename IDs; preserve Git Flow docs.
- **Implementation Suggestions:** Update role summaries and delegation sections together.
- **Testing Suggestions:** `rg` for executor/explorer agent claims; link check.
- **Done When:** Top-level docs match the new model.

### Phase 4: Inventory, tests, and docs

- **Status:** Completed

#### Sub-Task 4.1: Update inventory counts and smoke checks

- **Status:** Completed
- **Objective:** Make the bundle contract 5 agents / 24 skills everywhere.
- **Related Requirements:** R7, R10
- **Dependencies and Preconditions:** Phases 1–3.
- **In Scope for This Sub-Task:** `src/cli/plugin-artifact.ts` (`EXPECTED_AGENT_COUNT=5`, `EXPECTED_SKILL_COUNT=24`), `scripts/lib/shared.mjs` LOOP lists, `scripts/lib/install-smoke-checks.mjs`, `pack-install.mjs`, `smoke-pack.mjs`, `docker-test.sh`, `pack-contract.mjs`, `src/plugin.ts`, tests and fixtures.
- **Out of Scope for This Sub-Task:** Docs prose (4.3), contract test (4.2).
- **Instructions:** Change agent/skill counts; keep unique names 29; update regexes/messages; update `install-harness` fixture counts; ensure build assets 5/24.
- **Acceptance Criteria:** All explicit counts 5/24; tests/smokes accept the new inventory; no stale 7/22 claims.
- **Cautionary Points (Risks & Edge Cases):** Unique-name set stays 29; do not change tool count (12); update smoke failure messages.
- **Implementation Suggestions:** Use a repo-wide count inventory first; edit by file family.
- **Testing Suggestions:** `pnpm test`, `pnpm build`, smokes.
- **Done When:** Inventory contract is 5/24.

#### Sub-Task 4.2: Add the agent-selection contract test

- **Status:** Completed
- **Objective:** Guard the new model against regressions.
- **Related Requirements:** R1–R5, R10
- **Dependencies and Preconditions:** Phases 1–3 and 4.1.
- **In Scope for This Sub-Task:** New `src/__tests__/agent-selection.test.ts`.
- **Out of Scope for This Sub-Task:** Source behavior changes.
- **Instructions:** Assert `rg`-style zero `@dh-` in `skills/`; `agents/dh-executor.md`/`dh-explorer.md` absent; new skills exist/parse; planning references the protocol and `## Agent Selection`; plan template/scaffold/fixture include the section; fast omitted lists include it; counts 5/24; docs mention the new skills.
- **Acceptance Criteria:** Test fails on a reintroduced `@dh-*`, removed skill, restored agent file, or count drift; ≤220 lines.
- **Cautionary Points (Risks & Edge Cases):** Use structural assertions; exclude historical `docs/plans/**`; don't assert exact prose.
- **Implementation Suggestions:** Read the real corpus; use `fs` and `parseFrontmatter`.
- **Testing Suggestions:** Run the test in isolation, then full suite.
- **Done When:** The model is guarded.

#### Sub-Task 4.3: Update documentation counts and tables

- **Status:** Completed
- **Objective:** Remove stale 7-agent/22-skill claims and document the new skills.
- **Related Requirements:** R8, R10
- **Dependencies and Preconditions:** Sub-Tasks 3.3 and 4.1.
- **In Scope for This Sub-Task:** `README.md`, `AGENTS.md`, `docs/LOADING.md`, `skills/index.md`, `demo-project/docs/index.md`, `opencode.example.jsonc`, and `reports/audit.*`.
- **Out of Scope for This Sub-Task:** Historical plans/reports.
- **Instructions:** Update counts to 5 agents / 24 skills; add `dh-execute-cli`/`dh-explore` rows; remove executor/explorer agent rows; document selection; regenerate audit reports.
- **Acceptance Criteria:** No active-surface 7-agent/22-skill claims; docs list 5/24 and the new skills; audit reports reflect 5/24.
- **Cautionary Points (Risks & Edge Cases):** Do not rewrite historical plans; keep tool count 12.
- **Implementation Suggestions:** Edit tables and counts together; run the stale-count grep.
- **Testing Suggestions:** `rg` gate; link check; audit.
- **Done When:** Docs are consistent.

### Phase 5: Validation and release

- **Status:** Completed

#### Sub-Task 5.1: Run the full validation gates

- **Status:** Completed
- **Objective:** Prove the rename/migration has no regressions.
- **Related Requirements:** R10
- **Dependencies and Preconditions:** Phases 1–4.
- **In Scope for This Sub-Task:** `rg "@dh-" skills/` → zero; `rg "@dh-executor|@dh-explorer"` → zero; agent files absent; full `pnpm qa:check:full` (with the known `scan:deps` exception), tests, typecheck, build, smokes, audit.
- **Out of Scope for This Sub-Task:** New features.
- **Instructions:** Run the gates; fix in-scope failures; record the accepted dependency-scan exception.
- **Acceptance Criteria:** All gates green except the documented pre-existing scan; no stale references; 5/24 inventory.
- **Cautionary Points (Risks & Edge Cases):** Docker/network blockers; do not weaken checks.
- **Implementation Suggestions:** Use the repo scripts as-is; capture logs.
- **Testing Suggestions:** Command output/exit codes.
- **Done When:** Release gate is green or a blocker is escalated.

#### Sub-Task 5.2: Final review and merge

- **Status:** Completed
- **Objective:** Sign off and integrate the change.
- **Related Requirements:** R10
- **Dependencies and Preconditions:** Sub-Task 5.1.
- **In Scope for This Sub-Task:** Final review, documentation/evolution notes, plans index update, merge into `develop`.
- **Out of Scope for This Sub-Task:** Tagging without approval.
- **Instructions:** Run `dh-final-review`, update the plan/index, merge with `--no-ff`, push.
- **Acceptance Criteria:** Approve/approve-with-comments; plan and index complete; develop synced.
- **Cautionary Points (Risks & Edge Cases):** Do not mark complete around P0/P1; no premature tag.
- **Implementation Suggestions:** Follow the harness release loop.
- **Testing Suggestions:** Final review verdict + gate evidence.
- **Done When:** Merged and reported.

## Final Integration & Verification

- **System-Wide Test:** `rg` gates, full tests/build/smokes/audit, and the agent-selection contract test.
- **Completion Checklist:** 5 agents / 24 skills; no `@dh-*` in skills; utility agent files gone; planning records `## Agent Selection`; docs consistent; final review approved.

## Open Questions

- Should `## Agent Selection` be mandatory for every plan or only when delegation is needed? Default: include when needed; write `None — no specialized agent required` otherwise.
- If a project agent is selected but unavailable at execution, should the run stop or fall back automatically? Default: stop and ask; the plan's choice is part of the contract.
