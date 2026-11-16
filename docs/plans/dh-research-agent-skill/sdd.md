---
title: Web Research Agent and Skill
slug: dh-research-agent-skill
description: Add a source-cited web research capability to the harness, with a single research-notes source of truth and optional execution unblock integration.
tags: [sdd, design, research]
project: dev-harness-skills
stack: Markdown harness assets + TypeScript tooling/tests
created: 2026-11-16
updated: 2026-11-16
status: proposed
---

# Software Design Document: Web Research Agent and Skill

## Problem Statement

The harness runs planning, contingency analysis, implementation, and review from
model knowledge plus the local codebase. It cannot answer questions about the
outside world with current evidence: library versions and EOL status, breaking
API changes, migration guides, upstream issue causes, CVE applicability, and
ecosystem comparisons. When a plan or an execution sub-task is blocked or risky
for lack of an external fact, the loop currently guesses and iterates or halts
before any research happens.

PR [#4](https://github.com/andrescevp/development-harness/pull/4) proposed a
`dh-researcher` agent and `dh-research` skill. The PR is based on the older
7-agent/16-skill corpus, is conflicting with the current `develop` branch
(5 agents + 26 skills), and carries two review comments that change the design:

1. Research notes must have **one source of truth** at `docs/research/<topic>.md`
   with a `docs/research/index.md`; plans link to that folder instead of owning
   private research copies.
2. The research capability must be an **optional unblock step inside
   `dh-execute-plan-task(-fast)`** when browsing capabilities are available,
   not a "loop step 2.4" integration; the 2.4 framing is removed.

## Goals / Non-Goals

- **Goals:**
  - Give planning, contingency analysis, and execution a bounded, source-cited
    way to answer external-fact questions.
  - Keep one research registry for the workspace, discoverable and linkable
    from plans.
  - Make the capability available during execution without weakening the
    hard-blocker halt policy.
  - Integrate the new capability into the current corpus, docs, tests, and
    audit surface without regressing existing behavior.
- **Non-Goals:**
  - Updating, rebasing, or merging PR #4 itself.
  - Adding a new web-search dependency, MCP server, or provider integration.
  - Changing the hard-blocker policy in loop step 2.4.
  - Adding research to `dh-review`/`dh-code-review` or `dh-setup` in this
    change (candidate follow-ups).
  - Migrating or creating plan-local `docs/plans/<slug>/research/` folders.

## Requirements

- **R1:** Bundle a `dh-researcher` agent as the sixth agent, with web-research
  operating rules: one question per pass, primary sources first, every claim
  cited with a source URL and retrieval date, explicit confidence labels,
  honest tool-availability reporting, and no code/command changes.
- **R2:** Bundle a `dh-research` skill as the twenty-seventh skill that defines
  the bounded research workflow, the note template, and the report-back
  contract.
- **R3:** Research notes have a single source of truth at
  `{workspace_root}/docs/research/<topic>.md`; `docs/research/index.md` is the
  newest-first registry. Plan-local research folders are rejected and
  redirected to this location.
- **R4:** Plans can link research notes through an optional `## Research`
  section; the fast mirror intentionally omits it because it is outside the
  phases region.
- **R5:** Writes to `docs/research/` and its index are owned by the
  documentation agent, consistent with the harness documentation contract; the
  researcher composes the note payload and the caller persists it.
- **R6:** `dh-execute-plan-task` and `dh-execute-plan-task-fast` each include
  one optional, bounded research-unblock step, available only when browsing
  capabilities exist; the hard-blocker halt remains mandatory when the evidence
  does not resolve the blocker.
- **R7:** Planning-side integration: `dh-planning`, `dh-grill-sdd`, and
  `dh-contingency` may delegate external-fact questions and must cite research
  notes; `dh-contingency` must not rate alternatives on unverified model
  recollection.
- **R8:** The bundled corpus, metadata, tests, audit loop membership, CLI
  expectations, and package smokes reflect 6 agents + 27 skills (33 unique
  names).
- **R9:** Existing harness behavior is preserved: no command/prompt
  registration, no new tool domain, no dependency changes, and the full QA gate
  stays green.
- **AC1:** `agents/dh-researcher.md` and `skills/dh-research/SKILL.md` exist,
  parse, and register; the plugin reports 6 agents + 27 skills.
- **AC2:** `docs/research/index.md` exists with valid frontmatter and a
  registry table; research assets reject plan-local note paths and never
  present model recollection as research.
- **AC3:** The plan template, scaffold, and canonical fixture expose the
  optional `## Research` section; the fast-plan renderer lists `Research` as an
  allowed omission.
- **AC4:** `dh-execute-plan-task` and `dh-execute-plan-task-fast` each contain
  one optional research-unblock line gated on browsing availability; research
  assets contain no "loop step 2.4" integration framing.
- **AC5:** `dh-planning`, `dh-grill-sdd`, and `dh-contingency` reference
  research delegation and evidence citation; the contingency Safety section
  forbids unverified-fact ratings.
- **AC6:** Inventory counts are 6 agents / 27 skills / 33 unique names across
  docs, tests, CLI constants, package smokes, and audit lists.
- **AC7:** `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm run audit`,
  `pnpm lint:links`, `node scripts/smoke-load.mjs`, and
  `node scripts/smoke-mcp.mjs` pass.
- **AC8:** README, AGENTS.md, skills index, docs/LOADING.md, CHANGELOG, and the
  evolution/observation notes describe the capability and its ownership
  boundary.

## Scope

- **In scope:**
  - New agent and skill assets, plus their documentation and tests.
  - `docs/research/` registry contract and initial index.
  - Optional `## Research` plan section across template/scaffold/fixture.
  - One optional unblock line in both execute-plan-task variants.
  - Planning, SDD, and contingency integration.
  - Corpus counts, audit membership, CLI/package inventory, docs, changelog.
- **Out of scope:**
  - PR #4 branch maintenance or merge.
  - New web providers, search MCP setup, or network runtime code.
  - Changes to the hard-blocker policy, review skills, or `dh-setup`.
  - Plan-local research folders or migration of historical notes.
  - Release tagging/versioning decisions.

## Workspace Impact

- **Workspace root:** `None — standalone repository`
- **Affected packages:** `None — standalone`
- **Shared paths:** `agents/`, `skills/`, `src/`, `scripts/`, `docs/`,
  `AGENTS.md`, `README.md`, `CHANGELOG.md`, `reports/`

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| None — standalone repository | Markdown assets + TypeScript | `pnpm test` | `pnpm build` | `docs/` | fixed |

## Constraints

- Bundled assets are repo-authored; agents ship without `permission` and
  `tools` frontmatter keys, and no commands/prompts are registered.
- Generated documentation outside `docs/plans` is owned by the documentation
  agent; research-note writes and index updates are delegated accordingly.
- Web access is optional at runtime: a run without browsing tools must fail
  loudly and never fabricate a cited answer.
- Research is bounded: one pass per question; unresolved blockers still halt
  for user guidance.
- The workspace root is the research root in monorepos; standalone repositories
  keep the single-root behavior.
- No secrets, credentials, personal data, or system information may appear in
  queries or notes.
- Skill and agent files stay within the repository line limits (250/300).

## Risks and Edge Cases

- **Nested delegation unavailable:** a subagent may not be able to invoke the
  documentation agent directly. The contract must fall back to returning the
  note payload to the caller, who persists it.
- **Count drift:** inventory counts are asserted in several tests, CLI
  constants, and documentation; a partial sweep leaves failures.
- **Path drift:** reintroducing `docs/plans/<slug>/research/` would split the
  source of truth and break the review requirement.
- **Halt-policy erosion:** the optional research step must never become a
  reason to continue past an unresolved blocker.
- **Source quality:** aggregator pages and stale docs can mislead; primary
  sources and retrieval dates are mandatory.
- **Link integrity:** plan links must resolve relative to
  `docs/plans/<slug>/plan.md`; dead links fail `lint:links`.
- **Topic collisions:** two questions can map to one slug; the index is the
  registry and existing topics are updated or disambiguated, not silently
  overwritten.
- **Fast-mode omission:** `## Research` stays outside the phases region, so the
  fast mirror omits it; the fast task must read the source plan when needed.

## Acceptance Criteria

- **AC1:** New agent and skill files parse, have valid frontmatter, and are
  registered by the built plugin alongside the existing corpus.
- **AC2:** A single `docs/research/index.md` registry exists and the new assets
  consistently point research output there, with no plan-local research path.
- **AC3:** The optional `## Research` section is present in the plan template,
  scaffold, and fixture, and recognized as an allowed fast-plan omission.
- **AC4:** Both execution task skills carry exactly one optional research
  unblock instruction gated on browsing availability, and no research asset
  frames research as loop step 2.4.
- **AC5:** Planning, SDD, and contingency skills delegate external-fact
  questions and require citations; the contingency safety rule is present.
- **AC6:** All inventory surfaces report 6 agents + 27 skills + 33 unique names.
- **AC7:** The full local verification gate passes, including audit and link
  checks.
- **AC8:** Project docs and close-out notes describe the capability, ownership,
  and follow-ups.

## Open Questions

- Should `dh-setup` later audit for a search-capable MCP, and should review
  skills use research for CVE verification? Both are deliberate follow-ups, not
  part of this change.
- Should research notes ever be pruned? The registry keeps all notes; a
  retention policy can be added when volume justifies it.
