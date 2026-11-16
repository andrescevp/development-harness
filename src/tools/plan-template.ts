/**
 * plan-template.ts — markdown literals for the phased plan scaffold (M2).
 * Split from plan-lifecycle.ts to keep files under the 300-line rule.
 * Mirrors skills/dh-planning/references/phased-plan-template.md structure,
 * including the optional parallel metadata (rendered as its defaults).
 */
import type { PlanIsolation } from './plan-metadata.js';

/** Status every scaffolded phase/sub-task starts with (index rows reuse it). */
export const INITIAL_PHASE_STATUS = 'Pending' as const;

const SUB_TASK_SKELETON = (delegatedTo: string, options: SubTaskOptions) => `- **Status:** ${INITIAL_PHASE_STATUS}
- **Delegated to agent:** ${delegatedTo}
- **Parallelizable:** ${options.parallelizable ? 'yes' : 'no'}
- **Depends on:** ${options.dependsOn.length ? options.dependsOn.join(', ') : 'None'}
- **Files/Scope:** ${options.filesScope.length ? options.filesScope.join(', ') : 'None'}
- **Isolation:** ${options.isolation}
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
- **Done When:** [Observable completion conditions]`;

interface SubTaskOptions {
  parallelizable: boolean;
  dependsOn: string[];
  filesScope: string[];
  isolation: PlanIsolation;
}

interface PhaseOptions {
  parallelizable: boolean;
  dependsOn: string[];
}

function subTaskBlock(
  phaseNumber: number,
  subNumber: number,
  title: string,
  delegatedTo: string,
  options: SubTaskOptions
): string {
  return `#### Sub-Task ${phaseNumber}.${subNumber}: ${title}

${SUB_TASK_SKELETON(delegatedTo, options)}`;
}

function phaseBlock(phaseNumber: number, title: string, subTaskBlocks: string[], options: PhaseOptions): string {
  const subs = subTaskBlocks.join('\n\n');
  return `### Phase ${phaseNumber}: ${title}

- **Status:** ${INITIAL_PHASE_STATUS}
- **Parallelizable:** ${options.parallelizable ? 'yes' : 'no'}
- **Depends on:** ${options.dependsOn.length ? options.dependsOn.join(', ') : 'None'}

${subs}`;
}

export interface PlanScaffoldInput {
  title: string;
  slug: string;
  objective: string;
  phases: {
    title: string;
    parallelizable?: boolean;
    dependsOn?: string[];
    subTasks: {
      title: string;
      delegatedTo: string;
      parallelizable?: boolean;
      dependsOn?: string[];
      filesScope?: string[];
      isolation?: PlanIsolation;
    }[];
  }[];
}

export function planScaffold(input: PlanScaffoldInput): string {
  const today = new Date().toISOString().slice(0, 10);
  const phaseBlocks = input.phases
    .map((p, i) =>
      phaseBlock(
        i + 1,
        p.title,
        p.subTasks.map((s, j) =>
          subTaskBlock(i + 1, j + 1, s.title, s.delegatedTo, {
            parallelizable: s.parallelizable ?? false,
            dependsOn: s.dependsOn ?? [],
            filesScope: s.filesScope ?? [],
            isolation: s.isolation ?? 'shared',
          })
        ),
        { parallelizable: p.parallelizable ?? false, dependsOn: p.dependsOn ?? [] }
      )
    )
    .join('\n\n');

  return `---
title: ${input.title}
slug: ${input.slug}
description: ${input.title}
created: ${today}
updated: ${today}
status: ${INITIAL_PHASE_STATUS}
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

## Workspace Impact

- **Workspace root:** [absolute workspace root, or None — standalone repository]
- **Affected packages:** [package paths, or None — standalone]
- **Shared paths:** [root/shared files touched, e.g. docs/, AGENTS.md, pnpm-workspace.yaml; or None]

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| [package] | [stack] | [test command] | [build command] | [docs root] | [fixed \\| independent] |

## Assumptions and Constraints

- [Known assumptions, dependencies, constraints]

## Risks and Areas Requiring Care

- [Key risks, compatibility concerns, or failure modes]

## Core concepts

Explain core concepts with code level example if necessary.

## Visual Context

None — no structural change.

> \`dh-mermaid\` replaces this line with links under \`./diagrams/\` when the plan has visual impact.

## Research

Optional \`dh-research\` notes that back this plan (single registry:
\`docs/research/\`); write \`None — no research consulted\` when none apply, or
link notes as \`../../research/<topic>.md\`.

- None — no research consulted.

## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| [role] | [agent] | [reason] | [generic fallback] |

> Every sub-task's \`Delegated to agent\` must match an agent in this table; keep the table before \`## Phases\`.

## Phases

${phaseBlocks}

## Final Integration & Verification

- **System-Wide Test:** [End-to-end verification]
- **Completion Checklist:** [Final checks]

## Execution Record

- **Execution status:** [In progress | Completed | Completed with deferrals | Not executed]
- **Executed at:** [YYYY-MM-DD]
- **Workspace root:** [absolute workspace root]
- **Repository kind:** [workspace | nested project | submodule | worktree]
- **Repository path:** [workspace-relative path; \`.\` for the workspace root]
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
`;
}
