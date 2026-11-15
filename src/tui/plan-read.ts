/**
 * plan-read.ts — read-only filesystem layer: root resolution + plan scan.
 *
 * Contract: progress-contract.md §2, §4, §9.3, §10. Reads the workspace plan
 * tree exactly like the `dh` tools (plan ACL + `readPlanFile`, `O_NOFOLLOW`),
 * performs one frontmatter pass over the candidates, and delegates the selected
 * plan's sidecar pass to `readPlanDetails`. No write API is imported or called.
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertNoSymlinks, planIndexFile, resolvePlanPath } from '../tools/plan-paths.js';
import { buildCandidate } from './plan-candidate.js';
import { type PlanIssue, planIssue } from './plan-issue.js';
import type { IndexRow, PlanScan } from './plan-model.js';
import { messageOf, readFileAt, SIDECAR_MAX_BYTES } from './plan-read-files.js';
import { parsePlanIndex, sortCandidates } from './plan-select.js';

export { readPlanDetails } from './plan-details.js';

export interface PlanRootResult {
  root: string | null;
  issues: PlanIssue[];
}

const SCAN_CAP = 200;

/**
 * Resolve the plan root from the injected TUI location only (§4.1). No upward
 * probing: a session started in a package reports the empty state instead of
 * silently showing a different plan tree. `env` only feeds the override warning.
 */
export function resolvePlanRoot(
  locationDirectory: string | undefined,
  env: { DH_WORKSPACE_ROOT?: string } | undefined
): PlanRootResult {
  const directory = locationDirectory?.trim() ?? '';
  if (directory.length === 0) return { root: null, issues: [] };
  const root = path.resolve(directory);
  const issues: PlanIssue[] = [];
  const override = env?.DH_WORKSPACE_ROOT;
  if (typeof override === 'string' && override.length > 0 && path.isAbsolute(override)) {
    try {
      if (fs.realpathSync(root) !== fs.realpathSync(override)) {
        issues.push(
          planIssue(
            'workspace-root-override',
            'warning',
            null,
            `DH_WORKSPACE_ROOT (${override}) differs from the TUI location (${root}); reading the TUI location`
          )
        );
      }
    } catch {
      // Unresolvable override or root: the check is advisory only (§4.1).
    }
  }
  return { root, issues };
}

function emptyScan(): PlanScan {
  return {
    plansDir: null,
    hasPlansDir: false,
    candidates: [],
    index: [],
    indexFile: null,
    scanned: 0,
    truncated: false,
    errors: [],
    warnings: [],
  };
}

/** Read the candidate list and the `## Plans` index. Read-only, tolerant (§4.2). */
export function readPlanScan(root: string | null): PlanScan {
  if (!root) return emptyScan();

  const plansDir = path.join(root, 'docs', 'plans');
  const scan: PlanScan = { ...emptyScan(), plansDir };
  try {
    assertNoSymlinks(root, plansDir);
    const stat = fs.lstatSync(plansDir, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) {
      scan.warnings.push(
        planIssue('no-plans-dir', 'warning', 'docs/plans', 'no `docs/plans` directory at the workspace root')
      );
      return scan;
    }
    scan.hasPlansDir = true;
  } catch (error) {
    scan.errors.push(planIssue('plans-dir-unreadable', 'error', 'docs/plans', messageOf(error)));
    return scan;
  }

  let indexRows: IndexRow[] = [];
  try {
    const indexFile = readFileAt(planIndexFile(root), 'docs/plans/index.md', {
      maxBytes: SIDECAR_MAX_BYTES,
      severity: 'warning',
      issues: scan.warnings,
    });
    scan.indexFile = indexFile;
    if (indexFile) {
      const parsed = parsePlanIndex(indexFile.contents);
      indexRows = parsed.rows;
      scan.warnings.push(...parsed.issues);
    }
    scan.index = indexRows;
  } catch (error) {
    scan.warnings.push(planIssue('index-malformed', 'warning', 'docs/plans/index.md', messageOf(error)));
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(plansDir, { withFileTypes: true });
  } catch (error) {
    scan.errors.push(planIssue('plans-dir-unreadable', 'error', 'docs/plans', messageOf(error)));
    return scan;
  }

  const dirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  if (dirs.length > SCAN_CAP) {
    scan.truncated = true;
    scan.warnings.push(
      planIssue('scan-truncated', 'warning', 'docs/plans', `scan capped at ${SCAN_CAP} plan directories`)
    );
  }
  const examined = dirs.slice(0, SCAN_CAP);
  scan.scanned = examined.length;

  const mtimes = new Map<string, number>();
  const indexBySlug = new Map(indexRows.map((row) => [row.slug, row]));
  for (const slug of examined) {
    const built = buildCandidate(root, slug, indexBySlug.get(slug));
    if (!built) continue;
    scan.candidates.push(built.candidate);
    for (const warning of built.warnings) scan.warnings.push(warning);
    if (built.candidate.issue) scan.warnings.push({ ...built.candidate.issue, severity: 'warning' });
    try {
      mtimes.set(slug, fs.lstatSync(resolvePlanPath(root, slug)).mtimeMs);
    } catch {
      mtimes.set(slug, 0);
    }
  }

  const known = new Set(scan.candidates.map((candidate) => candidate.slug));
  for (const row of indexRows) {
    if (!known.has(row.slug)) {
      scan.errors.push(
        planIssue('index-orphan', 'error', 'docs/plans/index.md', `index row '${row.slug}' has no plan.md`)
      );
    }
  }

  scan.candidates = sortCandidates(scan.candidates).sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    const delta = (mtimes.get(b.slug) ?? 0) - (mtimes.get(a.slug) ?? 0);
    return delta !== 0 ? delta : a.slug < b.slug ? -1 : 1;
  });
  return scan;
}
