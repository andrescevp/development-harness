---
name: dh-planning
description: Use this skill when writing clear, detailed, step-by-step implementation plans to ./docs/plans/<plan-slug>/plan.md so any human or agent can execute the task — breaking work into ordered phases (each phase with sub-tasks), with objectives, requirements mapping (stable IDs), in-scope/out-of-scope items, acceptance criteria, validation guidance, and a requirements snapshot, then updating index.md; before planning it runs the SDD gate — if ./docs/plans/<plan-slug>/sdd.md does not exist it invokes dh-grill-sdd to interview the user and produce the requirements contract, then maps plan sub-tasks to the SDD's stable IDs; the phased template and parser contract live in references/phased-plan-template.md and the harness plan tools (dh_plan_create / dh_plan_read) may scaffold and verify plans when installed. Use when planning implementation work, breaking down tasks, or when the user says 'plan this' or 'create a plan' — not for purely advisory, exploratory, or review-only requests; ask structured questions when the request lacks detail.
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
- Do not modify any file other than `./docs/plans/<plan-slug>/plan.md`.
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
- **Project type awareness:** Before delegating to architecture/engineering agents, determine whether the project is a software project (has `package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, or similar language markers) or a non-software project (docs, config, design assets).
  - For **software projects**:
    - Run the `dh-domain-check` skill to validate the proposed scope against DDD bounded contexts and SOLID principles before writing the plan.
    - Run the `contingency` skill when there are multiple plausible architectural approaches — generate Plan A/B/C with trade-off analysis to inform the plan structure.
    - Delegate to `@*-architect` agents for architectural patterns and `@*-engineer` agents for implementation suggestions.
    - Include a documentation sub-task (referencing `dh-create-documentation`) in the plan for any new modules, APIs, or public interfaces.
  - For **non-software projects**: skip delegation to `@*-architect` and `@*-engineer` agents — these produce software-specific output that is not applicable. Use `@build` if builder input is needed.
- Delegate to `@*-qa` agents for concrete languages or frameworks if available to get testing suggestions.
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
4. **For software projects only:** If the scope involves architectural decisions or cross-module changes, run the `dh-domain-check` skill to validate bounded contexts and SOLID principles, and incorporate findings into the plan structure. If multiple plausible approaches exist, run the `contingency` skill to explore alternatives before committing to a single path.
5. Break the work into **ordered phases**, and within each phase into
   **sub-tasks** with clear outcomes. Group phases by logical workstream; keep
   each phase independently completable.
6. For each sub-task, list the related requirements so downstream agents can trace the work back to the approved task.
7. For each sub-task, include its objective, dependencies, in-scope work, explicit non-goals, key risks, implementation suggestions, and validation guidance.
8. **For software projects:** Include a documentation sub-task that references the `dh-create-documentation` skill for any new modules, APIs, or public interfaces introduced by the plan.
9. Initialize each newly created sub-task as `Pending` and each phase as `Pending`, and use explicit status markers such as `Pending`, `In Progress`, and `Completed` so agents can reliably pick the next sub-task. Status lines go immediately after the phase/sub-task header (parser contract).
10. Prefer concrete validation commands or checks when known.
11. Explain core concepts with appropriate code example when necessary.
12. Write a self-contained plan that can be executed without the conversation.
13. **Tools:** create the plan scaffold with the `dh_plan_create` tool when available (then fill details), and read/verify with `dh_plan_read`; fall back to manual writes using `references/phased-plan-template.md` when the tools are not installed.
14. Update `./docs/plans/index.md` to add the new plan or reflect the update, including title, slug, description, timestamps and status.
15. Optionally use chrome mcp tools to validate the work via web if it is possible to do so, and include the results in the plan.

## Required Output Template

The output template is the phased template in
[`references/phased-plan-template.md`](references/phased-plan-template.md) —
use it verbatim (`## Phases` → `### Phase N: <title>` + `- **Status:**` →
`#### Sub-Task N.M: <title>` + full sub-task fields + `- **Status:**`). Do
not emit a flat `## Sub-Tasks` section in new plans.

## Final Check

- The plan is complete, ordered, and actionable.
- The requirements snapshot preserves the approved task context and uses stable IDs.
- Explicit scope limits, acceptance criteria, and important edge cases from `./docs/plans/<plan-slug>/sdd.md` are preserved without inventing missing details.
- Each sub-task is explicitly mapped to the relevant requirements.
- Each newly created sub-task starts as `Pending`.
- Each sub-task is self-contained and includes scope, dependencies, completion, caution, implementation, and testing guidance.
- Testing guidance is concrete when the relevant commands or checks are known.
- The plan stays within the requested scope.
