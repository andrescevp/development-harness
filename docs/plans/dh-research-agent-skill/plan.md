---
title: Web Research Agent and Skill (dh-researcher + dh-research)
slug: dh-research-agent-skill
description: Add a source-cited web research capability to the harness, with one docs/research registry and optional execution unblock integration.
created: 2026-11-16
updated: 2026-11-16
status: Completed
active: true
tags: [plan, research]
project: dev-harness-skills
---

# Plan: Web Research Agent and Skill (dh-researcher + dh-research)

## Objective

Port the intent of PR #4 onto the current `develop` corpus: add a sixth bundled
agent (`dh-researcher`) and a twenty-seventh skill (`dh-research`) that answer
external-fact questions with cited evidence, keep every research note in one
workspace registry (`docs/research/`), and give execution an optional bounded
unblock step without weakening the hard-blocker halt policy. The result must
leave the corpus, tests, audit surface, CLI/package expectations, and project
docs consistent at 6 agents + 27 skills.

**PR #4 review resolution.** Review comment 1 (single source of truth) is
resolved by R3–R5: notes live only at `docs/research/<topic>.md`,
`docs/research/index.md` is the registry, plans link the folder through
`## Research`, and the documentation agent owns writes. Review comment 2
(execution integration) is resolved by R6: one optional research-unblock line
in `dh-execute-plan-task(-fast)` when browsing exists; the research assets drop
the “loop step 2.4” framing entirely. The PR branch itself is not updated; its
7-agent references (`@dh-explorer`, `@dh-executor`) are ported to the current
skills (`dh-explore`, `dh-execute-cli`).

## Requirements Snapshot

- **R1:** Bundle `dh-researcher` as the sixth agent with web-research rules:
  one question per pass, primary sources first, claim → source URL + retrieval
  date, explicit confidence labels, honest tool availability, no code edits.
- **R2:** Bundle `dh-research` as the twenty-seventh skill defining the bounded
  workflow, note template, and report-back contract.
- **R3:** Single source of truth: `{workspace_root}/docs/research/<topic>.md`
  plus `{workspace_root}/docs/research/index.md`; plan-local
  `docs/plans/<slug>/research/` is rejected and redirected.
- **R4:** Plans may link notes through an optional `## Research` section outside
  `## Phases`; the fast mirror omits that section intentionally.
- **R5:** The documentation agent owns writes to `docs/research/` and the
  index; the researcher composes the payload and the caller persists it.
- **R6:** `dh-execute-plan-task` and `dh-execute-plan-task-fast` each carry one
  optional research-unblock instruction, gated on browsing availability; an
  unresolved blocker still halts.
- **R7:** `dh-planning`, `dh-grill-sdd`, and `dh-contingency` may delegate
  external-fact questions and must cite the resulting notes; contingency must
  not rate alternatives on unverified recollection.
- **R8:** Corpus metadata, tests, audit loop membership, CLI expectations, and
  package smokes reflect 6 agents + 27 skills (33 unique names).
- **R9:** No new dependencies, tool/command/prompt registrations, or changes to
  the hard-blocker policy; the existing QA gate stays green.
- **AC1:** The two new assets parse, register, and produce 6 agents + 27 skills.
- **AC2:** `docs/research/index.md` exists; research assets point there and
  reject plan-local paths.
- **AC3:** Plan template, scaffold, and canonical fixture expose `## Research`;
  the fast renderer lists it as an allowed omission.
- **AC4:** Both execution task skills carry exactly one optional research line;
  research assets contain no “loop step 2.4” framing.
- **AC5:** Planning, SDD, and contingency skills delegate and cite research.
- **AC6:** All inventory surfaces report 6 / 27 / 33.
- **AC7:** Tests, typecheck, build, audit, link check, and plugin/MCP smokes pass.
- **AC8:** README, AGENTS.md, skills index, LOADING, CHANGELOG, and close-out
  notes describe the capability and ownership boundary.

## Scope

- New `agents/dh-researcher.md` and `skills/dh-research/SKILL.md`.
- `docs/research/index.md` registry plus the documentation-root contract entry.
- Optional `## Research` plan section in template/scaffold/fixture/fast renderer.
- One optional unblock line in both execution task skills.
- Research delegation in planning, SDD interview, and contingency analysis.
- Inventory counts, tests, audit membership, CLI/package constants, docs,
  changelog, and close-out notes.
- Ports PR #4 intent onto `develop`; PR #4 itself is **not** updated.

## Workspace Impact

- **Workspace root:** `None — standalone repository`
- **Affected packages:** `None — standalone`
- **Shared paths:** `agents/`, `skills/`, `src/`, `scripts/`, `docs/`,
  `AGENTS.md`, `README.md`, `CHANGELOG.md`, `reports/`

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| None — standalone repository | Markdown assets + TypeScript | `pnpm test` | `pnpm build` | `docs/` | fixed |

## Assumptions and Constraints

- Current `develop` (5 agents + 26 skills) is the integration base; PR #4 is a
  design reference only and its branch is not touched.
- The host exposes `webfetch` and `websearch` or a search-capable MCP. When no
  browsing tool exists, research fails loudly; it never fabricates an answer.
- The documentation agent is available for persistence; if nested delegation is
  unavailable, the researcher returns the payload to the caller, who persists
  it through `dh-create-documentation`.
