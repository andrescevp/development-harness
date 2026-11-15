/**
 * plan-candidate.ts — selection-pass candidate reading for one plan directory.
 *
 * Frontmatter only (the full parse happens for the selected plan, §14 D1):
 * status/active/updated/slug/title with the index row as fallback, plus the
 * cheap `## Phases` structural gate that sets `valid`.
 */
import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { splitFrontmatter } from '../lib/frontmatter.js';
import { readPlanFile } from '../tools/plan-io.js';
import { resolvePlanPath } from '../tools/plan-paths.js';
import { type PlanIssue, planIssue } from './plan-issue.js';
import {
  type CandidateStatus,
  type IndexRow,
  isPlanStatus,
  type PlanCandidate,
  type UpdatedSource,
} from './plan-model.js';
import { messageOf, PLAN_MAX_BYTES } from './plan-read-files.js';

export interface BuiltCandidate {
  candidate: PlanCandidate;
  warnings: PlanIssue[];
}

export function relPlanPath(slug: string): string {
  return `docs/plans/${slug}/plan.md`;
}

/** Cheap structural gate for the selection pass (full parse happens on select). */
function isPhasedPlan(contents: string): boolean {
  const lines = contents.split('\n');
  return (
    lines.some((line) => /^##\s+Phases\s*\r?$/.test(line)) && lines.some((line) => /^###\s+Phase\s+\d+/.test(line))
  );
}

function readMeta(contents: string, file: string): { meta: Record<string, unknown>; issue: PlanIssue | null } {
  const split = splitFrontmatter(contents);
  if (split === null) return { meta: {}, issue: null };
  if ('error' in split) return { meta: {}, issue: planIssue('frontmatter-malformed', 'error', file, split.error) };
  try {
    const data = parseYaml(split.fm);
    if (data === null || data === undefined) return { meta: {}, issue: null };
    if (typeof data !== 'object' || Array.isArray(data)) {
      return { meta: {}, issue: planIssue('frontmatter-malformed', 'error', file, 'frontmatter is not a mapping') };
    }
    return { meta: data as Record<string, unknown>, issue: null };
  } catch (error) {
    return { meta: {}, issue: planIssue('frontmatter-malformed', 'error', file, messageOf(error)) };
  }
}

function readActive(meta: Record<string, unknown>, file: string): { active: boolean | null; issue: PlanIssue | null } {
  const raw = meta.active;
  if (raw === undefined || raw === null) return { active: null, issue: null };
  if (typeof raw === 'boolean') return { active: raw, issue: null };
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (value === 'true') return { active: true, issue: null };
    if (value === 'false') return { active: false, issue: null };
  }
  return { active: null, issue: planIssue('frontmatter-malformed', 'warning', file, 'invalid `active` value') };
}

function readStatus(
  meta: Record<string, unknown>,
  indexRow: IndexRow | undefined,
  file: string
): { status: CandidateStatus; issues: PlanIssue[] } {
  const raw = meta.status;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const value = raw.trim();
    if (isPlanStatus(value)) return { status: value, issues: [] };
    return {
      status: 'Unknown',
      issues: [planIssue('frontmatter-malformed', 'warning', file, `invalid \`status\` value '${value.slice(0, 40)}'`)],
    };
  }
  if (raw !== undefined && raw !== null) {
    return {
      status: 'Unknown',
      issues: [planIssue('frontmatter-malformed', 'warning', file, '`status` must be a string')],
    };
  }
  return { status: indexRow && isPlanStatus(indexRow.status) ? indexRow.status : 'Unknown', issues: [] };
}

function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function readUpdated(
  meta: Record<string, unknown>,
  indexRow: IndexRow | undefined,
  mtimeMs: number
): { updatedAt: string; updatedSource: UpdatedSource } {
  const declared = normalizeDate(meta.updated);
  if (declared) return { updatedAt: declared, updatedSource: 'frontmatter' };
  if (meta.updated === undefined || meta.updated === null) {
    if (indexRow?.updatedAt) return { updatedAt: indexRow.updatedAt, updatedSource: 'index' };
  }
  return { updatedAt: new Date(mtimeMs).toISOString().slice(0, 10), updatedSource: 'mtime' };
}

