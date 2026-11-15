/**
 * session-activity.test.ts — allowlisted reducer, status mapping and privacy (§8).
 */
import { describe, expect, it } from 'vitest';
import type { PlanProgress } from '../plan-model.js';
import type { ActivityEvent, ActivitySignal } from '../plan-render-model.js';
import { selectPlan } from '../plan-select.js';
import { derivePlanState } from '../plan-state.js';
import { AGENT_PATTERN, deriveActivity, emptySignal, foldActivityEvent, TOOL_PATTERN } from '../session-activity.js';
import { activityOf, candidate, detailsOf, fixture, scanOf } from './helpers.js';

const NOW = '2026-11-15T09:41:12.000Z';
const SESSION = 'ses_fixture';

function signal(overrides: Partial<ActivitySignal> = {}): ActivitySignal {
  return { ...emptySignal(SESSION, NOW), ...overrides };
}

function planProgress(): PlanProgress {
  const state = derivePlanState({
    root: '/repo',
    scan: scanOf([candidate()]),
    details: detailsOf(fixture('active-plan.md')),
    pinnedSlug: null,
    sessionID: SESSION,
    activity: activityOf(),
    now: NOW,
    previousRevision: 0,
  });
  return state.plan!;
}

describe('foldActivityEvent', () => {
  it('maps session status to running/idle and keeps retry attempts', () => {
    const busy = foldActivityEvent(signal(), { type: 'session.status', sessionID: SESSION, status: 'busy' });
    expect(busy.status).toBe('running');

    const retry = foldActivityEvent(signal(), {
      type: 'session.status',
      sessionID: SESSION,
      status: 'retry',
      attempt: 2,
    });
    expect(retry).toMatchObject({ status: 'running', retryAttempt: 2 });

    const idle = foldActivityEvent(
      { ...retry, toolName: 'edit', toolID: 't1' },
      {
        type: 'session.status',
        sessionID: SESSION,
        status: 'idle',
      }
    );
    expect(idle).toMatchObject({ status: 'idle', retryAttempt: null, toolName: null, toolID: null });
  });

  it('tracks execution, retry.scheduled and terminal events', () => {
    const scheduled = foldActivityEvent(signal(), { type: 'session.retry.scheduled', sessionID: SESSION, attempt: 4 });
    expect(scheduled).toMatchObject({ status: 'running', retryAttempt: 4 });

    const started = foldActivityEvent(signal(), { type: 'session.execution.started', sessionID: SESSION });
    expect(started.status).toBe('running');

    for (const type of [
      'session.execution.succeeded',
      'session.execution.failed',
      'session.execution.interrupted',
    ] as const) {
      expect(foldActivityEvent(started, { type, sessionID: SESSION }).status).toBe('idle');
    }
  });

  it('tracks the selected agent and the tool lifecycle without changing status', () => {
    const running = signal({ status: 'running' });
    const agent = foldActivityEvent(running, {
      type: 'session.agent.selected',
      sessionID: SESSION,
      agent: 'dh-reviewer',
    });
    expect(agent.agent).toBe('dh-reviewer');

    const tool = foldActivityEvent(agent, {
      type: 'session.tool.input.started',
      sessionID: SESSION,
      id: 'tool-1',
      name: 'edit',
    });
    expect(tool).toMatchObject({ status: 'running', toolName: 'edit', toolID: 'tool-1' });

    const other = foldActivityEvent(tool, { type: 'session.tool.success', sessionID: SESSION, id: 'tool-2' });
    expect(other.toolName).toBe('edit');
    const cleared = foldActivityEvent(other, { type: 'session.tool.failed', sessionID: SESSION, id: 'tool-1' });
    expect(cleared).toMatchObject({ toolName: null, toolID: null });
  });

  it('ignores foreign sessions and unknown event types', () => {
    const base = signal({ status: 'running' });
    expect(foldActivityEvent(base, { type: 'session.idle', sessionID: 'ses_other' })).toBe(base);
    const unknown = { type: 'session.text.delta', sessionID: SESSION } as unknown as ActivityEvent;
    expect(foldActivityEvent(base, unknown)).toBe(base);
  });
});

