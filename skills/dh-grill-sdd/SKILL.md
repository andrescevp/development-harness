---
name: dh-grill-sdd
description: >
  Interview and produce ./docs/plans/<slug>/sdd.md — the requirements contract (goal, scope, constraints, acceptance criteria, risks, stable IDs). dh-planning runs it when the SDD is absent. Use to write the sdd or grill requirements.
license: MIT
compatibility: opencode
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: design
---

# SDD Interviewer (grill → SDD)

Produce the **requirements contract** for plan-driven work: a Software Design
Document written to `./docs/plans/<plan-slug>/sdd.md`. The SDD is the source
of truth for requirements that `dh-planning` maps into a phased plan (it
replaces the legacy `task.md` contract).

## When to use

- `dh-planning` invokes this skill when `./docs/plans/<plan-slug>/sdd.md`
  does not exist, BEFORE starting plan creation.
- The user asks for requirements/design analysis before planning.
- A plan's scope is unclear and must be pinned down first.

## Workflow

1. **Locate the target** — the slug is the plan folder under `./docs/plans/`
   (given by the caller or derived from the request). Target file:
   `./docs/plans/<plan-slug>/sdd.md`. If it already exists, STOP and report —
   `dh-planning` should reuse it (or `dh-review` should review it).
2. **Interview** — ask ONLY the questions needed to fill the SDD template
   (numbered, focused; skip what the user already provided):
   - **Goal:** What is the main outcome? What problem does it solve?
   - **Scope:** What functionality, systems, or changes are included?
   - **Constraints:** Dependencies, technical requirements, platforms,
     performance, compliance.
   - **Acceptance criteria:** Observable conditions that prove success.
   - **Out of scope:** What must explicitly NOT be included?
   - **Risks:** Edge cases, failure modes, areas needing special care.
   - **Existing assets:** Prior art, current code, docs, integrations.
   Keep it minimal: if the request already answers a question, do not ask it.
3. **Synthesize** — write `./docs/plans/<plan-slug>/sdd.md` (create the
   directory if needed) using the template below. Assign **stable IDs**
   (R1, R2, … / AC1, AC2, …) so `dh-planning`, `dh-execute-plan`, and
   `dh-final-review` can trace requirements unambiguously. Add obsidian-style
   frontmatter (title, slug, description, tags, project, stack, created,
   updated, status: proposed).
4. **Report** — confirm the path, the requirement IDs created, and any open
   questions left in the SDD.

## SDD Template

```markdown
---
title: <Plan/SDD title>
slug: <plan-slug>
description: <one-line description>
tags: [sdd, design]
project: <project>
stack: <tech-stack or tbd>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
status: proposed
---

# Software Design Document: <title>

## Problem Statement

<What problem this work solves; context and motivation.>

## Goals / Non-Goals

- **Goals:** <intended outcomes>
- **Non-goals:** <explicitly excluded outcomes>

## Requirements

- **R1:** <requirement — implementation-agnostic>
- **R2:** <requirement>
- **AC1:** <acceptance criterion mapped to R1>

## Scope

- **In scope:** <what is included>
- **Out of scope:** <what is NOT included>

## Constraints

- <dependencies, platforms, technical constraints>

## Risks and Edge Cases

- <risks, failure modes, edge cases needing care>

## Acceptance Criteria

- **AC1:** <observable condition>
- **AC2:** <observable condition>

## Open Questions

- <non-blocking uncertainties; resolve during planning or execution>
```

## Rules

- The SDD is **implementation-agnostic**: describe WHAT and WHY, never HOW
  the plan will implement it. Implementation ideas belong in the plan, not
  the SDD (keep them out unless the user explicitly wants them captured as
  candidate approaches).
- Preserve user statements verbatim where they define scope or constraints.
- Do not invent requirements: anything you infer must be marked as an
  assumption and confirmed during planning.
- Every requirement/acceptance criterion gets a stable ID used by later
  stages (map sub-tasks to these IDs in `dh-planning`).

## Verification Checklist

- [ ] `./docs/plans/<plan-slug>/sdd.md` exists with valid frontmatter
- [ ] Requirements R1…Rn with stable IDs
- [ ] Scope in/out, constraints, risks, acceptance criteria present
- [ ] No implementation details smuggled into requirements

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
