/**
 * plan-fast-sync.ts — compare/synchronize the fast mirror against plan.md.
 *
 * Apply is fast→plan only: structural mismatches and plan-ahead statuses
 * require explicit confirmation. Phase closes are applied to both plans.
 * At plan-end, sync is a no-write equality gate: any difference returns
 * requiresConfirmation and nothing is written.
 */
import { writeFileAtomic } from '../lib/atomic-write.js';
import type { FastPaths } from './plan-fast.js';
import { readFastContents, resolveFastPaths, storedSha } from './plan-fast.js';
import { computeSourceSha256 } from './plan-fast-template.js';
import { readPlanFile } from './plan-io.js';
import type { PhaseStatus, PlanDocument, StatusTarget } from './plan-lifecycle.js';
import { parsePlan, setStatus } from './plan-lifecycle.js';

export type FastSyncPhase = 'pre-execution' | 'plan-end';

export interface FastSyncDifference {
  ref: string;
  kind: 'phase' | 'subtask' | 'structure';
  planStatus?: PhaseStatus;
  fastStatus?: PhaseStatus;
  action: 'structure-mismatch' | 'mirror-fast-to-plan' | 'plan-ahead' | 'close-phase';
  severity: 'P0' | 'P1' | 'P2';
}

export type FastSyncResult =
  | { ok: true; aligned: boolean; differences: FastSyncDifference[]; sourceSha256: string; stale: boolean }
  | { ok: false; requiresConfirmation: true; differences: FastSyncDifference[] }
  | {
      ok: true;
      applied: true;
      differences: FastSyncDifference[];
      plan: PlanDocument;
      fastPlan: PlanDocument;
      sourceSha256: string;
      stale: boolean;
    };

const STATUS_RANK: Record<PhaseStatus, number> = { Pending: 0, 'In Progress': 1, Completed: 2 };

function sameStructure(fast: PlanDocument, plan: PlanDocument): boolean {
  if (fast.phases.length !== plan.phases.length) return false;
  return plan.phases.every((planPhase, i) => {
    const fastPhase = fast.phases[i];
    if (!fastPhase || fastPhase.index !== planPhase.index || fastPhase.title !== planPhase.title) return false;
    if (fastPhase.subTasks.length !== planPhase.subTasks.length) return false;
    return planPhase.subTasks.every((planSub, j) => {
      const fastSub = fastPhase.subTasks[j];
      return Boolean(
        fastSub &&
          fastSub.index === planSub.index &&
          fastSub.title === planSub.title &&
          fastSub.delegatedTo === planSub.delegatedTo
      );
    });
  });
}

function structureDifferences(fast: PlanDocument, plan: PlanDocument): FastSyncDifference[] {
  return sameStructure(fast, plan)
    ? []
    : [{ ref: 'structure', kind: 'structure', action: 'structure-mismatch', severity: 'P0' }];
}

function statusDifference(
  kind: 'phase' | 'subtask',
  ref: string,
  planStatus: PhaseStatus,
  fastStatus: PhaseStatus,
  phase: FastSyncPhase
): FastSyncDifference | undefined {
  const delta = STATUS_RANK[fastStatus] - STATUS_RANK[planStatus];
  if (delta === 0) return undefined;
  if (delta > 0) {
    return {
      ref,
      kind,
      planStatus,
      fastStatus,
      action: 'mirror-fast-to-plan',
      severity: phase === 'plan-end' ? 'P1' : 'P2',
    };
  }
  return { ref, kind, planStatus, fastStatus, action: 'plan-ahead', severity: 'P1' };
}

function statusDifferences(fast: PlanDocument, plan: PlanDocument, phase: FastSyncPhase): FastSyncDifference[] {
  const diffs: FastSyncDifference[] = [];
  for (const planPhase of plan.phases) {
    const fastPhase = fast.phases.find((candidate) => candidate.index === planPhase.index);
    if (!fastPhase) continue;
    const phaseDiff = statusDifference('phase', String(planPhase.index), planPhase.status, fastPhase.status, phase);
    if (phaseDiff) diffs.push(phaseDiff);
    for (const planSub of planPhase.subTasks) {
      const fastSub = fastPhase.subTasks.find((candidate) => candidate.index === planSub.index);
      if (!fastSub) continue;
      const subDiff = statusDifference('subtask', planSub.index, planSub.status, fastSub.status, phase);
      if (subDiff) diffs.push(subDiff);
    }
  }
  return diffs;
}