- `docs/research/` is empty today; the registry starts with no note rows.
- Bundled agents ship without `permission`/`tools` frontmatter; no commands,
  prompts, or tools are registered by this change.
- Skill and agent files stay within the 250/300-line audit limits.
- Domain/SOLID pre-check: [domain-check.md](./tasks/domain-check.md) — clear to
  proceed; the ownership handoff and count sweep are the tracked cautions.

**Rejected alternatives:**

- **Rebase/update PR #4** — the branch conflicts with `develop`, its text
  targets 7 agents (`@dh-explorer`, `@dh-executor`) that are now skills, and a
  fresh port is smaller and reviewable. PR #4 stays as design input.
- **Researcher writes `docs/research/` directly** — conflicts with the
  documentation-ownership contract. The researcher composes; the documentation
  agent persists.
- **Plan-local research folders** — rejected by the PR review: one registry at
  `docs/research/` with plans linking into it.
- **Research as a new loop step 2.4** — rejected by the PR review: one optional
  line in `dh-execute-plan-task(-fast)`, with the existing halt unchanged.
- **New search MCP or dependency** — use the host’s `webfetch`/`websearch` (or
  an already configured search MCP); no dependency change.

## Risks and Areas Requiring Care

- **Ownership ambiguity:** the researcher must not write `docs/research/`
  directly; the handoff to the documentation agent (or caller) is explicit.
- **Halt-policy erosion:** the optional research line must not become a license
  to continue past an unresolved blocker.
- **Count drift:** five test files, CLI constants, package smokes, and project
  docs assert the old inventory; sweep them together.
- **Path drift:** any plan-local `research/` path reintroduces a second source
  of truth and violates the PR review.
- **Link breakage:** plan links resolve relative to
  `docs/plans/<slug>/plan.md` (`../../research/<topic>.md`); dead links fail
  `lint:links`.
- **Source quality:** aggregators and stale docs mislead; primary sources and
  retrieval dates are mandatory, conflicts are reported, not hidden.
- **Topic collisions:** the index is the registry; update or disambiguate an
  existing topic instead of silently overwriting it.
- **Fast mirror:** `## Research` is outside the phases region and omitted from
  `plan_fast.md`; the fast task reads the source plan when it needs the links.

## Core concepts

**Research note contract.** A note is evidence, not documentation prose. It
carries frontmatter plus the question, caller, date, tools used, findings table,
implications, sources, and confidence. The canonical shape:

```markdown
# Research: [topic]

- **Question:** [one question]
- **Caller:** [skill/agent]
- **Date:** [YYYY-MM-DD]
- **Tools used:** [webfetch | search MCP | none]

## Findings

| # | Claim | Source (URL + retrieval date) | Confidence |
|---|---|---|---|
| 1 | [claim] | https://… (2026-11-15) | verified / partially verified / model knowledge |

## Implications

- [What changes for the plan, sub-task, or blocker decision]

## Sources

- [URL list with retrieval dates]
```

The markdown heading is optional when the file carries the documentation
frontmatter; the required content is the six fields above.

**Registry.** `docs/research/index.md` is newest-first and is the only index:

```markdown
| Date | Topic | Question | Confidence | Used by | Note |
|---|---|---|---|---|---|
| 2026-11-15 | node-eol | When does Node 20 reach EOL? | verified | plan: example | [node-eol](./node-eol.md) |
```

**Ownership handoff.** `dh-researcher` browses, verifies, and composes the note
payload plus the proposed index row. The calling workflow hands that payload to
the documentation agent (`dh-create-documentation`), which writes
`docs/research/<topic>.md`, updates `docs/research/index.md`, and adds or
updates the active plan’s `## Research` links. The researcher never edits code,
runs project commands, or writes outside the research registry.

**Plan section.** `## Research` sits after `## Visual Context` and before
`## Agent Selection`, outside the phases region:

```markdown
## Research

- [Node 20 EOL](../../research/node-eol.md) — verified 2026-11-15; drives R4.
```

**Optional execution unblock.** Both execution task skills get one line: when a
blocker depends on current external facts and browsing tools exist, one bounded
cited research pass may precede the report. If the evidence does not resolve
the blocker, the sub-task still stops for guidance.

**Inventory delta.** 5 agents → 6, 26 skills → 27, 31 unique names → 33.

## Visual Context

- [Diagram index](./diagrams/index.md)
- [Current state](./diagrams/current-state.md)
- [Desired state](./diagrams/desired-state.md)
- [Critical changes](./diagrams/critical-changes.md)
- [Components](./diagrams/components.md)

## Research

None registered yet — the PR #4 review evidence is captured in the
Requirements Snapshot and SDD. Notes created during execution are linked here
once the registry exists.

## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Architecture | dh-software-architect | Owns the plan’s architectural shape: one research registry, ownership handoff, and execution integration. | bundled architecture capability |
| Implementation | dh-software-engineer | Bundled engineering agent; edits `agents/`, `skills/`, `src/`, `scripts/`, and the TDD suites. | bundled implementation capability |
| Documentation | dh-documentor | Owns generated docs outside `docs/plans`; writes `docs/research/index.md`, the project-doc sweep, and close-out notes. | bundled documentation capability |
| Review | dh-reviewer | Scoped review of each sub-task against its acceptance criteria. | bundled review capability |
| Final review | dh-final-reviewer | Plan-wide sign-off against requirements and gates. | bundled final-review capability |

## Phases

### Phase 1: Research assets and contract

- **Status:** Completed

