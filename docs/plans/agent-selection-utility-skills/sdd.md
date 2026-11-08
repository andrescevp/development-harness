---
title: Agent Selection and Utility Skills
slug: agent-selection-utility-skills
description: Replace hardcoded dh-agent delegation with runtime agent selection, and migrate dh-executor/dh-explorer agents to dh-execute-cli/dh-explore skills.
tags: [sdd, design, harness, agents, skills]
project: dev-harness-skills
stack: markdown skills + TypeScript inventory/test tooling
created: 2026-11-08
updated: 2026-11-08
status: proposed
---

# Software Design Document: Agent Selection and Utility Skills

## Problem Statement

Harness skills hardcode bundled `dh-*` agents in their delegation instructions:
`@dh-software-architect`, `@dh-software-engineer`, `@dh-reviewer`,
`@dh-final-reviewer`, `@dh-documentor`, `@dh-executor`, and `@dh-explorer`.
This prevents projects with specialized agents (domain architects, language
specialists, project reviewers, documentation owners) from using those agents
when a harness skill runs. It also makes the harness brittle: every new
project-specific agent requires editing skill prose.

Two roles are utility capabilities rather than domain agents: command
execution (`dh-executor`) and codebase exploration (`dh-explorer`). Keeping
them as agents adds registry entries that are not needed as selectable
personas; their behavior is instruction-like and fits the skill model.

## Goals / Non-Goals

- **Goals:** Make planning and execution inspect the available agents and pick
  the best agent for each role; prefer project-specific agents; fall back to
  the bundled harness agents only when no better match exists; remove
  hardcoded `@dh-*` references from skills; migrate the executor and explorer
  agents into `dh-execute-cli` and `dh-explore` skills; keep the harness
  behavior and documentation consistent.
- **Non-goals:** Renaming skill or agent IDs (the `dh-` namespace stays);
  renaming MCP tools, the MCP server, the CLI, package, or environment
  variables; adding a new agent-discovery MCP tool; changing the plan status
  model or execution semantics; keeping aliases for the removed agents.

## Requirements

- **R1:** A shared agent-selection protocol exists and defines how to discover
  available agents, classify them by capability, prefer project-specific
  specialists, fall back to bundled harness agents, and record the choice.
- **R2:** `dh-planning` inspects the environment's available agents while
  planning, selects the best agent for architecture/engineering (and other
  delegated roles), and records the choices and rationale in the plan's
  `## Agent Selection` section. It must not hardcode `@dh-*` agents.
- **R3:** Every skill that delegates work uses the agent-selection protocol;
  skill bodies contain no hardcoded `@dh-*` agent references.
- **R4:** `dh-executor` becomes the `dh-execute-cli` skill and `dh-explorer`
  becomes the `dh-explore` skill; `agents/dh-executor.md` and
  `agents/dh-explorer.md` are removed.
- **R5:** All `@dh-executor` references become `dh-execute-cli` skill
  invocations; all `@dh-explorer` references become `dh-explore` invocations.
- **R6:** Command execution, exploration, planning, implementation, review,
  final review, and documentation behavior is preserved, including the
  logged-command strategy and least-privilege rules.
- **R7:** The bundle inventory becomes **5 agents + 24 skills** (unique names
  remain 29); all counts, tests, scripts, smoke checks, and reports are
  updated.
- **R8:** `AGENTS.md`, `README.md`, `docs/LOADING.md`, `skills/index.md`, the
  demo docs, and config examples describe the selection protocol and the new
  utility skills accurately.
- **R9:** The selection is inspectable and deterministic for a run: the plan's
  `## Agent Selection` table (or an explicit runtime selection record) names
  the chosen agent and the fallback; execution skills use it.
- **R10:** Validation gates prove no hardcoded `@dh-*` remains in skills, the
  removed agent files are gone, the new skills load, counts are 5/24, and the
  full test/build/smoke/audit suite passes.

## Scope

- **In scope:** agent-selection reference and plan section; `dh-planning`
  changes; utility agent-to-skill migration; reference cleanup across all
  skills; agent/docs/index updates; inventory/tests/scripts/reports.
- **Out of scope:** renaming `dh-` IDs, MCP tool/server names, CLI/package/env
  names, adding aliases for removed agents, changing MCP tool behavior,
  changing the plan status model, or rewriting historical plan records.

## Constraints

- The environment may expose agents through a runtime agent list, project
  config, or agent directories; the protocol must support all three and state
  the limitation when enumeration is unavailable.
- Skill bodies must remain usable without a specific host: state the
  capability sought, not a hardcoded agent ID.
- Bundled harness agents remain available as fallback and must be selected by
  capability, not by hardcoded prose.
- The two utility skills must not delegate command execution/exploration back
  to agents; they are the instruction layer themselves.
- Hard cut: no deprecated aliases for `dh-executor`/`dh-explorer`.

## Risks and Edge Cases

- **Ambiguous agent choice:** two project agents may fit; the protocol must
  record the rationale and prefer the more specific match, then ask if tied.
- **No enumerable agent list:** fall back to config/directory inspection and
  record the limitation; never invent an agent.
- **Missing fallback agents:** if neither a project agent nor the bundled
  fallback exists, stop and report the missing capability.
- **Removed utility agents still referenced:** a repo-wide grep gate is
  mandatory; tests must catch stale `@dh-executor`/`@dh-explorer` mentions.
- **Count drift:** moving two agents to skills changes 7→5 agents and 22→24
  skills while the unique-name total stays 29; update every explicit count.
- **Selection recorded in a plan that becomes stale:** execution must
  re-validate that the selected agent still exists; if not, re-run selection
  and record the change.

## Acceptance Criteria

- **AC1:** `rg "@dh-" skills/` returns no matches; skill delegation uses the
  selection protocol and skill references.
- **AC2:** `agents/dh-executor.md` and `agents/dh-explorer.md` are absent;
  `skills/dh-execute-cli/SKILL.md` and `skills/dh-explore/SKILL.md` exist and
  load.
- **AC3:** `dh-planning` references the agent-selection protocol, populates
  `## Agent Selection`, and prefers project-specific agents over fallbacks.
- **AC4:** Execution, review, final-review, documentation, setup, semver,
  preflight, and artifact-check skills contain no hardcoded `@dh-*` agent
  references and use `dh-execute-cli`/`dh-explore` where applicable.
- **AC5:** Inventory tests report 5 agents, 24 skills, 29 unique names; build,
  smoke, audit, typecheck, lint, and unit tests pass.
- **AC6:** Docs and indexes list 5 agents / 24 skills and explain the
  selection protocol; no stale 7-agent/22-skill claims remain on the active
  surface.
- **AC7:** The plan template/scaffold includes `## Agent Selection` and the
  fast-plan alignment lists treat it as an intentionally omitted section.
- **AC8:** A contract test fails if a hardcoded `@dh-*` reference, a removed
  agent file, a missing utility skill, or a count mismatch is reintroduced.

## Open Questions

- Should the plan's `## Agent Selection` table be mandatory for every plan, or
  only when the plan delegates work? Default: include when delegation is
  needed; write `None — no specialized agent required` otherwise.
- Should the selection protocol prefer platform-specific agents by name
  pattern or by description/capability? Default: capability/description first,
  name only as supporting evidence.
- If a project agent is selected but unavailable at execution time, should the
  run stop or fall back automatically? Default: stop and ask, because the
  plan's chosen agent is part of the approved execution contract.
