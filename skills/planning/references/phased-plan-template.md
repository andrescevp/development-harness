# Phased Plan Template (authoritative format contract)

This file is the **canonical format specification** for phased plans. The
`planning` skill must produce this shape; the harness `plan_read` /
`plan_update_status` tools (ST2) parse exactly this shape. If anything
changes here, update the canonical fixture
(`src/__tests__/fixtures/plans/phased-plan.md`) in the same change.

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
6. Valid statuses: `Pending`, `In Progress`, `Completed`.
7. A sub-task's phase is derived from its `N` prefix (Sub-Task 2.1 belongs to
   Phase 2), so mis-numbered sub-tasks are format errors.
8. The Requirements Snapshot with stable IDs (R1, R2, …) is preserved; each
   sub-task maps to requirements via its `Related Requirements` field.
9. The phases region runs from `## Phases` to the next top-level `##`
   heading (e.g. `## Final Integration & Verification`) or EOF.

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

## Assumptions and Constraints

- [Known assumptions, dependencies, constraints]

## Risks and Areas Requiring Care

- [Key risks, compatibility concerns, or failure modes]

## Core concepts

Explain core concepts with code level example if necessary.

## Phases

### Phase 1: <Phase title>

- **Status:** Pending

#### Sub-Task 1.1: <Clear title>

- **Status:** Pending
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
- **Objective:** ...

### Phase 2: <Phase title>

- **Status:** Pending

#### Sub-Task 2.1: <Clear title>

- **Status:** Pending
- **Objective:** ...

## Final Integration & Verification

- **System-Wide Test:** [End-to-end verification]
- **Completion Checklist:** [Final checks]

## Open Questions

- [Only if important non-blocking uncertainty remains]
```

## Phase lifecycle (execution contract)

- Phase `Pending` → `In Progress` when its first sub-task starts.
- Phase `Completed` only when ALL its sub-tasks are `Completed`.
- Resume mode: continue the first `In Progress` phase, then its first
  `In Progress` / `Pending` sub-task.
- Hard blockers halt the loop (see AGENTS.md step 2.4): never mark a phase
  `Completed` around a blocked sub-task.