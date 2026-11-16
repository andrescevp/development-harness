/**
 * plan-progress.ts — pure `PlanProgress` derivation (§3.4, §5, §6, §7).
 *
 * Receives file contents (never the filesystem), the selected candidate and the
 * sidecar reads for that slug. `parsePlan` stays authoritative for phases,
 * sub-tasks and statuses; this module only derives counts, position,
 * checklists, review, fast state and issues.
 */
import { type PlanDocument, parsePlan } from '../tools/plan-lifecycle.js';
import { type ChecklistExtraction, extractChecklists } from './plan-checklists.js';
import { type PlanIssue, planIssue } from './plan-issue.js';
import {
  type ActiveSubTask,
  type CurrentPosition,
  type CurrentPositionSource,
  countStatuses,
  type PhaseProgress,
  type PlanCandidate,
  type PlanDetails,
  type PlanProgress,
  type PlanStatus,
  type StatusCounts,
  type SubTaskProgress,
} from './plan-model.js';
import { deriveFastState, parseReview } from './plan-review.js';
import type { ReviewState } from './plan-sidecars.js';

const MAX_SUBTASK_CHECKBOXES = 50;

function headingLines(contents: string): { phases: Map<number, number>; subTasks: Map<string, number> } {
  const phases = new Map<number, number>();
  const subTasks = new Map<string, number>();
  const lines = contents.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').replace(/\r$/, '');
    const phase = line.match(/^###\s+Phase\s+(\d+):/);
    if (phase) phases.set(Number(phase[1]), index + 1);
    const subTask = line.match(/^####\s+Sub-Task\s+(\d+)\.(\d+):/);
    if (subTask) subTasks.set(`${subTask[1]}.${subTask[2]}`, index + 1);
  }
  return { phases, subTasks };
}

function titleOf(document: PlanDocument, contents: string, slug: string): string {
  const declared = document.title?.trim();
  if (declared) return declared;
  const heading = contents.match(/^#\s+Plan:\s+(.+?)\s*$/m);
  return heading?.[1]?.trim() || slug;
}

/** Lifecycle-aligned position (§5.3): first In Progress phase, else next Pending. */
function deriveCurrent(phases: readonly PhaseProgress[]): {
  current: CurrentPosition;
  activeSubTasks: ActiveSubTask[];
  warnings: PlanIssue[];
} {
  const warnings: PlanIssue[] = [];
  const started = phases.find((phase) => phase.status === 'In Progress');
  const next = started === undefined ? phases.find((phase) => phase.status === 'Pending') : undefined;
  const phase = started ?? next ?? null;
  const activeSubTasks: ActiveSubTask[] = phases.flatMap((entry) =>
    entry.subTasks
      .filter((subTask) => subTask.status === 'In Progress')
      .map((subTask) => ({
        index: subTask.index,
        title: subTask.title,
        delegatedTo: subTask.delegatedTo,
        phase: { index: entry.index, title: entry.title },
      }))
  );
  if (phase === null) {
    const current: CurrentPosition = {
      phase: null,
      subTask: null,
      label: 'Completed',
      position: null,
      ordinal: null,
      source: 'done',
    };
    return { current, activeSubTasks, warnings };
  }
  if (started === undefined && phase.subTasks.some((subTask) => subTask.status === 'In Progress')) {
    warnings.push(
      planIssue('phase-status-mismatch', 'warning', null, `phase ${phase.index} is Pending but has started sub-tasks`)
    );
  }
  const subTask =
    activeSubTasks.find((entry) => entry.phase.index === phase.index) ??
    phase.subTasks.find((entry) => entry.status === 'In Progress') ??
    phase.subTasks.find((entry) => entry.status === 'Pending') ??
    null;
  const source: CurrentPositionSource = started === undefined ? 'next-pending' : 'in-progress';
  const subTaskOrdinal = subTask === null ? null : Number(subTask.index.split('.')[1]);
  const suffix = activeSubTasks.length > 1 ? ` +${activeSubTasks.length - 1}` : '';
  return {
    current: {
      phase: { index: phase.index, title: phase.title },
      subTask:
        subTask === null ? null : { index: subTask.index, title: subTask.title, delegatedTo: subTask.delegatedTo },
      label: subTask === null ? `Phase ${phase.index}` : `Phase ${phase.index} · ${subTask.index}${suffix}`,
      position: subTask?.index ?? null,
      ordinal: { phase: phase.index, subTask: subTaskOrdinal },
      source,
    },
    activeSubTasks,
    warnings,
  };
}

function buildPhases(
  document: PlanDocument,
  lines: { phases: Map<number, number>; subTasks: Map<string, number> },
  extraction: ChecklistExtraction
): PhaseProgress[] {
  return document.phases.map((phase) => {
    const subTasks: SubTaskProgress[] = phase.subTasks.map((subTask) => ({
      index: subTask.index,
      title: subTask.title,
      status: subTask.status,
      delegatedTo: subTask.delegatedTo,
      relatedRequirements: subTask.relatedRequirements,
      criteria: extraction.criteria[subTask.index] ?? [],
      checkboxes: (extraction.bySubTask[subTask.index] ?? []).slice(0, MAX_SUBTASK_CHECKBOXES),
      line: lines.subTasks.get(subTask.index) ?? 0,
    }));
    return {
      index: phase.index,
      title: phase.title,
      status: phase.status,
      subTasks,
      counts: countStatuses(subTasks.map((subTask) => subTask.status)),
      line: lines.phases.get(phase.index) ?? 0,
    };
  });
}

function progressOf(counts: StatusCounts): { ratio: number; percent: number } {
  const ratio = counts.total === 0 ? 0 : Math.round((counts.completed / counts.total) * 1e4) / 1e4;
  return { ratio, percent: Math.round(ratio * 100) };
}

/**
 * Build the selected plan's progress model. Throws the parser/derivation errors
 * the caller maps to `PlanIssue` values (contract §3.3, §5.1).
 */
export function derivePlanProgress(input: {
  candidate: PlanCandidate;
  planContents: string;
  details: PlanDetails;
  now: string;
}): PlanProgress {
  const { candidate, planContents, details } = input;
  const document = parsePlan(planContents, candidate.path);
  const extraction = extractChecklists(planContents, candidate.path);
  const lines = headingLines(planContents);
  const phases = buildPhases(document, lines, extraction);
  const subTasks = phases.flatMap((phase) => phase.subTasks);
  const counts = {
    phases: countStatuses(phases.map((phase) => phase.status)),
    subTasks: countStatuses(subTasks.map((subTask) => subTask.status)),
  };
  const warnings: PlanIssue[] = [...details.warnings];
  const status: PlanStatus = candidate.status === 'Unknown' ? 'Pending' : candidate.status;
  if (candidate.status === 'Unknown') {
    warnings.push(planIssue('invalid-status', 'warning', candidate.path, 'plan status unknown; using Pending'));
  }
  const position = deriveCurrent(phases);
  warnings.push(...position.warnings);

  const review: ReviewState = parseReview(details.review);
  warnings.push(...review.issues);
  const fast = deriveFastState({ planContents, source: document, details });
  warnings.push(...fast.warnings);

  return {
    slug: candidate.slug,
    title: titleOf(document, planContents, candidate.slug),
    path: candidate.path,
    absPath: details.absPath,
    status,
    active: candidate.active === true,
    updatedAt: candidate.updatedAt,
    updatedSource: candidate.updatedSource,
    phases,
    counts,
    progress: progressOf(counts.subTasks),
    current: position.current,
    activeSubTasks: position.activeSubTasks,
    checklists: { plan: extraction.plan, finalVerification: extraction.finalVerification },
    review,
    fast: fast.fast,
    errors: [...details.errors],
    warnings,
  };
}
