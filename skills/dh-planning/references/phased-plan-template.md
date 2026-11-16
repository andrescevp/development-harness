# Phased Plan Template (authoritative format contract)

This file is the **canonical format specification** for phased plans. The
`dh-planning` skill must produce this shape; the harness `plan_read` /
`plan_update_status` tools (ST2) parse exactly this shape. If anything
changes here, update the canonical fixture
(`src/__tests__/fixtures/plans/phased-plan.md`) in the same change.
Agent choices follow [`agent-selection.md`](agent-selection.md).

## Marker rules (parser contract)

1. Phases live under a `## Phases` heading.
2. Each phase is `### Phase N: <title>` (N is 1-based, ordered).
3. The **first** `- **Status:**` bullet in a phase section is the phase
   status; only blank lines may precede it, and it must appear before any
   other heading or field bullet (the next `#### Sub-Task` header).
4. Each sub-task is `#### Sub-Task N.M: <title>` (N = phase number, M =
   1-based sub-task number within the phase).
5. The **first** `- **Status:**` bullet in a sub-task section is the
   sub-task status; only blank lines may precede it, and it must appear
   before any other heading or field bullet.
6. Every sub-task carries `- **Delegated to agent:** <agent-id>` after the
   status and before the other fields. It names the single agent responsible
   for executing that sub-task and must match a role/agent recorded in
   `## Agent Selection`.
7. Valid statuses: `Pending`, `In Progress`, `Completed`.
8. A sub-task's phase is derived from its `N` prefix (Sub-Task 2.1 belongs to
   Phase 2), so mis-numbered sub-tasks are format errors.
9. The Requirements Snapshot with stable IDs (R1, R2, …) is preserved; each
   sub-task maps to requirements via its `Related Requirements` field.
10. The phases region runs from `## Phases` to the next top-level `##`
    heading (e.g. `## Final Integration & Verification`) or EOF.
11. `## Agent Selection` sits before `## Phases`; it is outside the phases
    region, so the parser ignores it for phase/sub-task extraction.
12. `## Workspace Impact` (after `## Scope`), `## Research` (after
    `## Visual Context`) and `## Execution Record` (after
    `## Final Integration & Verification`) are optional top-level sections
    outside the phases region; legacy plans without them parse unchanged.
13. `## Research` links research notes and carries no status markers, so the
    parser ignores it; never move it or a research link inside `## Phases`.

## Template

