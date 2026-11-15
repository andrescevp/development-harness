/**
 * plan-details.ts — sidecar reads for the selected plan (§7, §9.3).
 *
 * One pass per refresh, only for the selected slug. Missing files are normal
 * (`null`), oversized/unreadable sidecars become warnings, and nothing writes.
 */
import { resolvePlanPath } from '../tools/plan-paths.js';
import { relPlanPath } from './plan-candidate.js';
import { type PlanIssue, planIssue } from './plan-issue.js';
import type { PlanDetails, SourceFile } from './plan-model.js';
import { messageOf, PLAN_MAX_BYTES, readFileAt, SIDECAR_MAX_BYTES } from './plan-read-files.js';

function optionalFile(root: string, relPath: string, issues: PlanIssue[]): SourceFile | null {
  let absPath: string;
  try {
    absPath = resolvePlanPath(root, undefined, relPath);
  } catch (error) {
    issues.push(planIssue('plan-unreadable', 'warning', `docs/plans/${relPath}`, messageOf(error)));
    return null;
  }
  return readFileAt(absPath, `docs/plans/${relPath}`, {
    maxBytes: SIDECAR_MAX_BYTES,
    severity: 'warning',
    issues,
  });
}

/** Read the selected plan plus its read-only sidecars (§7). */
export function readPlanDetails(root: string, slug: string): PlanDetails {
  const details: PlanDetails = {
    slug,
    absPath: '',
    plan: null,
    review: null,
    fast: null,
    ledger: null,
    alignment: { preExecution: null, planEnd: null },
    errors: [],
    warnings: [],
  };
  try {
    details.absPath = resolvePlanPath(root, slug);
  } catch (error) {
    details.errors.push(planIssue('plan-unreadable', 'error', relPlanPath(slug), messageOf(error)));
    return details;
  }
  details.plan = readFileAt(details.absPath, relPlanPath(slug), {
    maxBytes: PLAN_MAX_BYTES,
    severity: 'error',
    issues: details.errors,
  });
  if (!details.plan) {
    details.errors.push(planIssue('plan-missing', 'error', relPlanPath(slug), 'plan.md is missing'));
  }
  details.review = optionalFile(root, `${slug}/tasks/review.md`, details.warnings);
  details.fast = optionalFile(root, `${slug}/plan_fast.md`, details.warnings);
  details.ledger = optionalFile(root, `${slug}/plan_fast_skip_checks.md`, details.warnings);
  details.alignment.preExecution = optionalFile(root, `${slug}/tasks/review-fast.md`, details.warnings);
  details.alignment.planEnd = optionalFile(root, `${slug}/tasks/review-fast-final.md`, details.warnings);
  return details;
}
