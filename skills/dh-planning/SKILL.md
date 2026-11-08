---
name: dh-planning
description: >
  Write phased plans to ./docs/plans/<slug>/plan.md: phases with sub-tasks, requirements mapping (stable IDs), scope, acceptance criteria. SDD gate: invoke dh-grill-sdd when ./docs/plans/<slug>/sdd.md is absent. Use to plan this or create a plan.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit
metadata:
  audience: developers
  workflow: development
---

Create a practical execution plan in `./docs/plans/<plan-slug>/plan.md`, not implementation code. Plans use the **phased model** (M1): a plan is an ordered set of **phases**, and each phase contains **sub-tasks** with explicit status markers for both levels. The canonical format contract + full template live in [`references/phased-plan-template.md`](references/phased-plan-template.md) — follow it exactly (the harness `plan_read`/`plan_update_status` tools parse this shape).

## Core Rules

- Plan only when the request needs implementation work or a formal plan.
- Do not modify any file other than `./docs/plans/<plan-slug>/plan.md`, `./docs/plans/<plan-slug>/diagrams/**` (the `dh-mermaid` output), and `./docs/plans/index.md` (the plan index).
- Do not invent scope, requirements, or constraints.
- Treat `./docs/plans/<plan-slug>/sdd.md` as the implementation-agnostic requirements contract when it exists.
- Preserve explicit problem statements, in-scope items, acceptance criteria, edge cases, out-of-scope items, constraints, and open questions from `./docs/plans/<plan-slug>/sdd.md` when present.
- If `./docs/plans/<plan-slug>/sdd.md` includes implementation ideas, separate them from binding requirements instead of promoting speculative details into scope.
- Ask only the minimum clarification questions needed for correctness or scope.
- Keep the plan proportional: concise for simple work, detailed for complex work.
- Treat `./docs/plans/<plan-slug>/sdd.md` as the source of truth for requirements when it exists.
- Include a concise requirements snapshot in the plan so each sub-task preserves the original intent.
- Map each sub-task to the specific requirements, constraints, or acceptance criteria it addresses.
- Use stable requirement IDs such as `R1`, `R2`, and `R3` in the Requirements Snapshot so sub-tasks can refer to them unambiguously.
- Make every sub-task self-contained enough that another agent can implement it directly from `plan.md` without a separate handoff file.
- Initialize every newly created sub-task with status `Pending`.
- If the work should be split across multiple PRs, keep each sub-task scoped tightly enough for one implementation pass.
- Prefer concrete validation commands or checks when known; otherwise describe the exact verification approach.
- **Agent selection:** resolve every delegated role with [`references/agent-selection.md`](references/agent-selection.md): inspect the runtime agent list, then project config/agent directories, then global definitions. Select the best available agent per capability and never hardcode bundled agent IDs.
- **Project type awareness:** Before selecting architecture/engineering agents, determine whether the project is a software project (has `package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, or similar language markers) or a non-software project (docs, config, design assets).
  - For **software projects**:
    - Run the `dh-domain-check` skill to validate the proposed scope against DDD bounded contexts and SOLID principles before writing the plan.
    - Run the `dh-contingency` skill when there are multiple plausible architectural approaches — generate Plan A/B/C with trade-off analysis to inform the plan structure.
    - Select the best available architecture/design agent for architectural patterns and the best available engineering agent for implementation suggestions (bundled capabilities as fallback).
    - Include a documentation sub-task (referencing `dh-create-documentation`) in the plan for any new modules, APIs, or public interfaces.
  - For **non-software projects**: skip software-specific architecture/engineering agents — their output is not applicable. Select a documentation or domain agent only when the plan needs one.
- Select a testing/QA agent for concrete languages or frameworks when one is available, using the same protocol.
- **Visual context:** when the plan changes architecture, data flow, components, lifecycle, or has critical/high-risk modifications, use `dh-mermaid` to create `./docs/plans/<plan-slug>/diagrams/` and link it from the plan's `## Visual Context`. Small or non-structural plans write `None — no structural change`.
- Set properly obsidian frontmatter metadata in all files

## Workflow

### Interview Mode (Optional Entry Point)

If the request lacks sufficient detail — no explicit goal, scope boundaries, acceptance criteria, or constraints — enter Interview Mode before the standard workflow:

1. Present the user with focused numbered questions from the question bank below.
2. Collect answers before proceeding.
3. Use the collected answers as the requirement source for the standard workflow.

**Question bank (ask only what's missing from the request):**

1. **Goal:** What is the main goal or outcome you want to achieve?
2. **Scope:** What specific features, systems, or changes should be included?
3. **Constraints:** Are there any constraints, dependencies, or technical requirements?
4. **Acceptance criteria:** How will you know this is done? What observable conditions must be met?
5. **Out of scope:** What should explicitly NOT be included in this work?
6. **Risks:** Are there any risks, edge cases, or areas requiring special care?
7. **Existing assets:** Is there existing code, documentation, or prior work to build on?

Before leaving interview mode, confirm the collected answers provide enough information to fill every relevant section of the plan template. If critical gaps remain, ask follow-up questions. Then proceed to the Standard Workflow below.

### Standard Workflow

0. **SDD gate:** if `./docs/plans/<plan-slug>/sdd.md` does NOT exist, invoke
   the `dh-grill-sdd` skill FIRST — it interviews the user and produces the
   requirements contract (SDD). Do not start plan creation without an SDD
   unless the user explicitly waives the gate.
1. Identify the goal, requirements, constraints, risks, dependencies, and out-of-scope items from the request (or interview answers).
2. If critical information is still missing (interview mode was skipped or partial), ask focused numbered questions before proceeding.
3. If `./docs/plans/<plan-slug>/sdd.md` exists extract a short requirements snapshot from it, including acceptance criteria, edge cases, out-of-scope boundaries, and constraints relevant to implementation, and assign stable IDs such as `R1`, `R2`, and `R3`. If it is an update request, preserve the original requirements and acceptance criteria from `./docs/plans/<plan-slug>/sdd.md` in the requirements snapshot, and call out any new requirements or changes as additions or modifications to the original requirements.
4. **Select agents:** after the requirements snapshot, inspect the runtime agent list (then project config/agent directories, then global definitions) and resolve the capability roles the plan will delegate — architecture/design, implementation/engineering, testing/QA, review, final review, documentation, and any domain specialist — using [`references/agent-selection.md`](references/agent-selection.md). Record the choices, rationale, and generic fallback in `## Agent Selection`; write `None — no specialized agent required` when nothing is delegated. Do this before any delegation.
5. **For software projects only:** If the scope involves architectural decisions or cross-module changes, run the `dh-domain-check` skill to validate bounded contexts and SOLID principles, and incorporate findings into the plan structure. If multiple plausible approaches exist, run the `dh-contingency` skill to explore alternatives before committing to a single path.
6. Break the work into **ordered phases**, and within each phase into
   **sub-tasks** with clear outcomes. Group phases by logical workstream; keep
   each phase independently completable.
7. For each sub-task, list the related requirements so downstream agents can trace the work back to the approved task.
8. For each sub-task, include its objective, dependencies, in-scope work, explicit non-goals, key risks, implementation suggestions, and validation guidance.
9. **For software projects:** Include a documentation sub-task that references the `dh-create-documentation` skill for any new modules, APIs, or public interfaces introduced by the plan.
10. **Create visual context:** invoke `dh-mermaid` for current state, desired state, critical changes, and component graph when applicable; write the diagrams under `./docs/plans/<plan-slug>/diagrams/` and link them from `## Visual Context`. Produce optional timeline/gantt diagrams only after phases are defined.
11. Initialize each newly created sub-task as `Pending` and each phase as `Pending`, and use explicit status markers such as `Pending`, `In Progress`, and `Completed` so agents can reliably pick the next sub-task. Status lines go immediately after the phase/sub-task header (parser contract).
12. Prefer concrete validation commands or checks when known.
13. Explain core concepts with appropriate code example when necessary.
14. Write a self-contained plan that can be executed without the conversation.
15. **Tools:** create the plan scaffold with the `dh_plan_create` tool when available (then fill details), and read/verify with `dh_plan_read`; fall back to manual writes using `references/phased-plan-template.md` when the tools are not installed. These tools are exposed by the project-scope `dh` MCP server; under Code Mode they are called as `tools.dh.<tool>`, and `dh_<tool>` is the tool's normalized name (permission actions match `dh_*`).
16. Update `./docs/plans/index.md` to add the new plan or reflect the update, including title, slug, description, timestamps and status.
17. Optionally use chrome mcp tools to validate the work via web if it is possible to do so, and include the results in the plan.

## Required Output Template

The output template is the phased template in
[`references/phased-plan-template.md`](references/phased-plan-template.md) —
use it verbatim (`## Phases` → `### Phase N: <title>` + `- **Status:**` →
`#### Sub-Task N.M: <title>` + full sub-task fields + `- **Status:**`). Do
not emit a flat `## Sub-Tasks` section in new plans.

Populate `## Agent Selection` (immediately before `## Phases`) whenever the
plan delegates work, following
[`references/agent-selection.md`](references/agent-selection.md). Write
`None — no specialized agent required` when no delegation is needed.

## Final Check

- The plan is complete, ordered, and actionable.
- The requirements snapshot preserves the approved task context and uses stable IDs.
- `## Agent Selection` is populated when delegation is used (or states `None — no specialized agent required`), and every selected agent exists in the current runtime.
- Explicit scope limits, acceptance criteria, and important edge cases from `./docs/plans/<plan-slug>/sdd.md` are preserved without inventing missing details.
- Each sub-task is explicitly mapped to the relevant requirements.
- Each newly created sub-task starts as `Pending`.
- Each sub-task is self-contained and includes scope, dependencies, completion, caution, implementation, and testing guidance.
- Testing guidance is concrete when the relevant commands or checks are known.
- `## Visual Context` exists and its links resolve (or it explicitly says `None — no structural change`).
- The plan stays within the requested scope.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