#### Sub-Task 1.1: Create the dh-researcher agent asset

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add `agents/dh-researcher.md` as the sixth bundled agent, adapted from PR #4 to the current runtime (skills instead of removed agents, `docs/research/` SSOT, documentation-agent ownership, no loop-step-2.4 framing).
- **Related Requirements:** R1, R3, R5, R7, AC1, AC2
- **Dependencies and Preconditions:** SDD `docs/plans/dh-research-agent-skill/sdd.md` approved; current agent corpus understood.
- **In Scope for This Sub-Task:** `agents/dh-researcher.md` only.
- **Out of Scope for This Sub-Task:** The skill file, plan templates, doc indexes, tests, and count sweeps.
- **Instructions:**
  1. Read `agents/dh-reviewer.md` and `agents/dh-software-engineer.md` for the repo’s agent shape (frontmatter, Workspace First, Safety, Doc search footer).
  2. Create the file with `name: dh-researcher`, a folded `description`, and `mode: subagent`; do **not** add `permission` or `tools` keys.
  3. Body sections: Purpose; Workspace First (read `WORKSPACE.md`/`docs/WORKSPACE.md`, research root = workspace root); Operating Rules (one question, primary sources, citations + retrieval dates, confidence labels, honest tool availability, bounded one-pass research, report conflicts); Output & handoff (compose note payload + index row, hand to documentation agent/caller); Boundaries (no code, no commands, no writes; route coding to implementation and local evidence/commands to `dh-explore`/`dh-execute-cli` skills); Safety (no secrets/personal data, no fabricated citations); Doc search footer copied from the other assets.
  4. Remove every reference to `@dh-explorer`/`@dh-executor` and to “loop step 2.4”; those roles are skills and the research integration lives in `dh-execute-plan-task(-fast)`.
- **Acceptance Criteria:** File exists; frontmatter parses; `mode` is `subagent`; no `permission`/`tools`; no `docs/plans/<slug>/research/`; no “2.4”; ≤300 lines; least-privilege boundaries explicit.
- **Cautionary Points (Risks & Edge Cases):** Do not copy the PR text verbatim — it targets a 7-agent corpus. Do not let the agent write notes itself; the ownership handoff is mandatory. Keep tool availability honest rather than assuming web access.
- **Implementation Suggestions:** Reuse the Workspace First and Doc search blocks from an existing agent; keep the description trigger-oriented (planning, contingency, SDD, execution blockers, reviews) without naming removed agents.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/frontmatter.test.ts src/__tests__/assets.test.ts` (asset count will be updated in 2.3); `node scripts/audit.mjs` for frontmatter/name/secret checks.
- **Done When:** `agents/dh-researcher.md` exists, parses, and satisfies every acceptance criterion.

#### Sub-Task 1.2: Create the dh-research skill asset

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add `skills/dh-research/SKILL.md` with the bounded research workflow, note/index templates, and documentation-ownership handoff; update the documentation-root reference with the research row.
- **Related Requirements:** R2, R3, R5, R7, AC2, AC5
- **Dependencies and Preconditions:** Sub-Task 1.1 completed (agent identity and boundaries).
- **In Scope for This Sub-Task:** `skills/dh-research/SKILL.md`; the research row in `skills/dh-create-documentation/references/workspace-docs.md`.
- **Out of Scope for This Sub-Task:** Creating `docs/research/index.md`, plan templates, execution task edits, tests, and counts.
- **Instructions:**
  1. Frontmatter: `name: dh-research`, folded `description` (when to use; output path; no plan-local path), `license: MIT`, `compatibility: opencode`, `allowed-tools: read, webfetch, websearch`, metadata audience/workflow.
  2. Core Rules: one skill run = one question; primary sources first; claim + source URL + retrieval date; no source → model knowledge label or drop; state tool availability; one bounded pass on blockers; single source of truth `docs/research/<topic>.md`; reject `docs/plans/<slug>/research/`.
  3. Workflow: frame (question, caller, decision), plan 2–5 queries, search/fetch, verify/cross-check, compose note + index row, hand the payload to the documentation agent (`dh-create-documentation`), report the direct answer + citations + confidence + path.
  4. Add the note template with documentation frontmatter (`title`, `slug`, `description`, `tags: [research]`, `project`, `created`, `updated`, `stack`, `feature`, `epic`, `status`) plus Question/Caller/Date/Tools/Findings/Implications/Sources/Confidence sections, the index row template, the topic-collision rule (update or disambiguate), and the persistence fallback when nested delegation is unavailable (return payload to caller).
  5. Add the Doc search footer. Do not add a “Blocker Integration (loop step 2.4)” section; describe blocker use as the optional execution unblock, not a loop step.
  6. In `workspace-docs.md`, add the research-note row: `{workspace_root}/docs/research/<topic>.md`, `project: <workspace>`, plus the index row.
- **Acceptance Criteria:** File exists and parses; allowed-tools match; one-question rule, citation rule, SSOT path, index contract, and ownership handoff are explicit; no plan-local path; no “2.4”; ≤250 lines; reference row added.
- **Cautionary Points (Risks & Edge Cases):** The skill must not grant itself `write`; persistence belongs to the documentation agent. Avoid implying research replaces the hard-blocker halt. Keep query privacy rules explicit.
- **Implementation Suggestions:** Follow the PR skill skeleton but rewrite the output section around `docs/research/`; link `../dh-planning/references/agent-selection.md` and `../dh-create-documentation/SKILL.md` using relative links that resolve.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/frontmatter.test.ts`; `node scripts/check-links.mjs`; `node scripts/audit.mjs` (frontmatter, name, size).
- **Done When:** The skill exists, resolves its links, and the research row is documented.