describe('deriveActivity', () => {
  it('reports unknown with a plan fallback when there is no signal', () => {
    const activity = deriveActivity({ signal: null, plan: planProgress(), sessionID: SESSION, now: NOW });
    expect(activity).toMatchObject({
      status: 'unknown',
      source: 'plan-fallback',
      agent: 'dh-software-engineer',
      agentSource: 'plan',
      summary: '2.2 Wire payment retries — dh-software-engineer',
    });
  });

  it('summarizes running tool/agent/plain states from fixed templates', () => {
    const plan = planProgress();
    const withTool = deriveActivity({
      signal: signal({ status: 'running', toolName: 'edit' }),
      plan,
      sessionID: SESSION,
      now: NOW,
    });
    expect(withTool).toMatchObject({ status: 'running', tool: 'edit', summary: 'Running edit', source: 'session' });

    const withAgent = deriveActivity({
      signal: signal({ status: 'running', agent: 'dh-software-engineer' }),
      plan,
      sessionID: SESSION,
      now: NOW,
    });
    expect(withAgent.summary).toBe('Running — dh-software-engineer');

    const plain = deriveActivity({ signal: signal({ status: 'running' }), plan: null, sessionID: SESSION, now: NOW });
    expect(plain.summary).toBe('Running');
  });

  it('marks retries and stale running signals', () => {
    const retry = deriveActivity({
      signal: signal({ status: 'running', retryAttempt: 3, updatedAt: '2026-11-15T09:40:00.000Z' }),
      plan: planProgress(),
      sessionID: SESSION,
      now: NOW,
    });
    expect(retry).toMatchObject({ status: 'retrying', summary: 'Retry 3 — running', stale: false });

    const stale = deriveActivity({
      signal: signal({ status: 'running', updatedAt: '2026-11-15T09:30:00.000Z' }),
      plan: null,
      sessionID: SESSION,
      now: NOW,
    });
    expect(stale.stale).toBe(true);
  });

  it('summarizes completed, selector and empty states', () => {
    const done = fixture('active-plan.md')
      .replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Completed'
      )
      .replace(
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Completed'
      );
    const planState = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate()]),
      details: detailsOf(done),
      pinnedSlug: null,
      sessionID: SESSION,
      activity: activityOf(),
      now: NOW,
      previousRevision: 0,
    });
    const completed = deriveActivity({ signal: signal(), plan: planState.plan, sessionID: SESSION, now: NOW });
    expect(completed).toMatchObject({ status: 'idle', summary: 'Completed', source: 'session' });

    const selection = selectPlan([candidate(), candidate({ slug: 'older-plan' })], [], null);
    const selector = deriveActivity({ signal: null, plan: null, sessionID: SESSION, now: NOW, selection });
    expect(selector.summary).toBe('2 active plans — choose one');

    const empty = deriveActivity({ signal: null, plan: null, sessionID: SESSION, now: NOW });
    expect(empty.summary).toBe('No active plan');
  });

  it('drops unvalidated agent/tool strings instead of echoing them', () => {
    const activity = deriveActivity({
      signal: signal({
        status: 'running',
        agent: '../../etc/passwd',
        toolName: '/usr/bin/rm -rf',
      }),
      plan: planProgress(),
      sessionID: SESSION,
      now: NOW,
    });
    expect(activity.agent).toBe('dh-software-engineer');
    expect(activity.agentSource).toBe('plan');
    expect(activity.tool).toBeNull();
    expect(activity.summary).toBe('Running — dh-software-engineer');

    expect(AGENT_PATTERN.test('dh-software-engineer')).toBe(true);
    expect(AGENT_PATTERN.test('bad agent')).toBe(false);
    expect(TOOL_PATTERN.test('edit')).toBe(true);
    expect(TOOL_PATTERN.test('a'.repeat(41))).toBe(false);
  });

  it('caps the summary at 120 characters and keeps it single-line', () => {
    const longPhase = `# Plan: Long\n\n## Phases\n\n### Phase 1: ${'x'.repeat(300)}\n\n- **Status:** Pending\n`;
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate({ title: 'Long', status: 'Pending' })]),
      details: detailsOf(longPhase),
      pinnedSlug: null,
      sessionID: SESSION,
      activity: activityOf(),
      now: NOW,
      previousRevision: 0,
    });
    const activity = deriveActivity({ signal: signal(), plan: state.plan, sessionID: SESSION, now: NOW });
    expect(activity.summary.length).toBeLessThanOrEqual(120);
    expect(activity.summary.startsWith('Phase 1 —')).toBe(true);
    expect(activity.summary).not.toContain('\n');
  });
});
