/**
 * plan-template.ts — markdown literals for the phased plan scaffold (M2).
 * Split from plan-lifecycle.ts to keep files under the 300-line rule.
 * Mirrors skills/planning/references/phased-plan-template.md structure.
 */

export const SUB_TASK_SKELETON = `- **Status:** Pending
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
- **Done When:** [Observable completion conditions]`

export function subTaskBlock(phaseNumber: number, subNumber: number, title: string): string {
  return `#### Sub-Task ${phaseNumber}.${subNumber}: ${title}

${SUB_TASK_SKELETON}`
}

export function phaseBlock(phaseNumber: number, title: string, subTaskBlocks: string[]): string {
  const subs = subTaskBlocks.join("\n\n")
  return `### Phase ${phaseNumber}: ${title}

- **Status:** Pending

${subs}`
}

export function planScaffold(input: {
  title: string
  slug: string
  objective: string
  phases: { title: string; subTasks: { title: string }[] }[]
}): string {
  const today = new Date().toISOString().slice(0, 10)
  const phaseBlocks = input.phases
    .map((p, i) => phaseBlock(i + 1, p.title, p.subTasks.map((s, j) => subTaskBlock(i + 1, j + 1, s.title))))
    .join("\n\n")

  return `---
title: ${input.title}
slug: ${input.slug}
description: ${input.title}
created: ${today}
updated: ${today}
status: Pending
active: true
tags: [plan]
project: ${input.slug}
---

# Plan: ${input.title}

## Objective

${input.objective}

## Requirements Snapshot

- **R1:** [Relevant requirement, acceptance criterion, or constraint]

## Scope

- [In-scope work]

## Assumptions and Constraints

- [Known assumptions, dependencies, constraints]

## Risks and Areas Requiring Care

- [Key risks, compatibility concerns, or failure modes]

## Core concepts

Explain core concepts with code level example if necessary.

## Phases

${phaseBlocks}

## Final Integration & Verification

- **System-Wide Test:** [End-to-end verification]
- **Completion Checklist:** [Final checks]

## Open Questions

- [Only if important non-blocking uncertainty remains]
`
}