#### Sub-Task 1.3: Add the optional Research plan section

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Extend the phased plan format with an optional `## Research` section that links `docs/research/` notes, and propagate it to the scaffold, canonical fixture, planning skill, fast-plan omission lists, and fast-alignment prose.
- **Related Requirements:** R4, AC3
- **Dependencies and Preconditions:** Sub-Task 1.2 completed (note path/index contract).
- **In Scope for This Sub-Task:** `skills/dh-planning/references/phased-plan-template.md`; `skills/dh-planning/SKILL.md` (fill/inspect instruction); `src/tools/plan-template.ts`; `src/tools/plan-fast-template.ts` (`FAST_OMITTED_SECTIONS`); `src/__tests__/fixtures/plans/phased-plan.md`; `skills/dh-execute-plan-fast/SKILL.md` (allowed-differences list); `skills/dh-execute-plan-fast/references/plan-fast-template.md` (omitted-sections list); `skills/dh-review/SKILL.md` (Plan Alignment Mode allowed differences).
- **Out of Scope for This Sub-Task:** Parser behavior for phases, fast mirror rendering logic, `docs/research/index.md`, execution task skills.
- **Instructions:**
  1. Add `## Research` after `## Visual Context` and before `## Agent Selection` in the authoritative template, with a one-line explanation and the relative-link example `../../research/<topic>.md`.
  2. Mirror the section in `planScaffold` and add it to the canonical fixture; keep `Agent Selection` before `## Phases`.
  3. Add `'Research'` to `FAST_OMITTED_SECTIONS` so the fast mirror lists it among intentional omissions; add `## Research` to the omitted-section lists in `skills/dh-execute-plan-fast/SKILL.md`, `skills/dh-execute-plan-fast/references/plan-fast-template.md`, and `skills/dh-review/SKILL.md` Plan Alignment Mode.
  4. In `dh-planning`, add: research notes are linked here; delegate external-fact questions to `dh-research` and cite the note.
- **Acceptance Criteria:** Section present in template/scaffold/fixture; order is Visual Context → Research → Agent Selection → Phases; fast renderer lists `Research`; both fast-alignment prose surfaces list `## Research` as an allowed omission; parser tests still pass; no section inside `## Phases`.
- **Cautionary Points (Risks & Edge Cases):** Do not let the section become a phase or carry status markers. Keep the fixture byte-stable relative to the template. Do not add a required section that breaks legacy plans. The omitted-section lists are duplicated in prose and code; miss one and the pre-execution alignment gate will flag the section.
- **Implementation Suggestions:** Copy the exact prose from the template into the scaffold literal, escaping backticks per `plan-template.ts` style. Add a short note in the template’s “Workspace Impact and Execution Record sections” list that `## Research` is also outside the phases region.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/mermaid-skill.test.ts src/__tests__/agent-selection.test.ts`; add the research assertions in Sub-Task 3.1; `node scripts/check-links.mjs`; after the change, re-run `dh_plan_fast_sync` + Plan Alignment Mode.
- **Done When:** All six surfaces expose/allow the section and the fast omission lists include it.

#### Sub-Task 1.4: Establish the docs/research registry contract

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Objective:** Create `docs/research/index.md` as the workspace research registry, with the documentation frontmatter and a newest-first table matching the skill’s index contract.
- **Related Requirements:** R3, R5, AC2, AC8
- **Dependencies and Preconditions:** Sub-Tasks 1.1–1.2 completed (path and index contract defined).
- **In Scope for This Sub-Task:** `docs/research/index.md` only.
- **Out of Scope for This Sub-Task:** Research notes themselves, skill files, plan templates, README/AGENTS sweeps, and evolution notes.
- **Instructions:**
  1. Create `docs/research/index.md` with Obsidian frontmatter (`title`, `slug`, `description`, `tags: [research, index]`, `project`, `created`, `updated`, `stack`, `feature`, `epic`, `status`).
  2. Add a one-paragraph purpose statement: one workspace registry, newest-first, each row links its note, notes are evidence artifacts owned by the documentation agent.
  3. Add the table `| Date | Topic | Question | Confidence | Used by | Note |` and no fabricated rows. A short “No notes registered yet” line below the table is acceptable.
  4. Keep every link relative and resolvable; do not link a note that does not exist.
- **Acceptance Criteria:** File exists with valid frontmatter; table header matches the skill contract; no dead links; states newest-first and single-source-of-truth semantics.
- **Cautionary Points (Risks & Edge Cases):** Do not create a plan-local research folder. Do not seed the table with PR URLs as fake notes; PR evidence belongs in the plan/SDD. Keep `docs/evolve/` untouched.
- **Implementation Suggestions:** Follow `docs/evolution/index.md` frontmatter style; keep the index as an index, not a tutorial. Add a comment in the plan’s `## Research` section only when a real note exists.
- **Testing Suggestions:** `node scripts/check-links.mjs`; verify the table header with `rg -n "\\| Date \\| Topic" docs/research/index.md`; Sub-Task 3.1 asserts the contract.
- **Done When:** The registry exists, parses, and links cleanly.

