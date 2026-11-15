/**
 * plan-review.ts — pure derivation of the review verdict, the fast-mirror
 * state and the skipped-check ledger (§7, §3.4 `fast`/`review`).
 *
 * Sidecars are optional: a missing file is `present: false`, never an error.
 * Only read-only analysis lives here; nothing writes to `docs/plans`.
 */
import { splitFrontmatter } from '../lib/frontmatter.js';
import { computeSourceSha256 } from '../tools/plan-fast-template.js';
import { type PlanDocument, parsePlan } from '../tools/plan-lifecycle.js';
import { clampText, ensureValue, type PlanIssue, planIssue, splitTableRow, stripCr } from './plan-issue.js';
import type { PlanDetails, PlanStatus, SourceFile } from './plan-model.js';
import {
  type AlignmentEntry,
  emptyAlignment,
  emptyFast,
  emptyLedger,
  emptyReview,
  type FastState,
  type LedgerPerCheck,
  type LedgerRow,
  type LedgerState,
  type ReviewRisk,
  type ReviewScope,
  type ReviewState,
  type ReviewVerdict,
} from './plan-sidecars.js';

const VERDICT_LINE = /^\s*(?:[-*]\s+)?(?:\*\*|__)?Verdict(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.+?)\s*$/i;
const REVIEWED_LINE = /^\s*(?:[-*]\s+)?(?:\*\*|__)?Reviewed against(?:\*\*|__)?\s*:\s*(.+)$/i;
const RISK_LINE = /^\s*(?:[-*]\s+)?(?:\*\*|__)?Overall risk(?:\*\*|__)?\s*:\s*(.+)$/i;
const H1 = /^#\s+(.+?)\s*$/;
const SIGN_OFF = /^##\s+Sign-off Verdict\s*$/i;
const MAX_VERDICT = 120;
const MAX_LEDGER_ROWS = 20;

function stripEmphasis(value: string): string {
  return value.replace(/\*\*|__/g, '').trim();
}

/** Normalize a tolerant verdict match; anything else yields `null` (§7.1). */
export function normalizeVerdict(raw: string): ReviewVerdict | null {
  const value = stripEmphasis(raw).replace(/\.+$/, '').trim().toLowerCase();
  if (value.startsWith('approve with comments')) return 'Approve with comments';
  if (value.startsWith('request changes')) return 'Request changes';
  if (value.startsWith('approve')) return 'Approve';
  return null;
}

function normalizeRisk(raw: string): ReviewRisk | null {
  const value = stripEmphasis(raw).toLowerCase();
  if (value.startsWith('high')) return 'High';
  if (value.startsWith('medium')) return 'Medium';
  if (value.startsWith('low')) return 'Low';
  return null;
}