```markdown
---
title: <Plan title>
slug: <plan-slug>
description: <one-line description>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
status: Pending
active: true
tags: [plan]
project: <project>
---

# Plan: <Clear task title>

## Objective

[Goal and intended outcome]

## Requirements Snapshot

- **R1:** [Relevant requirement, acceptance criterion, or constraint]
- **R2:** [Another requirement]

## Scope

- [In-scope work]

## Workspace Impact

- **Workspace root:** [absolute workspace root, or `None — standalone repository`]
- **Affected packages:** [package paths, or `None — standalone`]
- **Shared paths:** [root/shared files touched, e.g. `docs/`, `AGENTS.md`, `pnpm-workspace.yaml`; or `None`]

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| [package] | [stack] | [test command] | [build command] | [docs root] | [fixed \| independent] |

## Assumptions and Constraints

- [Known assumptions, dependencies, constraints]

## Risks and Areas Requiring Care

- [Key risks, compatibility concerns, or failure modes]

## Core concepts

Explain core concepts with code level example if necessary.

## Visual Context

None — no structural change.

> `dh-mermaid` replaces this line with links under `./diagrams/` when the plan has visual impact.

## Research

Optional `dh-research` notes that back this plan (single registry:
`docs/research/`); write `None — no research consulted` when none apply.

- [Node 20 EOL](../../research/node-eol.md) — verified 2026-11-15; drives R4.

## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| [role] | [agent or None] | [reason] | [generic fallback] |

> Populate with the agent-selection protocol; write `None — no specialized agent required` when no delegation is needed.

## Phases

### Phase 1: <Phase title>

- **Status:** Pending

#### Sub-Task 1.1: <Clear title>

- **Status:** Pending
- **Delegated to agent:** <agent-id from Agent Selection>
- **Objective:** [What this sub-task should accomplish]
- **Related Requirements:** [Requirement IDs]
- **Dependencies and Preconditions:** [Prerequisites]
- **In Scope for This Sub-Task:** [Concrete work]
- **Out of Scope for This Sub-Task:** [Nearby work excluded]
- **Instructions:** [Specific actions]
- **Acceptance Criteria:** [How to know it is done]
- **Cautionary Points (Risks & Edge Cases):** [Where to be careful]
- **Implementation Suggestions:** [Practical guidance]
- **Testing Suggestions:** [Validation commands or checks]
- **Done When:** [Observable completion conditions]

#### Sub-Task 1.2: <Clear title>

- **Status:** Pending
- **Delegated to agent:** <agent-id from Agent Selection>
- **Objective:** ...

### Phase 2: <Phase title>

- **Status:** Pending

#### Sub-Task 2.1: <Clear title>

- **Status:** Pending
- **Delegated to agent:** <agent-id from Agent Selection>
- **Objective:** ...

## Final Integration & Verification

- **System-Wide Test:** [End-to-end verification]
- **Completion Checklist:** [Final checks]

## Execution Record

- **Execution status:** [In progress | Completed | Completed with deferrals | Not executed]
- **Executed at:** [YYYY-MM-DD]
- **Workspace root:** [absolute workspace root]
- **Repository kind:** [workspace | nested project | submodule | worktree]
- **Repository path:** [workspace-relative path; `.` for the workspace root]
- **Branch / worktree:** [branch; worktree path when not the main checkout]
- **Commit range:** [base..head]
- **Plan path:** docs/plans/<plan-slug>/plan.md
- **Mirrored plan path:** [none, or the non-authoritative copy path]
- **Summary:**
  - [What shipped]
- **Architectural changes:** [ADRs/contracts/interfaces created or changed, or None]
- **References:** [review, handoff, evolution note and ADR links]

## Open Questions

- [Only if important non-blocking uncertainty remains]
```

## Optional top-level sections

- `## Workspace Impact` goes after `## Scope` and before
  `## Assumptions and Constraints`; `## Execution Record` goes after
  `## Final Integration & Verification` and before `## Open Questions`. Both
  are top-level sections **outside** `## Phases`, so the parser ignores them.
- `## Research` goes after `## Visual Context` and before `## Agent Selection`.
  It is optional, holds relative links to `docs/research/` notes, and carries
  no status markers; the fast mirror omits it on purpose, so links live in
  `plan.md` only.
- `## Workspace Impact` is optional: a standalone repository writes
  `None — standalone repository` for the root and affected packages. When
  `WORKSPACE.md` exists at the workspace root, `dh-planning` fills the section
  from the map — affected packages are declared, never inferred from the cwd
  ([`workspace-map.md`](../../dh-setup/references/workspace-map.md)).
- `## Execution Record` is filled when the plan executes (T1/T3); see
  [`execution-record.md`](execution-record.md). Legacy plans without it stay
  valid.

## Delegated agent field

Every new sub-task must name its responsible agent:

- The value must match an agent recorded in `## Agent Selection` (role table).
- `dh_plan_create` requires `delegatedTo` for every sub-task and renders it in
  the scaffold.
- `plan_read` exposes it as `delegatedTo`; legacy plans without the field parse
  as `null` but are not executable under the delegation contract.
- Execution uses the field as the single responsible agent. A missing,
  malformed, or unavailable agent is a hard stop — do not substitute silently.

## Phase lifecycle (execution contract)

- Phase `Pending` → `In Progress` when its first sub-task starts.
- Phase `Completed` only when ALL its sub-tasks are `Completed`.
- Resume mode: continue the first `In Progress` phase, then its first
  `In Progress` / `Pending` sub-task.
- Hard blockers halt the loop (see AGENTS.md step 2.4): never mark a phase
  `Completed` around a blocked sub-task.