### Phase 2: Runtime integration and inventory

- **Status:** Completed

#### Sub-Task 2.1: Add the optional research unblock step to both execution task skills

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add exactly one optional, bounded research-unblock instruction to `dh-execute-plan-task` and `dh-execute-plan-task-fast`, gated on browsing availability, while preserving the hard-blocker halt.
- **Related Requirements:** R6, R9, AC4
- **Dependencies and Preconditions:** Sub-Tasks 1.1–1.2 completed (research capability exists); hard-blocker text located in both skills.
- **In Scope for This Sub-Task:** `skills/dh-execute-plan-task/SKILL.md`; `skills/dh-execute-plan-task-fast/SKILL.md`.
- **Out of Scope for This Sub-Task:** `AGENTS.md` runtime contract (updated in 2.4), review/orchestrator skills, research skill content, tests.
- **Instructions:**
  1. In `dh-execute-plan-task` Step 3 (validation) place one line before the stop-on-thrice rule: when the blocker depends on current external facts (version, EOL, known upstream issue, breaking change, migration) and the runtime exposes browsing tools, run `dh-research` for ONE cited pass and register the note under `docs/research/`; if the evidence is inconclusive, stop and report the blocker for guidance.
  2. Add the same single line to `dh-execute-plan-task-fast` Step 3 (or its validation bullet), using fast-mode wording (no per-task gates; the research pass is not a gate).
  3. Keep the existing hard-blocker sentence intact in both files. Do not add a second research paragraph or a “loop step 2.4” section.
- **Acceptance Criteria:** Each file contains exactly one optional research-unblock instruction; it names `dh-research`, `docs/research/`, browsing availability, and the one-pass bound; the hard-blocker rule remains; no “loop step 2.4” framing in either file.
- **Cautionary Points (Risks & Edge Cases):** Do not make research mandatory or imply it can clear an unresolved blocker. Do not introduce a per-task gate in fast mode. Keep the line short enough to remain a single instruction.
- **Implementation Suggestions:** Put the line directly after the validation bullet list in standard mode and after the narrow-validation bullet in fast mode. Use the same sentence in both, with the fast-mode parenthetical only.
- **Testing Suggestions:** `rg -n "dh-research" skills/dh-execute-plan-task/SKILL.md skills/dh-execute-plan-task-fast/SKILL.md`; Sub-Task 3.1 asserts exactly one occurrence and the preserved halt sentence.
- **Done When:** Both skills carry the optional line and the halt policy is unchanged.

#### Sub-Task 2.2: Integrate research delegation in planning, SDD, and contingency skills

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Wire the research capability into `dh-planning`, `dh-grill-sdd`, and `dh-contingency`: delegate external-fact questions, cite notes, and forbid unverified-fact ratings.
- **Related Requirements:** R7, AC5
- **Dependencies and Preconditions:** Sub-Tasks 1.2 and 1.3 completed (skill exists; plan section exists).
- **In Scope for This Sub-Task:** `skills/dh-planning/SKILL.md`; `skills/dh-grill-sdd/SKILL.md`; `skills/dh-contingency/SKILL.md`.
- **Out of Scope for This Sub-Task:** Other planning references, skill index, README/AGENTS, tests.
- **Instructions:**
  1. `dh-planning`: add one core rule and one workflow step — when requirements or alternatives depend on current ecosystem facts, delegate one `dh-research` question; link the note in `## Research` and cite it in the relevant sub-task.
  2. `dh-grill-sdd`: in the interview/synthesize flow, add one sentence — external-fact gaps are answered by one `dh-research` pass and cited by note path, not from model priors.
  3. `dh-contingency`: add research to the method (survey current versions/EOL/API status via `dh-research` when the comparison depends on them), and add one Safety line: alternatives are rated only on verified facts; missing evidence is labelled as an assumption, never presented as model recollection.
  4. Keep the existing output contracts; no new required section in SDD or contingency.
- **Acceptance Criteria:** Each skill names `dh-research`; planning references `## Research`; contingency has the evidence/assumption safety line; no skill claims research is mandatory when web tools are absent.
- **Cautionary Points (Risks & Edge Cases):** Do not duplicate long research instructions — the skill owns the workflow. Do not turn research into a gate. Preserve the existing SDD interview questions and contingency A/B/C structure.
- **Implementation Suggestions:** One bullet per skill is enough; link `../dh-research/SKILL.md` relatively. Use “may delegate” language so offline runs still work and fail loudly only when research is actually needed.
- **Testing Suggestions:** `rg -n "dh-research" skills/dh-planning/SKILL.md skills/dh-grill-sdd/SKILL.md skills/dh-contingency/SKILL.md`; Sub-Task 3.1 asserts the contingency safety line.
- **Done When:** All three skills integrate research without changing their output contracts.

