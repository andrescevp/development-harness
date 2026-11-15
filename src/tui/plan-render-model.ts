/**
 * plan-render-model.ts — activity and store-snapshot types (contract §3.1,
 * §3.5, §8). Split from `plan-model.ts` to keep every data-layer file under the
 * 300-line rule; the model stays renderer-independent (no Solid/OpenTUI).
 */
import type { PlanIssue } from './plan-issue.js';
import type { PlanProgress, PlanSelection } from './plan-model.js';

export type ActivityStatus = 'idle' | 'running' | 'retrying' | 'unknown';
export type ActivitySource = 'session' | 'plan-fallback';
export type AgentSource = 'session' | 'plan' | null;

export interface Activity {
  status: ActivityStatus;
  agent: string | null;
  agentSource: AgentSource;
  tool: string | null;
  summary: string;
  source: ActivitySource;
  sessionID: string | null;
  stale: boolean;
  updatedAt: string;
}

/** Normalized, allowlisted session signal (§8.3); the mapper never sees raw events. */
export interface ActivitySignal {
  sessionID: string | null;
  status: 'idle' | 'running';
  retryAttempt: number | null;
  agent: string | null;
  toolName: string | null;
  toolID: string | null;
  updatedAt: string;
}

/** Narrow event shapes the 3.3 adapter field-picks into (§8.2). */
export type ActivityEvent =
  | { type: 'session.status'; sessionID: string; status: 'idle' | 'busy' | 'retry'; attempt?: number; at?: string }
  | { type: 'session.idle'; sessionID: string; at?: string }
  | { type: 'session.retry.scheduled'; sessionID: string; attempt: number; at?: string }
  | { type: 'session.execution.started'; sessionID: string; at?: string }
  | {
      type: 'session.execution.succeeded' | 'session.execution.failed' | 'session.execution.interrupted';
      sessionID: string;
      at?: string;
    }
  | { type: 'session.agent.selected'; sessionID: string; agent: string; at?: string }
  | { type: 'session.tool.input.started'; sessionID: string; id: string; name: string; at?: string }
  | { type: 'session.tool.success' | 'session.tool.failed'; sessionID: string; id: string; at?: string };

export type PlanStateStatus = 'loading' | 'ready' | 'selector' | 'empty' | 'error';
export type PlanStateReason =
  | 'ready'
  | 'pinned'
  | 'multiple'
  | 'index'
  | 'empty'
  | 'no-plans-dir'
  | 'no-workspace'
  | 'plan-error'
  | 'scan-error'
  | 'loading';

export interface PlanState {
  status: PlanStateStatus;
  reason: PlanStateReason;
  workspaceRoot: string | null;
  plansDir: string | null;
  selection: PlanSelection;
  plan: PlanProgress | null;
  activity: Activity;
  sessionID: string | null;
  errors: PlanIssue[];
  warnings: PlanIssue[];
  revision: number;
  refreshedAt: string;
  refresh: { mode: 'watch' | 'poll' | 'none'; pending: boolean; durationMs: number };
}

const NO_SELECTION: PlanSelection = {
  mode: 'none',
  source: 'none',
  selectedSlug: null,
  suggestedSlug: null,
  pinnedSlug: null,
  candidates: [],
  scanned: 0,
  truncated: false,
};

/** Loading snapshot (§11 S1) used before the first refresh completes. */
export function loadingPlanState(activity: Activity, sessionID: string | null, now: string): PlanState {
  return {
    status: 'loading',
    reason: 'loading',
    workspaceRoot: null,
    plansDir: null,
    selection: NO_SELECTION,
    plan: null,
    activity,
    sessionID,
    errors: [],
    warnings: [],
    revision: 0,
    refreshedAt: now,
    refresh: { mode: 'none', pending: false, durationMs: 0 },
  };
}
