/**
 * session-activity.ts — privacy-safe "what is happening" model (§8).
 *
 * The 3.3 adapter field-picks allowlisted event payloads into `ActivityEvent`;
 * this module never sees raw events, message bodies, tool input/output or retry
 * provider strings. Only validated ids and fixed summary templates are emitted.
 */
import { clampText } from './plan-issue.js';
import type { PlanProgress, PlanSelection } from './plan-model.js';
import type {
  Activity,
  ActivityEvent,
  ActivitySignal,
  ActivitySource,
  ActivityStatus,
  AgentSource,
} from './plan-render-model.js';

/** Agent ids are short slugs; anything else is dropped, never escaped. */
export const AGENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
/** Tool names are short slugs (<= 40 chars). */
export const TOOL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,39}$/i;
const SUMMARY_MAX = 120;
const STALE_MS = 5 * 60 * 1000;

function idleSignal(signal: ActivitySignal, at: string): ActivitySignal {
  return { ...signal, status: 'idle', retryAttempt: null, toolName: null, toolID: null, updatedAt: at };
}

/** Seed the normalized signal for a session (§8.3). */
export function emptySignal(sessionID: string | null, now: string): ActivitySignal {
  return {
    sessionID,
    status: 'idle',
    retryAttempt: null,
    agent: null,
    toolName: null,
    toolID: null,
    updatedAt: now,
  };
}

/**
 * Fold one allowlisted event into the signal (§8.2). Events from another
 * session are ignored; tool events never change the status.
 */
export function foldActivityEvent(signal: ActivitySignal, event: ActivityEvent): ActivitySignal {
  if (signal.sessionID !== null && event.sessionID !== signal.sessionID) return signal;
  const at = event.at ?? signal.updatedAt;
  switch (event.type) {
    case 'session.status':
      if (event.status === 'idle') return idleSignal(signal, at);
      if (event.status === 'busy') return { ...signal, status: 'running', retryAttempt: null, updatedAt: at };
      return {
        ...signal,
        status: 'running',
        retryAttempt: typeof event.attempt === 'number' ? event.attempt : signal.retryAttempt,
        updatedAt: at,
      };
    case 'session.idle':
    case 'session.execution.succeeded':
    case 'session.execution.failed':
    case 'session.execution.interrupted':
      return idleSignal(signal, at);
    case 'session.retry.scheduled':
      return { ...signal, status: 'running', retryAttempt: event.attempt, updatedAt: at };
    case 'session.execution.started':
      return { ...signal, status: 'running', updatedAt: at };
    case 'session.agent.selected':
      return { ...signal, agent: event.agent, updatedAt: at };
    case 'session.tool.input.started':
      return { ...signal, toolName: event.name, toolID: event.id, updatedAt: at };
    case 'session.tool.success':
    case 'session.tool.failed':
      return event.id === signal.toolID
        ? { ...signal, toolName: null, toolID: null, updatedAt: at }
        : { ...signal, updatedAt: at };
    default:
      return signal;
  }
}

function isStale(updatedAt: string, now: string): boolean {
  const then = new Date(updatedAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(then) || Number.isNaN(current)) return false;
  return current - then > STALE_MS;
}

function statusOf(signal: ActivitySignal | null): ActivityStatus {
  if (signal === null) return 'unknown';
  if (signal.retryAttempt !== null) return 'retrying';
  return signal.status;
}

/** Build the one-line summary from fixed templates only (§8.4). */
function summaryOf(input: {
  status: ActivityStatus;
  agent: string | null;
  tool: string | null;
  retryAttempt: number | null;
  plan: PlanProgress | null;
  selection: PlanSelection | null;
}): string {
  if (input.status === 'retrying') {
    return clampText(`Retry ${input.retryAttempt ?? 1} — running`, SUMMARY_MAX);
  }
  if (input.status === 'running') {
    if (input.tool) return clampText(`Running ${input.tool}`, SUMMARY_MAX);
    if (input.agent) return clampText(`Running — ${input.agent}`, SUMMARY_MAX);
    return 'Running';
  }
  const plan = input.plan;
  if (plan) {
    const subTask = plan.current.subTask;
    if (subTask) {
      const position = plan.current.position ?? plan.current.label;
      return clampText(`${position} ${subTask.title} — ${input.agent ?? 'unassigned'}`, SUMMARY_MAX);
    }
    if (plan.current.source === 'done') return 'Completed';
    if (plan.current.phase) {
      return clampText(`Phase ${plan.current.phase.index} — ${plan.current.phase.title}`, SUMMARY_MAX);
    }
    return 'Completed';
  }
  if (input.selection?.mode === 'multiple') {
    return clampText(`${input.selection.candidates.length} active plans — choose one`, SUMMARY_MAX);
  }
  return 'No active plan';
}

/**
 * Derive the renderable activity line (§8.4). Falls back to the plan's current
 * sub-task/agent when the session signal is missing or idle.
 */
export function deriveActivity(input: {
  signal: ActivitySignal | null;
  plan: PlanProgress | null;
  sessionID: string | null;
  now: string;
  selection?: PlanSelection | null;
}): Activity {
  const { signal, plan, sessionID, now } = input;
  const status = statusOf(signal);
  const sessionAgent = signal?.agent && AGENT_PATTERN.test(signal.agent) ? signal.agent : null;
  const delegated = plan?.current.subTask?.delegatedTo ?? null;
  const planAgent = delegated !== null && AGENT_PATTERN.test(delegated) ? delegated : null;
  const agent = sessionAgent ?? planAgent;
  const agentSource: AgentSource = sessionAgent !== null ? 'session' : planAgent !== null ? 'plan' : null;
  const tool = signal?.toolName && TOOL_PATTERN.test(signal.toolName) ? signal.toolName : null;
  const summary = summaryOf({
    status,
    agent,
    tool,
    retryAttempt: signal?.retryAttempt ?? null,
    plan,
    selection: input.selection ?? null,
  });
  const source: ActivitySource = signal !== null && status !== 'unknown' ? 'session' : 'plan-fallback';
  const updatedAt = signal?.updatedAt ?? now;
  return {
    status,
    agent,
    agentSource,
    tool,
    summary,
    source,
    sessionID,
    stale: (status === 'running' || status === 'retrying') && isStale(updatedAt, now),
    updatedAt,
  };
}