#### Sub-Task 2.3: Update corpus inventory, tests, audit membership, CLI and package smoke expectations

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Move every active inventory surface from 5 agents / 26 skills / 31 names to 6 / 27 / 33, add the new names to audit loop membership, and make the CLI/package expectations match.
- **Related Requirements:** R8, R9, AC1, AC6
- **Dependencies and Preconditions:** Sub-Tasks 1.1–1.2 completed (new assets exist); Sub-Task 2.1 completed (execution skills stable).
- **In Scope for This Sub-Task:** `src/__tests__/assets.test.ts`; `src/__tests__/frontmatter.test.ts`; `src/__tests__/registration.test.ts`; `src/__tests__/agent-selection.test.ts`; `src/cli/plugin-artifact.ts` (`EXPECTED_*`); `src/cli/__tests__/plugin-artifact.test.ts`; `src/cli/__tests__/helpers/install-harness.ts`; `scripts/lib/shared.mjs` (`LOOP` lists); `scripts/lib/pack-install.mjs`; `scripts/smoke-pack.mjs`; `scripts/lib/pack-contract.mjs` comment; `src/plugin.ts` header comment.
- **Out of Scope for This Sub-Task:** README/AGENTS/skills index/LOADING/demo docs (2.4), audit report regeneration (3.2), historical plans/CHANGELOG entries.
- **Instructions:**
  1. Update numeric assertions and comments: agents 5→6, skills 26→27, unique 31→33; assert `dh-researcher` and `dh-research` are present.
  2. Add `dh-researcher` and `dh-research` to `LOOP.agents` / `LOOP.skills` in `scripts/lib/shared.mjs` (keep alphabetical order).
  3. Update `EXPECTED_AGENT_COUNT`/`EXPECTED_SKILL_COUNT`, the install-harness fixture constants, and the plugin-artifact error regexes.
  4. Update `pack-install.mjs` count checks and the smoke-pack/pack-contract comments.
  5. Sweep with `rg -n "5 agents|26 skills|31" src scripts` and confirm only historical/irrelevant matches remain.
- **Acceptance Criteria:** All inventory assertions are 6/27/33; audit loop lists include both new names; CLI failure messages report the new expected counts; `src`/`scripts` comments agree; no unrelated count changes.
- **Cautionary Points (Risks & Edge Cases):** Registration tests import the built bundle — run `pnpm build` before them. Do not change the TUI checklist fixture or historical plan references. Keep alphabetic lists sorted to satisfy the audit.
- **Implementation Suggestions:** TDD: update the failing expectations first, then run them. Use `rg` to find all count literals; don’t rely on memory. Check `src/cli/__tests__/helpers/install-harness.ts` creates the right fixture counts.
- **Testing Suggestions:** `pnpm build && pnpm test && pnpm typecheck`; `node scripts/audit.mjs` (loop membership PASS); `node scripts/smoke-mcp.mjs`; `node scripts/smoke-pack.mjs` if the environment allows packing.
- **Done When:** Every active inventory surface reports 6 agents + 27 skills + 33 names and the audit loop check passes.

#### Sub-Task 2.4: Update project docs, metadata, and changelog

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Objective:** Update the project’s human-facing surfaces for the new capability: role summary, loop/runtime contract, registration counts, skills index, loading docs, demo docs, and changelog.
- **Related Requirements:** R3, R4, R5, R6, R7, R8, AC8
- **Dependencies and Preconditions:** Sub-Tasks 1.1–1.4, 2.1–2.3 completed (assets, registry, integration, counts stable).
- **In Scope for This Sub-Task:** `AGENTS.md`; `README.md`; `skills/index.md`; `docs/LOADING.md`; `opencode.example.jsonc`; `demo-project/docs/index.md`; `CHANGELOG.md` (`## [Unreleased]`).
- **Out of Scope for This Sub-Task:** `docs/plans/**` except this plan’s `## Research` links when real notes exist; historical CHANGELOG entries; `docs/evolve/`; generated audit reports.
- **Instructions:**
  1. `AGENTS.md`: role summary → 6 agents/27 skills and list `dh-researcher`/`dh-research`; runtime delegation agents list; provenance “Exactly 6 agents + 27 skills”; registration “6 agents and 27 skills”; verify line; step 2.4 paragraph gains one sentence: an optional bounded `dh-research` pass may precede the blocker report when browsing tools exist, and never authorizes continuing past an unresolved blocker; docs/workspace contract notes `docs/research/` as the research root owned by the documentation agent.
  2. `README.md`: counts in intro/features/registration and the repository-layout comments; add a `dh-researcher` Agents-table row and a `dh-research` Skills-table row; mention the single `docs/research/` registry.
  3. `skills/index.md`: 27 counts; add `dh-research` to the skill table (support/optional unblock role); add `dh-researcher` to the agents list; update “All 26 skills” wording; do not claim a new loop step.
  4. `docs/LOADING.md`: update the three inventory mentions (dist assets, skills registration, registration test description).
  5. `opencode.example.jsonc`: update the bundled-surface comment and the `opencode debug agents` comment to 6 agents/27 skills.
  6. `demo-project/docs/index.md`: update the demo status counts to 6/27 where they describe the loaded harness.
  7. `CHANGELOG.md`: add `## [Unreleased]` with Added (agent, skill, research registry, plan section, execution unblock) and Changed (corpus counts, planning/contingency integration).
- **Acceptance Criteria:** No active doc still says 5 agents/26 skills; both new names appear in AGENTS/README/skills index; `docs/research/` ownership is documented; changelog entry present; links resolve.
- **Cautionary Points (Risks & Edge Cases):** Do not rewrite the hard-blocker policy; add only the optional-pass sentence. Keep the skills-loop diagram free of a research “2.4” node. Do not touch historical plans or old changelog entries.
- **Implementation Suggestions:** Use `rg -n "5 agents|26 skills|31" AGENTS.md README.md skills/index.md docs/LOADING.md demo-project/docs/index.md` and fix each hit deliberately. Keep the README tables’ style and ordering.
- **Testing Suggestions:** `node scripts/check-links.mjs`; `rg` sweep for stale counts; `pnpm test` (docs don’t affect tests, but run after 2.3); review the `skills/index.md` Mermaid block by eye.
- **Done When:** All active docs describe 6 agents + 27 skills and the research ownership boundary.

