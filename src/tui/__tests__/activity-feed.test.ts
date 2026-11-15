/**
 * activity-feed.test.ts — session seeding, event folding, throttling, location
 * filtering and disposal for the activity feed (progress-contract §8, §9.3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityPayload } from '../activity-adapter.js';
import { type ActivityFeedOptions, createActivityFeed } from '../activity-feed.js';
import type { PlanProgress, PlanSelection } from '../plan-model.js';
import type { Activity, ActivityEvent } from '../plan-render-model.js';
import { selectPlan } from '../plan-select.js';
import { derivePlanState } from '../plan-state.js';
import { activityOf, candidate, detailsOf, fixture, scanOf } from './helpers.js';

const NOW = '2026-11-15T09:41:12.100Z';

function planFixture(): { plan: PlanProgress; selection: PlanSelection } {
  const state = derivePlanState({
    root: '/repo',
    scan: scanOf([candidate()]),
    details: detailsOf(fixture('active-plan.md')),
    pinnedSlug: null,
    sessionID: 'ses_1',
    activity: activityOf(),
    now: NOW,
    previousRevision: 1,
  });
  if (!state.plan) throw new Error('fixture plan did not derive');
  return { plan: state.plan, selection: state.selection };
}

const MULTIPLE: PlanSelection = selectPlan(
  [candidate(), candidate({ slug: 'older-plan', updatedAt: '2026-10-21' })],
  [],
  null
);

function harness(options: Partial<ActivityFeedOptions> = {}) {
  const handlers = new Map<ActivityEvent['type'], (payload: ActivityPayload) => void>();
  const unsubscribed: string[] = [];
  const changes: Activity[] = [];
  const feed = createActivityFeed({
    current: () => planFixture(),
    onChange: (activity) => changes.push(activity),
    now: () => NOW,
    throttleMs: 100,
    subscribe: (type, handler) => {
      handlers.set(type, handler);
      return () => unsubscribed.push(type);
    },
    ...options,
  });
  const send = (event: ActivityEvent, directory: string | null = null): void => {
    handlers.get(event.type)?.({ event, directory });
  };
  return { feed, changes, unsubscribed, send };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createActivityFeed — session seeding', () => {
  it('seeds a running status and the session agent', () => {
    const { feed } = harness({ session: { status: () => 'running', agent: () => 'dh-software-engineer' } });
    const activity = feed.setSession('ses_1');
    expect(activity).toMatchObject({
      status: 'running',
      agent: 'dh-software-engineer',
      agentSource: 'session',
      summary: 'Running — dh-software-engineer',
      source: 'session',
      sessionID: 'ses_1',
    });
  });

  it('falls back to the active sub-task when the session is idle', () => {
    const { feed } = harness();
    const activity = feed.setSession('ses_1');
    expect(activity).toMatchObject({
      status: 'idle',
      agent: 'dh-software-engineer',
      agentSource: 'plan',
      summary: '2.2 Wire payment retries — dh-software-engineer',
      source: 'session',
    });
  });

  it('uses the selector hint when several plans are active', () => {
    const { feed } = harness({ current: () => ({ plan: null, selection: MULTIPLE }) });
    expect(feed.setSession('ses_1').summary).toBe('2 active plans — choose one');
  });

  it('reports unknown activity before any session is tracked', () => {
    const { feed } = harness();
    expect(feed.activity()).toMatchObject({ status: 'unknown', source: 'plan-fallback' });
  });
});

describe('createActivityFeed — event folding and throttle', () => {
  it('folds a tool event into one throttled emission', () => {
    const { feed, changes, send } = harness({ session: { status: () => 'running', agent: () => null } });
    feed.setSession('ses_1');
    send({ type: 'session.tool.input.started', sessionID: 'ses_1', id: 'tool_1', name: 'edit' });
    expect(changes).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ status: 'running', tool: 'edit', summary: 'Running edit' });
  });

  it('coalesces a burst into a single emission (≤10 renders/s)', () => {
    const { feed, changes, send } = harness({ session: { status: () => 'running', agent: () => null } });
    feed.setSession('ses_1');
    send({ type: 'session.tool.input.started', sessionID: 'ses_1', id: 'tool_1', name: 'edit' });
    send({ type: 'session.agent.selected', sessionID: 'ses_1', agent: 'dh-reviewer' });
    send({ type: 'session.tool.success', sessionID: 'ses_1', id: 'tool_1' });
    send({ type: 'session.idle', sessionID: 'ses_1' });
    vi.advanceTimersByTime(100);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ status: 'idle', tool: null, agent: 'dh-reviewer' });
  });

  it('surfaces retry attempts without provider text', () => {
    const { feed, changes, send } = harness({ session: { status: () => 'running', agent: () => null } });
    feed.setSession('ses_1');
    send({ type: 'session.status', sessionID: 'ses_1', status: 'retry', attempt: 2 });
    vi.advanceTimersByTime(100);
    expect(changes[0]).toMatchObject({ status: 'retrying', summary: 'Retry 2 — running' });
  });

  it('marks a running activity as stale when the signal ages out', () => {
    const { feed, changes, send } = harness({ session: { status: () => 'running', agent: () => null } });
    feed.setSession('ses_1');
    send({ type: 'session.execution.started', sessionID: 'ses_1', at: '2026-11-15T09:00:00.000Z' });
    vi.advanceTimersByTime(100);
    expect(changes[0]).toMatchObject({ status: 'running', stale: true });
  });

  it('ignores events from another session or location', () => {
    const { feed, changes, send } = harness({
      session: { status: () => 'running', agent: () => null },
      root: '/repo',
    });
    feed.setSession('ses_1');
    send({ type: 'session.tool.input.started', sessionID: 'ses_other', id: 'tool_1', name: 'edit' });
    send({ type: 'session.tool.input.started', sessionID: 'ses_1', id: 'tool_2', name: 'edit' }, '/elsewhere');
    vi.advanceTimersByTime(100);
    expect(changes).toHaveLength(0);
  });

  it('accepts events whose location matches the resolved root', () => {
    const { feed, changes, send } = harness({ session: { status: () => 'running', agent: () => null }, root: '/repo' });
    feed.setSession('ses_1');
    send({ type: 'session.tool.input.started', sessionID: 'ses_1', id: 'tool_1', name: 'edit' }, '/repo');
    vi.advanceTimersByTime(100);
    expect(changes).toHaveLength(1);
  });
});

describe('createActivityFeed — session switch and disposal', () => {
  it('resets the signal when the session changes', () => {
    const { feed, send } = harness({
      session: { status: (id) => (id === 'ses_1' ? 'running' : 'idle'), agent: () => null },
    });
    feed.setSession('ses_1');
    send({ type: 'session.tool.input.started', sessionID: 'ses_1', id: 'tool_1', name: 'edit' });
    const switched = feed.setSession('ses_2');
    expect(switched).toMatchObject({ sessionID: 'ses_2', status: 'idle', tool: null });
    expect(switched.summary).toBe('2.2 Wire payment retries — dh-software-engineer');
  });

  it('unsubscribes every allowlisted type and stops emitting', () => {
    const { feed, changes, unsubscribed, send } = harness({ session: { status: () => 'running', agent: () => null } });
    feed.setSession('ses_1');
    feed.dispose();
    feed.dispose();
    expect(unsubscribed).toHaveLength(11);
    send({ type: 'session.idle', sessionID: 'ses_1' });
    vi.advanceTimersByTime(500);
    expect(changes).toHaveLength(0);
  });
});
