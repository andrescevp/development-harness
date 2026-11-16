---
title: Domain & Architecture Check — Web Research Agent and Skill
slug: dh-research-agent-skill-domain-check
description: Bounded-context and SOLID validation for the dh-researcher/dh-research plan.
tags: [domain-check, plan]
project: dev-harness-skills
stack: Markdown harness assets + TypeScript tooling
created: 2026-11-16
updated: 2026-11-16
status: active
---

# Domain & Architecture Check: Web Research Agent and Skill

## Bounded Contexts Touched

| Context | Module(s) | Risk |
|---|---|---|
| Harness authoring corpus | `agents/`, `skills/` | Low |
| Planning and execution contracts | `skills/dh-planning/SKILL.md`, `skills/dh-grill-sdd/SKILL.md`, `skills/dh-contingency/SKILL.md`, `skills/dh-execute-plan-task/SKILL.md`, `skills/dh-execute-plan-task-fast/SKILL.md` | Medium |
| Plan format contract | `skills/dh-planning/references/phased-plan-template.md`, `src/tools/plan-template.ts`, `src/tools/plan-fast-template.ts`, plan fixture | Medium |
| Documentation ownership | `docs/research/`, `skills/dh-create-documentation/references/workspace-docs.md`, `AGENTS.md` | Medium |
| Plugin registration and inventory | `src/plugin.ts`, `src/__tests__/`, `src/cli/`, `scripts/` | Medium |
| Verification surface | `reports/`, `pnpm test`, audit, link check, smokes | Low |

The repository is a standalone harness project, not a DDD application.
There is no `WORKSPACE.md` and no explicit bounded-context map; the contexts
above are module/directory heuristics, not domain boundaries.

## Cross-Context Concerns

- **Documentation ownership boundary:** `docs/research/` is documentation
  territory, while the research agent composes the content. The plan resolves
  this with an explicit handoff: `dh-researcher` returns a note payload and
  index row; the documentation agent persists both. The researcher never
  writes code or documentation directly.
- **Plan-format boundary:** adding `## Research` touches the authoritative
  template, the scaffold, the canonical fixture, and the fast renderer’s
  omission list. They must change together or the parser/alignment tests drift.
- **Execution-policy boundary:** the optional research line lives in
  `dh-execute-plan-task(-fast)` and must not become a new gate or weaken the
  hard-blocker stop. The plan keeps the existing halt sentence and adds one
  optional evidence attempt.
- **Inventory boundary:** corpus counts cross tests, CLI constants, package
  smokes, and project docs. A partial sweep is the main integration risk; the
  plan assigns one sub-task to the code/test surface and one to docs.

## SOLID Compliance

| Principle | Sub-Task / Change | Status | Note |
|---|---|---|---|
| SRP | Split research composition (agent) from documentation persistence (documentor) | ✅ | Each unit has one reason to change: evidence vs. document lifecycle. |
| OCP | Optional `## Research` section and optional execution line | ✅ | Existing plans, parser behavior, and hard-blocker policy remain valid; the new section is ignored outside phases. |
| LSP | No new types or inheritance | ✅ | Not applicable to Markdown assets; TypeScript changes are constants/assertions only. |
| ISP | `dh-research` allowed-tools limited to read/webfetch/websearch | ✅ | No write capability in the research skill; no fat interface. |
| DIP | Callers depend on the `dh-research` skill contract, not a provider | ✅ | Web provider/search MCP details stay behind the skill and agent. |

## Verdict

Clear to proceed.

## Blocking Issues (if any)

None. The ownership handoff and the count sweep are the two cautions to verify
during execution; they are covered by Sub-Tasks 1.2, 2.3, and 3.1.
