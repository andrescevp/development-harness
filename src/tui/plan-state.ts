/**
 * plan-state.ts — public, pure entry of the TUI plan progress data layer.
 *
 * Contract: progress-contract.md §3, §4.4, §5, §11, §13. `derivePlanState`
 * receives the read-layer scan/details and an injected clock; it performs no
 * filesystem, process or renderer access, and every thrown parser error is
 * converted into a `PlanIssue` so a slot renderer never sees an exception.
 */
import { type PlanIssue, type PlanIssueCode, planIssue } from './plan-issue.js';
import type { PlanDetails, PlanProgress, PlanScan, PlanSelection, SubTaskProgress } from './plan-model.js';
import { derivePlanProgress } from './plan-progress.js';
import type { Activity, PlanState, PlanStateReason, PlanStateStatus } from './plan-render-model.js';
import { selectPlan } from './plan-select.js';

/** @public — contract §13 public entry re-exports. */
export { derivePlanProgress } from './plan-progress.js';
/** @public — loading snapshot factory (contract §11 S1). */
export { loadingPlanState } from './plan-render-model.js';
/** @public */
export { parsePlanIndex, selectPlan } from './plan-select.js';
/** @public — watcher factory, exported beside the pure entry for the TUI wiring. */
export { createPlanWatcher, fingerprintPlanTree } from './plan-watch.js';

function stripRoot(message: string, root: string): string {
  let value = message;
  for (const prefix of [`${root}/`, `${root}\\`, root]) {
    value = value.split(prefix).join('');
  }
  return value;
}

/** Map a thrown parser/derivation error to a scoped issue (§3.3, §5.1). */
export function issueFromError(error: unknown, file: string, root: string | null): PlanIssue {
  const raw = error instanceof Error ? error.message : String(error);
  const message = root ? stripRoot(raw, root) : raw;
  let code: PlanIssueCode = 'plan-unreadable';
  if (message.includes('not a phased plan')) code = 'not-a-phased-plan';
  else if (message.includes('invalid status')) code = 'invalid-status';
  else if (message.includes('orphan sub-task')) code = 'orphan-subtask';
  else if (message.includes('empty Delegated to agent')) code = 'empty-delegated-agent';
  else if (message.startsWith('plan frontmatter')) code = 'frontmatter-malformed';
  return planIssue(code, 'error', file, message);
}

export interface DerivePlanStateInput {
  root: string | null;
  scan: PlanScan;
  details: PlanDetails | null;
  pinnedSlug: string | null;
  sessionID: string | null;
  activity: Activity;
  now: string;
  previousRevision: number;
  /** Warnings produced while resolving the root (override mismatch). */
  rootIssues?: PlanIssue[];
  /** Observability stamp supplied by the watcher (§3.1 `refresh`). */
  refresh?: PlanState['refresh'];
}

/** Derive one immutable store snapshot from a scan/details pair. */
export function derivePlanState(input: DerivePlanStateInput): PlanState {
  const { root, scan, details, pinnedSlug, sessionID, activity, now, previousRevision } = input;
  const selection: PlanSelection = selectPlan(scan.candidates, scan.index, pinnedSlug, {
    scanned: scan.scanned,
    truncated: scan.truncated,
  });
  const base: PlanState = {
    status: 'empty',
    reason: 'empty',
    workspaceRoot: root,
    plansDir: scan.plansDir,
    selection,
    plan: null,
    activity,
    sessionID,
    errors: [...scan.errors],
    warnings: [...(input.rootIssues ?? []), ...scan.warnings],
    revision: previousRevision + 1,
    refreshedAt: now,
    refresh: input.refresh ?? { mode: 'none', pending: false, durationMs: 0 },
  };
  if (pinnedSlug !== null && selection.pinnedSlug === null) {
    base.warnings.push(planIssue('pin-stale', 'warning', null, `pinned plan '${pinnedSlug}' is no longer selectable`));
  }

  const fail = (status: PlanStateStatus, reason: PlanStateReason, issues: PlanIssue[]): PlanState => ({
    ...base,
    status,
    reason,
    plan: null,
    errors: [...base.errors, ...issues],
  });

  if (root === null) {
    const warnings = [
      ...base.warnings,
      planIssue('no-workspace', 'warning', null, 'no local workspace directory; plan progress is unavailable'),
    ];
    return { ...fail('empty', 'no-workspace', []), warnings };
  }
  if (scan.errors.some((error) => error.code === 'plans-dir-unreadable')) {
    return fail('error', 'scan-error', []);
  }
  if (!scan.hasPlansDir) return fail('empty', 'no-plans-dir', []);
  if (selection.mode === 'none') return { ...base, status: 'empty', reason: 'empty' };
  if (selection.mode === 'multiple') return { ...base, status: 'selector', reason: 'multiple' };

  const selected = scan.candidates.find((candidate) => candidate.slug === selection.selectedSlug) ?? null;
  if (!selected) {
    return fail('error', 'plan-error', [planIssue('plan-missing', 'error', null, 'selected plan is gone')]);
  }
  if (!selected.valid) {
    const issue = selected.issue ?? planIssue('plan-missing', 'error', selected.path, 'selected plan is invalid');
    return fail('error', 'plan-error', [issue]);
  }
  if (!details || details.slug !== selected.slug || details.plan === null) {
    const issues = details && details.errors.length > 0 ? details.errors : [];
    return fail('error', 'plan-error', [
      ...issues,
      planIssue('plan-missing', 'error', selected.path, 'plan details could not be read'),
    ]);
  }

  try {
    const plan = derivePlanProgress({ candidate: selected, planContents: details.plan.contents, details, now });
    const reason: PlanStateReason =
      selection.mode === 'pinned' ? 'pinned' : selection.source === 'index' ? 'index' : 'ready';
    return { ...base, status: 'ready', reason, plan };
  } catch (error) {
    return fail('error', 'plan-error', [issueFromError(error, selected.path, root)]);
  }
}

/** The `SubTaskProgress` the position points at, if any (consumer helper). */
export function currentSubTask(plan: PlanProgress): SubTaskProgress | null {
  const reference = plan.current.subTask?.index;
  if (!reference) return null;
  for (const phase of plan.phases) {
    const found = phase.subTasks.find((subTask) => subTask.index === reference);
    if (found) return found;
  }
  return null;
}

/** Display precedence (§7.4): review verdict, then plan-end alignment verdict. */
export function effectiveVerdict(plan: PlanProgress): PlanProgress['review']['verdict'] {
  return plan.review.verdict ?? plan.fast.alignment.planEnd.verdict ?? null;
}
