/**
 * plan-fast.ts — filesystem operations for the fast-plan tool family.
 *
 * The fast plan is a derived mirror of plan.md: create/read/update keep both
 * files aligned, while the skip-check ledger records deferred checks. Sync
 * comparison lives in plan-fast-sync.ts; pure rendering/hash helpers live in
 * plan-fast-template.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic, writeFileExclusiveAtomic } from '../lib/atomic-write.js';
import {
  appendSkipRows,
  computeSourceSha256,
  countLedgerRows,
  escapeCell,
  isoTimestamp,
  renderFastPlan,
  renderSkipLedger,
} from './plan-fast-template.js';
import { readPlanFile } from './plan-io.js';
import type { PhaseStatus, PlanDocument, StatusTarget } from './plan-lifecycle.js';
import { parsePlan, setStatus } from './plan-lifecycle.js';
import { resolvePlanPath } from './plan-paths.js';

export interface FastPaths {
  planPath: string;
  fastPath: string;
  skipChecksPath: string;
}

export interface FastCreateResult {
  ok: true;
  path: string;
  plan: PlanDocument;
  sourceSha256: string;
  skipChecksPath: string;
}

export interface FastReadResult {
  ok: true;
  path: string;
  plan: PlanDocument;
  sourcePlanPath: string;
  sourceSha256: string;
  stale: boolean;
  skipChecksPath: string;
}

export interface FastUpdateResult {
  ok: true;
  path: string;
  plan: PlanDocument;
  mirroredPath: string;
  mirroredPlan: PlanDocument;
}

export interface FastSkipResult {
  ok: true;
  path: string;
  appended: number;
  rows: number;
}

/** Resolve the three fast-plan paths with the shared docs/plans ACL. */
export function resolveFastPaths(workspaceRoot: string, slug: string): FastPaths {
  const planPath = resolvePlanPath(workspaceRoot, slug);
  return {
    planPath,
    fastPath: resolvePlanPath(workspaceRoot, undefined, `${slug}/plan_fast.md`),
    skipChecksPath: resolvePlanPath(workspaceRoot, undefined, `${slug}/plan_fast_skip_checks.md`),
  };
}

function fastNotFound(fastPath: string): Error {
  return new Error(`plan_fast not found: ${fastPath} (run plan_fast_create)`);
}

/** Read the fast mirror; throws the shared not-found error when missing. */
export function readFastContents(paths: FastPaths): string {
  if (!fs.existsSync(paths.fastPath)) throw fastNotFound(paths.fastPath);
  return readPlanFile(paths.fastPath);
}

function allPending(plan: PlanDocument): boolean {
  return plan.phases.every(
    (phase) => phase.status === 'Pending' && phase.subTasks.every((sub) => sub.status === 'Pending')
  );
}

export function storedSha(plan: PlanDocument): string {
  return typeof plan.meta.source_sha256 === 'string' ? plan.meta.source_sha256 : '';
}