/** Frontmatter date for `key`, falling back to the file mtime (ISO-8601). */
function fileDate(file: SourceFile, key: string): string {
  const split = splitFrontmatter(file.contents);
  if (split && !('error' in split)) {
    const match = split.fm.match(new RegExp(`^${key}:\\s*(\\S+)`, 'm'));
    if (match) {
      const parsed = new Date(match[1]!);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return new Date(file.mtimeMs).toISOString();
}

function frontmatterValue(file: SourceFile, key: string): string | null {
  const split = splitFrontmatter(file.contents);
  if (!split || 'error' in split) return null;
  const match = split.fm.match(new RegExp(`^${key}:\\s*(\\S+)`, 'm'));
  return match ? match[1]!.trim() : null;
}

function readVerdicts(lines: readonly string[]): string[] {
  const verdicts: string[] = [];
  for (const line of lines) {
    const match = stripCr(line).match(VERDICT_LINE);
    if (match) verdicts.push(match[1]!.trim());
  }
  return verdicts;
}

function reviewScope(lines: readonly string[], verdicts: readonly string[]): ReviewScope {
  const firstHeading =
    lines
      .map((line) => stripCr(line).match(H1))
      .find((match) => match !== null)?.[1]
      ?.trim() ?? '';
  const hasSignOff = lines.some((line) => SIGN_OFF.test(stripCr(line)));
  if (hasSignOff || firstHeading.includes('Final Plan Review')) return 'final';
  if (firstHeading.includes('Sub-Task Review')) return 'subtask';
  if (verdicts.length > 1) return 'mixed';
  return 'unknown';
}

/** Parse `tasks/review.md`: last tolerant verdict wins, tolerant scope/risk. */
export function parseReview(file: SourceFile | null): ReviewState {
  if (!file) return emptyReview();
  const lines = file.contents.split('\n');
  const verdicts = readVerdicts(lines);
  const lastRaw = verdicts.at(-1) ?? null;
  const verdict = lastRaw === null ? null : normalizeVerdict(lastRaw);
  const state: ReviewState = {
    present: true,
    path: file.path,
    verdict,
    verdictRaw: lastRaw === null ? null : clampText(stripEmphasis(lastRaw), MAX_VERDICT),
    scope: reviewScope(lines, verdicts),
    reviewedAgainst: null,
    risk: null,
    updatedAt: fileDate(file, 'updated'),
    issues: [],
  };
  for (const line of lines) {
    const clean = stripCr(line);
    if (state.reviewedAgainst === null) {
      const match = clean.match(REVIEWED_LINE);
      if (match) state.reviewedAgainst = clampText(stripEmphasis(match[1]!), MAX_VERDICT);
    }
    if (state.risk === null) {
      const match = clean.match(RISK_LINE);
      if (match) state.risk = normalizeRisk(match[1]!);
    }
  }
  if (lastRaw !== null && verdict === null) {
    state.issues.push(
      planIssue('review-malformed', 'warning', file.path, 'unrecognized review verdict; see verdict raw text')
    );
  }
  return state;
}

/** Parse a fast-alignment review file (`tasks/review-fast*.md`). */
export function parseAlignment(file: SourceFile | null): AlignmentEntry {
  if (!file) return emptyAlignment();
  const state = parseReview(file);
  return { present: true, path: file.path, verdict: state.verdict, date: fileDate(file, 'created') };
}

function emptyPerCheck(): LedgerPerCheck {
  return { deferred: 0, conditional: 0, runPass: 0, runFail: 0, notApplicable: 0 };
}

function countDisposition(target: LedgerPerCheck, disposition: string): void {
  const value = disposition.trim().toLowerCase();
  if (value.startsWith('deferred to end-of-plan')) target.deferred += 1;
  else if (value.startsWith('conditional at plan end')) target.conditional += 1;
  else if (/^run:\s*pass/.test(value)) target.runPass += 1;
  else if (/^run:\s*fail/.test(value)) target.runFail += 1;
  else if (value.startsWith('not applicable')) target.notApplicable += 1;
}

/** Parse the append-only skipped-check ledger (§7.3). */
export function parseLedger(file: SourceFile | null): LedgerState {
  if (!file) return emptyLedger();
  const state = emptyLedger();
  state.path = file.path;
  const lines = file.contents.split('\n').map(stripCr);
  const headerAt = lines.findIndex((line) => /^\|.*\bTimestamp\b.*\|/.test(line));
  if (headerAt === -1) {
    state.issues.push(planIssue('ledger-malformed', 'warning', file.path, 'no skipped-check table found'));
    return state;
  }
  const columns = new Map(splitTableRow(lines[headerAt]!).map((name, index) => [name.toLowerCase(), index]));
  const required = ['timestamp', 'check', 'scope', 'reason', 'disposition'];
  if (required.some((name) => !columns.has(name))) {
    state.issues.push(planIssue('ledger-malformed', 'warning', file.path, 'skipped-check table is malformed'));
    return state;
  }

  let cursor = headerAt + 1;
  if (cursor < lines.length && /^\|[\s:|-]+\|?$/.test(lines[cursor]!.trim())) cursor += 1;
  const rows: LedgerRow[] = [];
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]!;
    if (!/^\|/.test(line.trim())) break;
    const cells = splitTableRow(line);
    const check = (cells[columns.get('check')!] ?? '').trim();
    if (check.length === 0) continue;
    rows.push({
      timestamp: (cells[columns.get('timestamp')!] ?? '').trim(),
      check,
      scope: (cells[columns.get('scope')!] ?? '').trim(),
      reason: (cells[columns.get('reason')!] ?? '').trim(),
      disposition: (cells[columns.get('disposition')!] ?? '').trim(),
    });
  }

  state.present = true;
  state.rows = rows.length;
  for (const row of rows) {
    const counts = ensureValue(state.perCheck, row.check, emptyPerCheck);
    countDisposition(counts, row.disposition);
  }
  state.unresolved = Object.entries(state.perCheck)
    .filter(([, counts]) => counts.deferred + counts.conditional > 0)
    .filter(([, counts]) => counts.runPass + counts.runFail + counts.notApplicable === 0)
    .map(([check]) => check)
    .sort();
  state.rowsShown = rows.slice(-MAX_LEDGER_ROWS);
  state.truncated = rows.length > MAX_LEDGER_ROWS;
  return state;
}

function statusPairs(plan: PlanDocument): Map<string, PlanStatus> {
  const pairs = new Map<string, PlanStatus>();
  for (const phase of plan.phases) {
    pairs.set(String(phase.index), phase.status);
    for (const subTask of phase.subTasks) pairs.set(subTask.index, subTask.status);
  }
  return pairs;
}

function alignedWith(source: PlanDocument, mirror: PlanDocument): boolean {
  const left = statusPairs(source);
  const right = statusPairs(mirror);
  if (left.size !== right.size) return false;
  for (const [ref, status] of left) {
    if (right.get(ref) !== status) return false;
  }
  return true;
}

export interface FastDerivation {
  fast: FastState;
  warnings: PlanIssue[];
}

/** Derive the fast mirror state, ledger and alignment verdicts (§7.2–7.4). */
export function deriveFastState(input: {
  planContents: string;
  source: PlanDocument;
  details: PlanDetails;
}): FastDerivation {
  const fast = emptyFast();
  const warnings: PlanIssue[] = [];
  fast.ledger = parseLedger(input.details.ledger);

  if (input.details.fast) {
    fast.present = true;
    fast.path = input.details.fast.path;
    fast.updatedAt = fileDate(input.details.fast, 'updated');
    const stored = frontmatterValue(input.details.fast, 'source_sha256');
    if (stored === null) {
      fast.stale = null;
      warnings.push(
        planIssue('frontmatter-malformed', 'warning', input.details.fast.path, 'fast mirror has no source_sha256')
      );
    } else {
      fast.stale = stored !== computeSourceSha256(input.planContents);
    }
    try {
      const mirror = parsePlan(input.details.fast.contents, input.details.fast.path);
      fast.statusesAligned = alignedWith(input.source, mirror);
      if (!fast.statusesAligned) {
        warnings.push(
          planIssue('mirror-status-mismatch', 'warning', input.details.fast.path, 'plan_fast.md statuses differ')
        );
      }
    } catch (error) {
      fast.statusesAligned = null;
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(planIssue('not-a-phased-plan', 'warning', input.details.fast.path, message));
    }
  }

  fast.alignment = {
    preExecution: parseAlignment(input.details.alignment.preExecution),
    planEnd: parseAlignment(input.details.alignment.planEnd),
  };
  warnings.push(...fast.ledger.issues);
  return { fast, warnings };
}
