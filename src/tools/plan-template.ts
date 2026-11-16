/**
 * plan-template.ts — markdown literals for the phased plan scaffold (M2).
 * Split from plan-lifecycle.ts to keep files under the 300-line rule.
 * Mirrors skills/dh-planning/references/phased-plan-template.md structure,
 * including the optional parallel metadata (rendered as its defaults).
 */
import type { PlanDocument } from './plan-lifecycle.js';
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

/** Quote a YAML scalar so titles with `:`/`#`/quotes stay valid. */
function yamlString(value: string): string {
  return JSON.stringify(value);
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
title: ${yamlString(input.title)}
slug: ${yamlString(input.slug)}
description: ${yamlString(input.title)}
created: ${today}
updated: ${today}
status: ${INITIAL_PHASE_STATUS}
active: true
tags: [plan]
project: ${yamlString(input.slug)}
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

/** Strip scaffold-time quoting (backticks/spaces) the parser also normalizes. */
function normalizeEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim();
}

function sameEntries(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => normalizeEntry(entry) === right[index]);
}

/**
 * Fail when the rendered scaffold does not parse back to the requested shape.
 * Guards the empty-title/newline class of bugs that `parsePlan` alone cannot
 * see (a dropped sub-task still yields a "valid" document).
 */
export function assertScaffoldRoundTrip(input: PlanScaffoldInput, plan: PlanDocument): void {
  function fail(message: string): never {
    throw new Error(`plan scaffold round-trip mismatch: ${message}`);
  }
  if (plan.phases.length !== input.phases.length) {
    fail(`expected ${input.phases.length} phases, parsed ${plan.phases.length}`);
  }
  input.phases.forEach((phaseInput, phaseIndex) => {
    const phase = plan.phases[phaseIndex];
    const ref = String(phaseIndex + 1);
    if (!phase) fail(`phase ${ref} is missing after parsing`);
    if (phase.index !== phaseIndex + 1) fail(`phase ${ref} has index ${phase.index}`);
    if (phase.title !== phaseInput.title.trim()) {
      fail(`phase ${ref} title '${phase.title}' !== '${phaseInput.title.trim()}'`);
    }
    if (phase.status !== INITIAL_PHASE_STATUS) fail(`phase ${ref} status ${phase.status} is not Pending`);
    if (phase.parallelizable !== (phaseInput.parallelizable ?? false)) {
      fail(`phase ${ref} parallelizable does not round-trip`);
    }
    if (!sameEntries(phaseInput.dependsOn ?? [], phase.dependsOn)) {
      fail(`phase ${ref} dependsOn does not round-trip`);
    }
    if (phase.subTasks.length !== phaseInput.subTasks.length) {
      fail(`phase ${ref} expected ${phaseInput.subTasks.length} sub-tasks, parsed ${phase.subTasks.length}`);
    }
    phaseInput.subTasks.forEach((subInput, subIndex) => {
      const subRef = `${ref}.${subIndex + 1}`;
      const sub = phase.subTasks[subIndex];
      if (!sub) fail(`sub-task ${subRef} is missing after parsing`);
      if (sub.index !== subRef) fail(`sub-task ${subRef} has index ${sub.index}`);
      if (sub.title !== subInput.title.trim()) {
        fail(`sub-task ${subRef} title '${sub.title}' !== '${subInput.title.trim()}'`);
      }
      if (sub.status !== INITIAL_PHASE_STATUS) fail(`sub-task ${subRef} status ${sub.status} is not Pending`);
      if (sub.delegatedTo !== subInput.delegatedTo.trim()) {
        fail(`sub-task ${subRef} delegatedTo '${sub.delegatedTo}' !== '${subInput.delegatedTo.trim()}'`);
      }
      if (sub.parallelizable !== (subInput.parallelizable ?? false)) {
        fail(`sub-task ${subRef} parallelizable does not round-trip`);
      }
      if (!sameEntries(subInput.dependsOn ?? [], sub.dependsOn)) {
        fail(`sub-task ${subRef} dependsOn does not round-trip`);
      }
      if (!sameEntries(subInput.filesScope ?? [], sub.filesScope)) {
        fail(`sub-task ${subRef} filesScope does not round-trip`);
      }
      if (sub.isolation !== (subInput.isolation ?? 'shared')) {
        fail(`sub-task ${subRef} isolation does not round-trip`);
      }
    });
  });
}