/** Create (or replace) plan_fast.md; seed the six-row ledger only when missing. */
export function createFastPlan(workspaceRoot: string, slug: string, replace = false): FastCreateResult {
  const paths = resolveFastPaths(workspaceRoot, slug);
  const sourceContents = readPlanFile(paths.planPath);
  const sourcePlan = parsePlan(sourceContents);
  const exists = fs.existsSync(paths.fastPath);
  if (exists) {
    if (!replace) throw new Error(`plan_fast already exists: ${paths.fastPath}`);
    if (!allPending(parsePlan(readFastContents(paths)))) {
      throw new Error('cannot replace a plan_fast with execution progress');
    }
  }

  const timestamp = isoTimestamp();
  const rendered = renderFastPlan({ slug, sourceContents, sourcePlan, timestamp });
  const plan = parsePlan(rendered.contents);
  fs.mkdirSync(path.dirname(paths.fastPath), { recursive: true });
  if (exists) {
    writeFileAtomic(paths.fastPath, rendered.contents);
  } else {
    try {
      writeFileExclusiveAtomic(paths.fastPath, rendered.contents);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST')
        throw new Error(`plan_fast already exists: ${paths.fastPath}`);
      throw err;
    }
  }

  // Seed only when missing: replace must never truncate append-only ledger rows.
  if (!fs.existsSync(paths.skipChecksPath)) {
    const ledger = renderSkipLedger({ slug, title: rendered.title, project: rendered.project, timestamp });
    try {
      writeFileExclusiveAtomic(paths.skipChecksPath, ledger);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }

  return {
    ok: true,
    path: paths.fastPath,
    plan,
    sourceSha256: rendered.sourceSha256,
    skipChecksPath: paths.skipChecksPath,
  };
}

/** Read/parse the fast mirror plus the recomputed source hash and staleness. */
export function readFastPlan(workspaceRoot: string, slug: string): FastReadResult {
  const paths = resolveFastPaths(workspaceRoot, slug);
  const plan = parsePlan(readFastContents(paths));
  const sourceContents = readPlanFile(paths.planPath);
  const sourceSha256 = computeSourceSha256(sourceContents);
  return {
    ok: true,
    path: paths.fastPath,
    plan,
    sourcePlanPath: paths.planPath,
    sourceSha256,
    stale: storedSha(plan) !== sourceSha256,
    skipChecksPath: paths.skipChecksPath,
  };
}

/** Update a phase/sub-task status in BOTH plans, restoring fast on mirror failure. */
export function updateFastStatus(
  workspaceRoot: string,
  slug: string,
  target: StatusTarget,
  index: string,
  status: PhaseStatus
): FastUpdateResult {
  const paths = resolveFastPaths(workspaceRoot, slug);
  const fastContents = readFastContents(paths);
  const planContents = readPlanFile(paths.planPath);
  // Validate both before any write (phase completion gate included).
  const fastNext = setStatus(fastContents, target, index, status);
  const planNext = setStatus(planContents, target, index, status);
  const fastChanged = fastNext.contents !== fastContents;
  if (fastChanged) writeFileAtomic(paths.fastPath, fastNext.contents);
  try {
    if (planNext.contents !== planContents) writeFileAtomic(paths.planPath, planNext.contents);
  } catch (err) {
    if (fastChanged) {
      try {
        writeFileAtomic(paths.fastPath, fastContents);
      } catch {
        // Best-effort restore; the original mirror error is the actionable one.
      }
    }
    throw err;
  }
  return {
    ok: true,
    path: paths.fastPath,
    plan: fastNext.plan,
    mirroredPath: paths.planPath,
    mirroredPlan: planNext.plan,
  };
}

/** Append skipped-check rows (seeding the six standard rows when the ledger is missing). */
export function appendSkipChecks(
  workspaceRoot: string,
  slug: string,
  checks: string[],
  scope: string,
  reason: string,
  disposition: string
): FastSkipResult {
  const paths = resolveFastPaths(workspaceRoot, slug);
  const fastPlan = parsePlan(readFastContents(paths));
  const timestamp = isoTimestamp();
  let contents: string;
  if (fs.existsSync(paths.skipChecksPath)) {
    contents = readPlanFile(paths.skipChecksPath);
  } else {
    const fastTitle = typeof fastPlan.meta.title === 'string' ? fastPlan.meta.title : slug;
    const project = typeof fastPlan.meta.project === 'string' ? fastPlan.meta.project : slug;
    contents = renderSkipLedger({
      slug,
      title: fastTitle.replace(/ — Fast Execution$/, ''),
      project,
      timestamp,
    });
    fs.mkdirSync(path.dirname(paths.skipChecksPath), { recursive: true });
    try {
      writeFileExclusiveAtomic(paths.skipChecksPath, contents);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      contents = readPlanFile(paths.skipChecksPath);
    }
  }
  const rows = checks.map(
    (check) =>
      `| ${escapeCell(timestamp)} | ${escapeCell(check)} | ${escapeCell(scope)} | ${escapeCell(reason)} | ${escapeCell(disposition)} |`
  );
  const next = appendSkipRows(contents, rows, timestamp.slice(0, 10));
  writeFileAtomic(paths.skipChecksPath, next);
  return { ok: true, path: paths.skipChecksPath, appended: checks.length, rows: countLedgerRows(next) };
}
