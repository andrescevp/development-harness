/**
 * helpers.ts — shared builders for the TUI data-layer tests.
 *
 * Everything is synthetic: temp workspaces under the OS temp root and `/repo`
 * display paths only (no personal paths, no real plans).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PlanCandidate, PlanDetails, PlanScan, SourceFile } from '../plan-model.js';
import type { Activity, PlanState } from '../plan-render-model.js';
import { derivePlanState } from '../plan-state.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);

const NOW = '2026-11-15T09:41:12.100Z';

export function fixture(name: string): string {
  return fs.readFileSync(new URL(name, FIXTURES), 'utf8');
}

/** Write `<root>/docs/plans/<slug>/plan.md` plus optional sidecars. */
export function writePlan(root: string, slug: string, contents: string, extras: Record<string, string> = {}): string {
  const directory = path.join(root, 'docs', 'plans', slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'plan.md'), contents, 'utf8');
  for (const [relative, content] of Object.entries(extras)) {
    const target = path.join(directory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return directory;
}

export function writeIndex(root: string, contents: string): void {
  const directory = path.join(root, 'docs', 'plans');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.md'), contents, 'utf8');
}

export function sourceFile(relPath: string, contents: string, mtimeMs = 0): SourceFile {
  return { path: relPath, contents, mtimeMs, size: contents.length };
}

export function candidate(overrides: Partial<PlanCandidate> = {}): PlanCandidate {
  return {
    slug: 'checkout-flow',
    title: 'Checkout Flow',
    path: 'docs/plans/checkout-flow/plan.md',
    status: 'In Progress',
    active: true,
    updatedAt: '2026-11-14',
    updatedSource: 'frontmatter',
    valid: true,
    issue: null,
    ...overrides,
  };
}

export function scanOf(candidates: PlanCandidate[], overrides: Partial<PlanScan> = {}): PlanScan {
  return {
    plansDir: '/repo/docs/plans',
    hasPlansDir: true,
    candidates,
    index: [],
    indexFile: null,
    scanned: candidates.length,
    truncated: false,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

export function detailsOf(planContents: string, overrides: Partial<PlanDetails> = {}): PlanDetails {
  return {
    slug: 'checkout-flow',
    absPath: '/repo/docs/plans/checkout-flow/plan.md',
    plan: sourceFile('docs/plans/checkout-flow/plan.md', planContents),
    review: null,
    fast: null,
    ledger: null,
    alignment: { preExecution: null, planEnd: null },
    errors: [],
    warnings: [],
    ...overrides,
  };
}

export function activityOf(overrides: Partial<Activity> = {}): Activity {
  return {
    status: 'idle',
    agent: null,
    agentSource: null,
    tool: null,
    summary: 'No active plan',
    source: 'plan-fallback',
    sessionID: 'ses_fixture',
    stale: false,
    updatedAt: NOW,
    ...overrides,
  };
}

/** A derived `PlanState` for view-model tests (workspace `/repo`, active-plan fixture). */
export function stateOf(
  candidates: PlanCandidate[],
  options: { details?: PlanDetails | null; pinnedSlug?: string | null; scan?: Partial<PlanScan> } = {}
): PlanState {
  return derivePlanState({
    root: '/repo',
    scan: scanOf(candidates, options.scan ?? {}),
    details: options.details === undefined ? detailsOf(fixture('active-plan.md')) : options.details,
    pinnedSlug: options.pinnedSlug ?? null,
    sessionID: 'ses_fixture',
    activity: activityOf({ status: 'running', summary: 'Running edit', source: 'session' }),
    now: NOW,
    previousRevision: 1,
  });
}

/** A `no-workspace` snapshot shared by the sidebar/panel view-model tests. */
export function noWorkspaceState(now: string): PlanState {
  return derivePlanState({
    root: null,
    scan: scanOf([]),
    details: null,
    pinnedSlug: null,
    sessionID: null,
    activity: activityOf(),
    now,
    previousRevision: 0,
  });
}

/** `(relative path, mtimeMs, size)` snapshot used by the read-only test. */
export function snapshotTree(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const stat = fs.lstatSync(full);
      entries[path.relative(root, full)] = `${stat.mtimeMs}:${stat.size}`;
    }
  };
  walk(root);
  return entries;
}
