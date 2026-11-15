/**
 * plan-select.ts — pure active-plan selection and `docs/plans/index.md` parsing.
 *
 * Contract: progress-contract.md §4.3–§4.5, §14 D2/D3/D6. Selection is
 * deterministic and side-effect free: pin > single active > multiple >
 * index fallback > none. The index only contributes `active` (and status /
 * updated fallbacks computed by the read layer) — never structure or counts.
 */

import { type PlanIssue, planIssue, splitTableRow, stripCr } from './plan-issue.js';
import {
  type CandidateStatus,
  type IndexRow,
  isPlanStatus,
  type PlanCandidate,
  type PlanSelection,
  type SelectionMode,
  type SelectionSource,
} from './plan-model.js';

const PLANS_HEADING = /^##\s+Plans\s*$/;
const ANY_H2 = /^##\s+/;
const TABLE_ROW = /^\|/;
const TABLE_SEPARATOR = /^\|[\s:|-]+\|?$/;

function normalizeActive(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (value === 'yes' || value === 'true') return true;
  if (value === 'no' || value === 'false') return false;
  return null;
}

function normalizeDate(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

/** Parse the `## Plans` table; columns are mapped by header name (§4.5). */
export function parsePlanIndex(
  contents: string,
  file = 'docs/plans/index.md'
): { rows: IndexRow[]; issues: PlanIssue[] } {
  const lines = contents.split('\n');
  const headingAt = lines.findIndex((line) => PLANS_HEADING.test(stripCr(line)));
  if (headingAt === -1) return { rows: [], issues: [] };

  let cursor = headingAt + 1;
  while (cursor < lines.length && !TABLE_ROW.test(stripCr(lines[cursor]!))) {
    if (ANY_H2.test(stripCr(lines[cursor]!))) return { rows: [], issues: [] };
    cursor += 1;
  }
  if (cursor >= lines.length) return { rows: [], issues: [] };

  const header = splitTableRow(lines[cursor]!);
  const columns = new Map(header.map((name, index) => [name.toLowerCase(), index]));
  const slugColumn = columns.get('slug');
  const issues: PlanIssue[] = [];
  if (slugColumn === undefined) {
    issues.push(planIssue('index-malformed', 'warning', file, '## Plans table has no Slug column'));
    return { rows: [], issues };
  }
  const activeColumn = columns.get('active');
  if (activeColumn === undefined) {
    issues.push(planIssue('index-malformed', 'warning', file, '## Plans table has no Active column'));
    return { rows: [], issues };
  }

  cursor += 1;
  if (cursor < lines.length && TABLE_SEPARATOR.test(stripCr(lines[cursor]!).trim())) cursor += 1;

  const rows: IndexRow[] = [];
  for (; cursor < lines.length; cursor += 1) {
    const line = stripCr(lines[cursor]!);
    if (!TABLE_ROW.test(line)) break;
    const cells = splitTableRow(line);
    const slug = (cells[slugColumn] ?? '').trim();
    if (slug.length === 0) continue;
    const active = normalizeActive(cells[activeColumn] ?? '');
    if (active === null) {
      issues.push(planIssue('index-malformed', 'warning', file, `row '${slug}' has an invalid Active value`));
      continue;
    }
    const statusRaw = (cells[columns.get('status') ?? -1] ?? '').trim();
    const status: CandidateStatus = isPlanStatus(statusRaw) ? statusRaw : 'Unknown';
    rows.push({
      slug,
      title: (cells[columns.get('title') ?? -1] ?? '').trim(),
      status,
      active,
      updatedAt: normalizeDate(cells[columns.get('updated') ?? -1]),
      line: cursor + 1,
    });
  }
  return { rows, issues };
}

/** Stable, contract-ordered sort: updatedAt desc, then slug asc. */
export function sortCandidates(candidates: readonly PlanCandidate[]): PlanCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
}

function selection(
  mode: SelectionMode,
  source: SelectionSource,
  selectedSlug: string | null,
  suggestedSlug: string | null,
  pinnedSlug: string | null,
  candidates: PlanCandidate[],
  scan: { scanned: number; truncated: boolean }
): PlanSelection {
  return {
    mode,
    source,
    selectedSlug,
    suggestedSlug,
    pinnedSlug,
    candidates: sortCandidates(candidates),
    scanned: scan.scanned,
    truncated: scan.truncated,
  };
}

/**
 * Resolve the active plan (§4.4). `candidates` is the full scan; the returned
 * `selection.candidates` is the qualifying active set the selector renders.
 */
export function selectPlan(
  candidates: readonly PlanCandidate[],
  index: readonly IndexRow[],
  pinnedSlug: string | null,
  scan: { scanned: number; truncated: boolean } = { scanned: candidates.length, truncated: false }
): PlanSelection {
  const sorted = sortCandidates(candidates);
  const declared = sorted.filter((candidate) => candidate.active === true && candidate.status !== 'Completed');
  const usable = declared.filter((candidate) => candidate.valid);

  if (pinnedSlug !== null) {
    const pinned = sorted.find((candidate) => candidate.slug === pinnedSlug);
    if (pinned && pinned.status !== 'Completed') {
      const list = declared.some((candidate) => candidate.slug === pinned.slug) ? declared : [pinned, ...declared];
      return selection('pinned', 'pin', pinned.slug, null, pinnedSlug, list, scan);
    }
  }

  if (usable.length === 1) {
    return selection('single-active', 'frontmatter', usable[0]!.slug, null, null, declared, scan);
  }
  if (usable.length > 1) {
    return selection('multiple', 'frontmatter', null, usable[0]!.slug, null, declared, scan);
  }

  const indexActive = index.filter((row) => row.active);
  const resolved = indexActive
    .map((row) => sorted.find((candidate) => candidate.slug === row.slug))
    .filter((candidate): candidate is PlanCandidate => candidate !== undefined)
    .filter((candidate) => candidate.valid && candidate.status !== 'Completed');
  const unique = [...new Map(resolved.map((candidate) => [candidate.slug, candidate])).values()];

  if (unique.length === 1) {
    return selection('index', 'index', unique[0]!.slug, null, null, unique, scan);
  }
  if (unique.length > 1) {
    const ordered = sortCandidates(unique);
    return selection('multiple', 'index', null, ordered[0]!.slug, null, ordered, scan);
  }
  return selection('none', 'none', null, null, null, declared, scan);
}