function closePhaseRefs(fast: PlanDocument, plan: PlanDocument): string[] {
  const refs: string[] = [];
  for (const planPhase of plan.phases) {
    const fastPhase = fast.phases.find((candidate) => candidate.index === planPhase.index);
    if (!fastPhase || planPhase.subTasks.length === 0) continue;
    const allDoneBoth =
      planPhase.subTasks.every((sub) => sub.status === 'Completed') &&
      fastPhase.subTasks.every((sub) => sub.status === 'Completed');
    if (allDoneBoth && planPhase.status !== 'Completed' && fastPhase.status !== 'Completed') {
      refs.push(String(planPhase.index));
    }
  }
  return refs;
}

function closePhaseDifference(ref: string, phase: FastSyncPhase): FastSyncDifference {
  return { ref, kind: 'phase', action: 'close-phase', severity: phase === 'plan-end' ? 'P1' : 'P2' };
}

function applyDifferences(
  paths: FastPaths,
  fastContents: string,
  planContents: string,
  differences: FastSyncDifference[],
  phase: FastSyncPhase
): { plan: PlanDocument; fastPlan: PlanDocument; differences: FastSyncDifference[] } {
  let nextPlan = planContents;
  let nextFast = fastContents;
  const appliedDiffs = [...differences];
  const mirrorDiffs = differences.filter((candidate) => candidate.action === 'mirror-fast-to-plan');
  const orderedMirror = [
    ...mirrorDiffs.filter((diff) => diff.kind === 'subtask'),
    ...mirrorDiffs.filter((diff) => diff.kind === 'phase'),
  ];
  for (const diff of orderedMirror) {
    nextPlan = setStatus(nextPlan, diff.kind as StatusTarget, diff.ref, diff.fastStatus!).contents;
  }

  const closeRefs = new Set(differences.filter((diff) => diff.action === 'close-phase').map((diff) => diff.ref));
  for (const ref of closePhaseRefs(parsePlan(nextFast), parsePlan(nextPlan))) closeRefs.add(ref);
  for (const ref of closeRefs) {
    if (!appliedDiffs.some((diff) => diff.action === 'close-phase' && diff.ref === ref)) {
      appliedDiffs.push(closePhaseDifference(ref, phase));
    }
    const fastPhase = parsePlan(nextFast).phases.find((candidate) => candidate.index === Number(ref));
    if (fastPhase && fastPhase.status !== 'Completed') {
      nextFast = setStatus(nextFast, 'phase', ref, 'Completed').contents;
    }
    nextPlan = setStatus(nextPlan, 'phase', ref, 'Completed').contents;
  }

  const fastChanged = nextFast !== fastContents;
  if (fastChanged) writeFileAtomic(paths.fastPath, nextFast);
  try {
    if (nextPlan !== planContents) writeFileAtomic(paths.planPath, nextPlan);
  } catch (err) {
    if (fastChanged) {
      try {
        writeFileAtomic(paths.fastPath, fastContents);
      } catch {
        // Best-effort restore; the mirror error is authoritative.
      }
    }
    throw err;
  }
  return { plan: parsePlan(nextPlan), fastPlan: parsePlan(nextFast), differences: appliedDiffs };
}

/** Compare/synchronize the fast mirror against plan.md (fast→plan only). */
export function syncFastPlan(
  workspaceRoot: string,
  slug: string,
  apply = false,
  phase: FastSyncPhase = 'pre-execution'
): FastSyncResult {
  const paths = resolveFastPaths(workspaceRoot, slug);
  const fastContents = readFastContents(paths);
  const planContents = readPlanFile(paths.planPath);
  const fastPlan = parsePlan(fastContents);
  const plan = parsePlan(planContents);
  const sourceSha256 = computeSourceSha256(planContents);
  const stale = storedSha(fastPlan) !== sourceSha256;
  const differences: FastSyncDifference[] = [
    ...structureDifferences(fastPlan, plan),
    ...statusDifferences(fastPlan, plan, phase),
    ...closePhaseRefs(fastPlan, plan).map((ref) => closePhaseDifference(ref, phase)),
  ];

  if (!apply) return { ok: true, aligned: differences.length === 0, differences, sourceSha256, stale };
  // Plan-end is an equality gate: never write while any difference remains.
  if (phase === 'plan-end' && differences.length > 0) {
    return { ok: false, requiresConfirmation: true, differences };
  }
  if (differences.some((diff) => diff.action === 'structure-mismatch' || diff.action === 'plan-ahead')) {
    return { ok: false, requiresConfirmation: true, differences };
  }
  const next = applyDifferences(paths, fastContents, planContents, differences, phase);
  return {
    ok: true,
    applied: true,
    differences: next.differences,
    plan: next.plan,
    fastPlan: next.fastPlan,
    sourceSha256,
    stale,
  };
}