function titleOf(meta: Record<string, unknown>, contents: string, slug: string): string {
  if (typeof meta.title === 'string' && meta.title.trim().length > 0) return meta.title.trim();
  const heading = contents.match(/^#\s+Plan:\s+(.+?)\s*$/m);
  return heading?.[1]?.trim() || slug;
}

function invalidCandidate(
  slug: string,
  issue: PlanIssue,
  indexRow: IndexRow | undefined,
  mtimeMs: number
): PlanCandidate {
  return {
    slug,
    title: slug,
    path: relPlanPath(slug),
    status: indexRow && isPlanStatus(indexRow.status) ? indexRow.status : 'Unknown',
    active: null,
    updatedAt: indexRow?.updatedAt ?? new Date(mtimeMs).toISOString().slice(0, 10),
    updatedSource: indexRow?.updatedAt ? 'index' : 'mtime',
    valid: false,
    issue,
  };
}

/** Read one candidate directory; `null` means "no plan.md here". */
export function buildCandidate(root: string, slug: string, indexRow: IndexRow | undefined): BuiltCandidate | null {
  const relPath = relPlanPath(slug);
  let absPath: string;
  try {
    absPath = resolvePlanPath(root, slug);
  } catch (error) {
    const issue = planIssue('plan-unreadable', 'error', relPath, messageOf(error));
    return { candidate: invalidCandidate(slug, issue, indexRow, 0), warnings: [] };
  }
  let stat: fs.Stats | undefined;
  try {
    stat = fs.lstatSync(absPath, { throwIfNoEntry: false });
  } catch (error) {
    const issue = planIssue('plan-unreadable', 'error', relPath, messageOf(error));
    return { candidate: invalidCandidate(slug, issue, indexRow, 0), warnings: [] };
  }
  if (!stat?.isFile()) return null;
  if (stat.size > PLAN_MAX_BYTES) {
    const issue = planIssue('file-too-large', 'error', relPath, `\`${relPath}\` is ${stat.size} bytes`);
    return { candidate: invalidCandidate(slug, issue, indexRow, stat.mtimeMs), warnings: [] };
  }

  let contents: string;
  try {
    contents = readPlanFile(absPath);
  } catch (error) {
    const issue = planIssue('plan-unreadable', 'error', relPath, messageOf(error));
    return { candidate: invalidCandidate(slug, issue, indexRow, stat.mtimeMs), warnings: [] };
  }

  const { meta, issue: frontmatterIssue } = readMeta(contents, relPath);
  const active = readActive(meta, relPath);
  const status = readStatus(meta, indexRow, relPath);
  const updated = readUpdated(meta, indexRow, stat.mtimeMs);
  const issue =
    frontmatterIssue ??
    (isPhasedPlan(contents) ? null : planIssue('not-a-phased-plan', 'error', relPath, 'missing `## Phases` section'));
  const warnings: PlanIssue[] = [...status.issues];
  if (active.issue) warnings.push(active.issue);
  const declaredSlug = typeof meta.slug === 'string' ? meta.slug.trim() : '';
  if (declaredSlug.length > 0 && declaredSlug !== slug) {
    warnings.push(
      planIssue('slug-mismatch', 'warning', relPath, `frontmatter slug '${declaredSlug}' differs from '${slug}'`)
    );
  }
  if (active.active === true && status.status === 'Completed') {
    warnings.push(planIssue('completed-plan-active', 'warning', relPath, 'completed plan is still marked active'));
  }

  return {
    candidate: {
      slug,
      title: titleOf(meta, contents, slug),
      path: relPath,
      status: status.status,
      active: active.active,
      updatedAt: updated.updatedAt,
      updatedSource: updated.updatedSource,
      valid: issue === null,
      issue,
    },
    warnings,
  };
}
