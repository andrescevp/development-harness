/**
 * plan-model.ts — pure core model for the TUI plan data layer.
 *
 * Contract: progress-contract.md §2, §3, §8. No filesystem, process, clock,
 * Solid or OpenTUI access lives here, so every derivation module (and the
 * future components) can share one plain immutable shape.
 */
import type { PlanIssue } from './plan-issue.js';
import type { FastState, ReviewState } from './plan-sidecars.js';

/** Canonical plan status domain (type source only). */
const PLAN_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
/** Candidate status before a full parse; `Unknown` = unusable frontmatter value. */
export type CandidateStatus = PlanStatus | 'Unknown';

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === 'string' && (PLAN_STATUSES as readonly string[]).includes(value);
}

export interface StatusCounts {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export function countStatuses(statuses: readonly PlanStatus[]): StatusCounts {
  const counts: StatusCounts = { total: statuses.length, completed: 0, inProgress: 0, pending: 0 };
  for (const status of statuses) {
    if (status === 'Completed') counts.completed += 1;
    else if (status === 'In Progress') counts.inProgress += 1;
    else counts.pending += 1;
  }
  return counts;
}

export type UpdatedSource = 'frontmatter' | 'index' | 'mtime';

/** Selection-pass view of one `docs/plans/<slug>` directory. */
export interface PlanCandidate {
  slug: string;
  title: string;
  /** Workspace-relative: `docs/plans/<slug>/plan.md`. */
  path: string;
  status: CandidateStatus;
  /** `null` when the frontmatter key is absent. */
  active: boolean | null;
  /** `YYYY-MM-DD`; mtime-derived when no declaration exists. */
  updatedAt: string;
  updatedSource: UpdatedSource;
  valid: boolean;
  issue: PlanIssue | null;
}

/** One parsed `## Plans` table row (selection fallback only, §4.5). */
export interface IndexRow {
  slug: string;
  title: string;
  status: CandidateStatus;
  active: boolean;
  updatedAt: string | null;
  line: number;
}

/** Read-layer plain shape for one file (timestamps feed the watcher key). */
export interface SourceFile {
  /** Workspace-relative path. */
  path: string;
  contents: string;
  mtimeMs: number;
  size: number;
}

export interface PlanScan {
  /** `<root>/docs/plans`, or `null` when no root was resolved. */
  plansDir: string | null;
  hasPlansDir: boolean;
  candidates: PlanCandidate[];
  index: IndexRow[];
  indexFile: SourceFile | null;
  /** Directories examined (cap 200). */
  scanned: number;
  truncated: boolean;
  errors: PlanIssue[];
  warnings: PlanIssue[];
}

export interface PlanDetails {
  slug: string;
  /** Absolute plan.md path resolved through the plan ACL. */
  absPath: string;
  plan: SourceFile | null;
  review: SourceFile | null;
  fast: SourceFile | null;
  ledger: SourceFile | null;
  alignment: { preExecution: SourceFile | null; planEnd: SourceFile | null };
  errors: PlanIssue[];
  warnings: PlanIssue[];
}

export type SelectionMode = 'pinned' | 'single-active' | 'index' | 'multiple' | 'none';
export type SelectionSource = 'pin' | 'frontmatter' | 'index' | 'none';

export interface PlanSelection {
  mode: SelectionMode;
  source: SelectionSource;
  selectedSlug: string | null;
  suggestedSlug: string | null;
  pinnedSlug: string | null;
  /** Every candidate that qualifies as active, sorted updatedAt desc / slug asc. */
  candidates: PlanCandidate[];
  scanned: number;
  truncated: boolean;
}

export interface Criterion {
  kind: 'done-when' | 'acceptance';
  text: string;
}

export interface ChecklistItem {
  /** `<relPath>#L<line>`. */
  id: string;
  text: string;
  /** `null` for criteria (never "satisfied"). */
  checked: boolean | null;
  /** 1-based. */
  line: number;
  section: string;
  subTaskIndex: string | null;
  kind: 'checkbox' | 'done-when' | 'acceptance';
}

export interface Checklist {
  items: ChecklistItem[];
  total: number;
  checked: number;
  truncated: boolean;
  inlineText: string | null;
}

export interface SubTaskProgress {
  /** Canonical `"N.M"`. */
  index: string;
  title: string;
  status: PlanStatus;
  delegatedTo: string | null;
  relatedRequirements: string[];
  criteria: Criterion[];
  checkboxes: ChecklistItem[];
  /** 1-based heading line in plan.md. */
  line: number;
}

export interface PhaseProgress {
  index: number;
  title: string;
  status: PlanStatus;
  subTasks: SubTaskProgress[];
  counts: StatusCounts;
  line: number;
}

export type CurrentPositionSource = 'in-progress' | 'next-pending' | 'done';

export interface CurrentPosition {
  phase: { index: number; title: string } | null;
  subTask: { index: string; title: string; delegatedTo: string | null } | null;
  label: string;
  position: string | null;
  ordinal: { phase: number; subTask: number | null } | null;
  source: CurrentPositionSource;
}

export interface ActiveSubTask {
  index: string;
  title: string;
  delegatedTo: string | null;
  phase: { index: number; title: string };
}

export interface PlanProgress {
  slug: string;
  title: string;
  path: string;
  absPath: string;
  status: PlanStatus;
  active: boolean;
  updatedAt: string;
  updatedSource: UpdatedSource;
  phases: PhaseProgress[];
  counts: { phases: StatusCounts; subTasks: StatusCounts };
  progress: { ratio: number; percent: number };
  current: CurrentPosition;
  activeSubTasks: ActiveSubTask[];
  checklists: { plan: Checklist; finalVerification: Checklist };
  review: ReviewState;
  fast: FastState;
  errors: PlanIssue[];
  warnings: PlanIssue[];
}
