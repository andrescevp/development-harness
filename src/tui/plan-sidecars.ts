/**
 * plan-sidecars.ts — read-only sidecar model: review, ledger, fast mirror
 * (progress-contract §3.4 `review`/`fast`, §7). Types plus empty factories.
 */
import type { PlanIssue } from './plan-issue.js';

export type ReviewVerdict = 'Approve' | 'Approve with comments' | 'Request changes';
export type ReviewScope = 'final' | 'subtask' | 'mixed' | 'unknown';
export type ReviewRisk = 'High' | 'Medium' | 'Low';

export interface ReviewState {
  present: boolean;
  path: string | null;
  verdict: ReviewVerdict | null;
  verdictRaw: string | null;
  scope: ReviewScope;
  reviewedAgainst: string | null;
  risk: ReviewRisk | null;
  updatedAt: string | null;
  issues: PlanIssue[];
}

export function emptyReview(): ReviewState {
  return {
    present: false,
    path: null,
    verdict: null,
    verdictRaw: null,
    scope: 'unknown',
    reviewedAgainst: null,
    risk: null,
    updatedAt: null,
    issues: [],
  };
}

export interface LedgerPerCheck {
  deferred: number;
  conditional: number;
  runPass: number;
  runFail: number;
  notApplicable: number;
}

export interface LedgerRow {
  timestamp: string;
  check: string;
  scope: string;
  reason: string;
  disposition: string;
}

export interface LedgerState {
  present: boolean;
  path: string | null;
  rows: number;
  perCheck: Record<string, LedgerPerCheck>;
  unresolved: string[];
  rowsShown: LedgerRow[];
  truncated: boolean;
  issues: PlanIssue[];
}

export function emptyLedger(): LedgerState {
  return {
    present: false,
    path: null,
    rows: 0,
    perCheck: {},
    unresolved: [],
    rowsShown: [],
    truncated: false,
    issues: [],
  };
}

export interface AlignmentEntry {
  present: boolean;
  path: string | null;
  verdict: ReviewVerdict | null;
  date: string | null;
}

export function emptyAlignment(): AlignmentEntry {
  return { present: false, path: null, verdict: null, date: null };
}

export interface FastState {
  present: boolean;
  path: string | null;
  /** `null` when the stored source hash is missing/unreadable. */
  stale: boolean | null;
  /** `null` when there is no mirror; a mismatch is a warning, not an error. */
  statusesAligned: boolean | null;
  updatedAt: string | null;
  ledger: LedgerState;
  alignment: { preExecution: AlignmentEntry; planEnd: AlignmentEntry };
}

export function emptyFast(): FastState {
  return {
    present: false,
    path: null,
    stale: null,
    statusesAligned: null,
    updatedAt: null,
    ledger: emptyLedger(),
    alignment: { preExecution: emptyAlignment(), planEnd: emptyAlignment() },
  };
}