### Phase 3: Verification and close-out

- **Status:** Completed

#### Sub-Task 3.1: Consolidate cross-cutting contract tests for research integration

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add a focused contract test suite that fails if the research assets, registry, plan section, execution unblock, or planning integration drift.
- **Related Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, AC1, AC2, AC3, AC4, AC5, AC6
- **Dependencies and Preconditions:** Phase 1 and Phase 2 implementation sub-tasks completed.
- **In Scope for This Sub-Task:** A new `src/__tests__/research-contract.test.ts` (or split into two files if it approaches the 300-line limit).
- **Out of Scope for This Sub-Task:** Duplicating the existing inventory assertions, TUI tests, or historical plan fixtures.
- **Instructions:**
  1. Assert both assets exist, parse with `name`/`description`, `dh-researcher` has `mode: subagent`, neither has `permission`/`tools`, and files respect the audit line limits.
  2. Assert the research skill includes `docs/research/<topic>.md`, `docs/research/index.md`, the citation/retrieval-date rule, the one-question rule, and the documentation-ownership handoff; assert it does **not** include `docs/plans/<slug>/research/` or the string `loop step 2.4` / `step 2.4`.
  3. Assert `docs/research/index.md` exists with frontmatter and the `| Date | Topic | Question | Confidence | Used by | Note |` header.
  4. Assert `## Research` appears in the template, scaffold, fixture, and `FAST_OMITTED_SECTIONS`; assert it sits before `## Agent Selection` and outside `## Phases`; assert the fast skill, fast template reference, and `dh-review` Plan Alignment Mode list `## Research` among allowed omissions.
  5. Assert each execution task skill contains exactly one `dh-research` reference and still contains its hard-blocker sentence.
  6. Assert `dh-planning`, `dh-grill-sdd`, and `dh-contingency` mention `dh-research`; assert the contingency Safety section contains the verified-facts/assumption rule.
- **Acceptance Criteria:** The suite passes on the completed corpus and would fail if any contract above regressed; no duplicated inventory test; file stays under the 300-line code-file guideline.
- **Cautionary Points (Risks & Edge Cases):** Reading files with regex can be brittle; anchor on stable phrases and section boundaries. Do not assert exact prose that is likely to be edited. Split the suite if it grows past 300 lines. Avoid jscpd duplication with existing tests.
- **Implementation Suggestions:** Use `fs.readFileSync` + `parseFrontmatter` like `assets.test.ts`; resolve paths from `REPO_ROOT`; use `it.each` for asset/format cases. TDD: write the suite first and let the gaps drive small fixes.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/research-contract.test.ts`; `pnpm lint:biome`; `pnpm lint:dup`.
- **Done When:** The contract suite passes and covers every acceptance criterion above.

#### Sub-Task 3.2: Run the full verification gate and regenerate audit artifacts

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Prove the change is release-ready on the current branch and regenerate the audit reports from the new corpus.
- **Related Requirements:** R8, R9, AC6, AC7
- **Dependencies and Preconditions:** Sub-Tasks 2.3 and 3.1 completed; build artifacts can be regenerated.
- **In Scope for This Sub-Task:** Verification commands and the regenerated `reports/audit.md` / `reports/audit.json`; in-scope fixes for failures.
- **Out of Scope for This Sub-Task:** Docker-only scans (`scan:deps`, `scan:code`) when Docker is unavailable; release tagging/version bump; PR #4 branch changes.
- **Instructions:**
  1. Run the non-Docker gate in order: `pnpm lint:biome`, `pnpm format:biome:check`, `pnpm lint:knip`, `pnpm lint:dup`, `pnpm lint:depcruise`, `pnpm lint:links`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm run audit`, `node scripts/smoke-load.mjs`, `node scripts/smoke-mcp.mjs`.
  2. Run `node scripts/smoke-install.mjs` and `node scripts/smoke-pack.mjs` if the environment supports them; record any environment blocker explicitly.
  3. Confirm `reports/audit.md`/`reports/audit.json` show 33 items, 27/27 skills, 6/6 agents, 0 FAIL.
  4. Fix in-scope failures; if a failure is pre-existing or environmental, capture the exact command, output, and rationale in the sub-task report — never weaken a check to pass.
- **Acceptance Criteria:** Every executed command exits 0; audit reports 33/27/6 with 0 FAIL; Docker-only scans are either run or explicitly recorded as not run with the reason.
- **Cautionary Points (Risks & Edge Cases):** Registration tests import `dist/plugin.js`, so build before tests. `pnpm audit` collides with pnpm’s security audit — use `pnpm run audit`. Do not commit `dist/` if ignored; check `git status`. Never disable lint rules or skip a failing test.
- **Implementation Suggestions:** Use the `dh-execute-cli` skill for logged, compact command output; capture log paths. Regenerate audit reports with `pnpm run audit` after the final corpus edit.
- **Testing Suggestions:** The gate itself is the test; additionally run `git status --short` and `git diff --stat` to confirm the touched surface.
- **Done When:** The gate is green (or fully documented with environment-only exceptions) and the audit artifacts are regenerated.

#### Sub-Task 3.3: Write evolution and observation close-out notes

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Objective:** Record how the harness evolved and what the session learned, and register both notes in the evolution index.
- **Related Requirements:** AC8
- **Dependencies and Preconditions:** Phase 3 verification completed; final outcomes and deferrals known.
- **In Scope for This Sub-Task:** `docs/evolution/<YYYY-MM-DD>-dh-research-agent-skill.md`; `docs/evolution/observations/<YYYY-MM-DD>-<HHMM>-dh-research-agent-skill.md`; `docs/evolution/index.md` rows.
- **Out of Scope for This Sub-Task:** `docs/evolve/` (historical), plan files except the Execution Record link, and changelog edits already done in 2.4.
- **Instructions:**
  1. Evolution note: what shipped, why (PR #4 + review comments), architecture/ownership (agent/skill, registry, documentation handoff, plan section, optional unblock), validation results, deferrals (dh-setup/review research, retention), and follow-ups.
  2. Observation note: session learnings — PR conflict/porting strategy, count-drift sweep, ownership handoff constraint, source-citation discipline, what to watch next time.
  3. Prepend both rows to `docs/evolution/index.md` (newest first) with plan links.
  4. Link both notes from this plan’s `## Execution Record` → References.
- **Acceptance Criteria:** Both notes exist with valid frontmatter; the index has both rows; links resolve; the Execution Record references them.
- **Cautionary Points (Risks & Edge Cases):** Do not duplicate the plan; the notes capture evolution and learnings. Keep dates/times real, not placeholders. Do not modify historical notes or `docs/evolve/`.
- **Implementation Suggestions:** Follow `skills/dh-create-documentation/references/evolution-notes.md` and the existing 2026-11-15 entries for style.
- **Testing Suggestions:** `node scripts/check-links.mjs`; verify frontmatter with `rg`; confirm both index rows resolve.
- **Done When:** Both notes and index rows exist and are linked from the plan.

## Final Integration & Verification

- **System-Wide Test:** Build the plugin and run the full non-Docker gate; confirm the built plugin registers 6 agents + 27 skills, the audit reports 33/27/6 with 0 FAIL, `docs/research/index.md` is the only research registry, the plan template/scaffold/fixture expose `## Research`, and both execution task skills carry the optional unblock line while the hard-blocker halt remains.
- **Completion Checklist:**
  - [ ] `agents/dh-researcher.md` and `skills/dh-research/SKILL.md` exist, parse, and register.
  - [ ] `docs/research/index.md` exists; no plan-local research folder or path remains.
  - [ ] `## Research` is in template/scaffold/fixture and omitted by the fast mirror.
  - [ ] Both execution task skills contain exactly one optional research line; no `2.4` research framing.
  - [ ] Planning, SDD, and contingency cite research; contingency safety line present.
  - [ ] Counts are 6 agents / 27 skills / 33 unique across docs, tests, CLI, and smokes.
  - [ ] `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm run audit`, `pnpm lint:links`, and plugin/MCP smokes pass.
  - [ ] README, AGENTS.md, skills index, LOADING, CHANGELOG, and evolution/observation notes are updated.
  - [ ] No new dependencies, tool/command/prompt registration, or hard-blocker policy change.

## Execution Record

- **Execution status:** Completed
- **Executed at:** 2026-11-16
- **Workspace root:** /home/andres/workspace/dev-harness-skills
- **Repository kind:** workspace
- **Repository path:** `.`
- **Branch / worktree:** feature/dh-research-agent-skill
- **Commit range:** 422ab45..4882dba
- **Plan path:** docs/plans/dh-research-agent-skill/plan.md
- **Mirrored plan path:** docs/plans/dh-research-agent-skill/plan_fast.md
- **Summary:**
  - Added `dh-researcher` (6th agent) and `dh-research` (27th skill) with a
    bounded, source-cited workflow and a no-write ownership boundary.
  - Established one `docs/research/` registry (`index.md` + topic notes) and the
    optional `## Research` plan section that links it.
  - Added one optional research-unblock line to both execution task skills; the
    hard-blocker halt and fast-mode gates are unchanged.
  - Integrated research delegation in planning, SDD, and contingency; updated
    the corpus, tests, audit, demos, docs, and package smokes to 6/27/33.
- **Architectural changes:** Research capability contract (agent + skill);
  single workspace research registry with documentation-agent ownership
  handoff; optional `## Research` plan section outside the phases region;
  optional execution unblock without a new loop step or gate.
- **References:** [pre-execution alignment](./tasks/review-fast.md) ·
  [plan-end alignment](./tasks/review-fast-final.md) ·
  [final review](./tasks/review.md) ·
  [code review](./tasks/code-review.md) ·
  [domain check](./tasks/domain-check.md) ·
  [preflight](./tasks/preflight.md) ·
  [artifact check](./tasks/artifact-check.md) ·
  [final verification](./tasks/final-verification.md) ·
  [evolution note](../../evolution/2026-11-16-dh-research-agent-skill.md) ·
  [observation note](../../evolution/observations/2026-11-16-0110-dh-research-agent-skill.md)

## Open Questions

- Should `dh-setup` later audit for a search-capable MCP? Deferred follow-up.
- Should `dh-review`/`dh-code-review` use research for CVE/API verification? Deferred follow-up.
- Should research notes ever be pruned? The registry keeps all notes for now; revisit when volume justifies a retention policy.
