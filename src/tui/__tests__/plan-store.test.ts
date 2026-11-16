/**
 * plan-store.test.ts — TUI wiring: memory snapshot, refresh, session activity,
 * selector/pin, cursor and idempotent disposal (progress-contract §3.1, §9).
 */

import { createStore } from 'solid-js/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import type { ActivityPayload } from '../activity-adapter.js';
import type { ActivityEvent } from '../plan-render-model.js';
import { createPlanStore, type PlanStore, type PlanStoreOptions, type PlanStoreStorage } from '../plan-store.js';
import { fixture, writePlan } from './helpers.js';

const NOW = '2026-11-15T09:41:12.100Z';

function memoryStorage(): PlanStoreStorage {
  return {
    memory<Value extends object>(_key: string, options: { readonly initial: Value }) {
      const [store, setStore] = createStore<Value>(options.initial);
      const update = (mutation: (draft: Value) => void): void => {
        setStore((draft) => {
          mutation(draft);
          return draft;
        });
      };
      return [store, update] as const;
    },
  };
}

function harness(overrides: Partial<PlanStoreOptions> = {}): {
  store: PlanStore;
  unsubscribe: string[];
  handlers: Map<ActivityEvent['type'], (payload: ActivityPayload) => void>;
} {
  const unsubscribe: string[] = [];
  const handlers = new Map<ActivityEvent['type'], (payload: ActivityPayload) => void>();
  const store = createPlanStore({
    storage: memoryStorage(),
    locationDirectory: undefined,
    now: () => NOW,
    watch: false,
    pollMs: 60_000,
    subscribe: (type, handler) => {
      handlers.set(type, handler);
      return () => unsubscribe.push(type);
    },
    ...overrides,
  });
  return { store, unsubscribe, handlers };
}

function send(handlers: Map<ActivityEvent['type'], (payload: ActivityPayload) => void>, event: ActivityEvent): void {
  handlers.get(event.type)?.({ event, directory: null });
}

/** Temp workspace with one active plan and a running session, auto-disposed. */
async function withRunningStore(run: (scope: ReturnType<typeof harness>) => void | Promise<void>): Promise<void> {
  await withTempDir(async (root) => {
    writePlan(root, 'checkout-flow', fixture('active-plan.md'));
    const scope = harness({
      locationDirectory: root,
      session: { status: () => 'running', agent: () => null },
    });
    try {
      await run(scope);
    } finally {
      scope.store.dispose();
    }
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createPlanStore — plan refresh', () => {
  it('derives multi-plan snapshots and toggles collapsed sections', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      writePlan(root, 'billing-flow', fixture('active-plan.md'));
      const scope = harness({ locationDirectory: root });
      try {
        expect(
          scope.store
            .state()
            .plans?.map((plan) => plan.slug)
            .sort()
        ).toEqual(['billing-flow', 'checkout-flow']);
        scope.store.toggleCollapsed('billing-flow');
        expect(scope.store.ui().collapsedSlugs).toContain('billing-flow');
        scope.store.toggleCollapsed('billing-flow');
        expect(scope.store.ui().collapsedSlugs).not.toContain('billing-flow');
      } finally {
        scope.store.dispose();
      }
    });
  });

  it('derives one ready snapshot from the workspace plan tree', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      const { store } = harness({ locationDirectory: root });
      try {
        const state = store.state();
        expect(state.status).toBe('ready');
        expect(state.reason).toBe('ready');
        expect(state.workspaceRoot).toBe(root);
        expect(state.plan?.slug).toBe('checkout-flow');
        expect(state.plan?.counts.subTasks).toEqual({ total: 4, completed: 3, inProgress: 1, pending: 0 });
        expect(state.activity.summary).toBe('2.2 Wire payment retries — dh-software-engineer');
        expect(state.refresh.mode).toBe('none');
        expect(state.revision).toBe(1);
        expect(store.ui().pinnedSlug).toBeNull();
      } finally {
        store.dispose();
      }
    });
  });

  it('re-reads plan files on an explicit refresh', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      const { store } = harness({ locationDirectory: root });
      try {
        expect(store.state().plan?.progress.percent).toBe(75);
        const done = fixture('active-plan.md')
          .replace(
            '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
            '### Phase 2: Checkout Service\n\n- **Status:** Completed'
          )
          .replace(
            '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
            '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Completed'
          );
        writePlan(root, 'checkout-flow', done);
        store.refresh();
        const state = store.state();
        expect(state.plan?.progress.percent).toBe(100);
        expect(state.plan?.current.label).toBe('Completed');
        expect(state.revision).toBe(2);
      } finally {
        store.dispose();
      }
    });
  });

  it('reports the empty state when no workspace is available', () => {
    const { store } = harness({ locationDirectory: undefined });
    try {
      expect(store.state().status).toBe('empty');
      expect(store.state().reason).toBe('no-workspace');
      expect(store.state().warnings.map((issue) => issue.code)).toContain('no-workspace');
    } finally {
      store.dispose();
    }
  });
});

describe('createPlanStore — session activity', () => {
  it('tracks the slot session and seeds its status/agent', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      const { store } = harness({
        locationDirectory: root,
        session: { status: () => 'running', agent: () => 'dh-software-engineer' },
      });
      try {
        store.trackSession('ses_1');
        const state = store.state();
        expect(state.sessionID).toBe('ses_1');
        expect(state.activity).toMatchObject({
          status: 'running',
          agent: 'dh-software-engineer',
          agentSource: 'session',
        });
      } finally {
        store.dispose();
      }
    });
  });

  it('folds allowlisted events through the throttled feed', async () => {
    vi.useFakeTimers();
    await withRunningStore(({ store, handlers }) => {
      store.trackSession('ses_1');
      send(handlers, { type: 'session.tool.input.started', sessionID: 'ses_1', id: 'tool_1', name: 'edit' });
      vi.advanceTimersByTime(100);
      expect(store.state().activity).toMatchObject({ status: 'running', tool: 'edit', summary: 'Running edit' });
      send(handlers, { type: 'session.idle', sessionID: 'ses_1' });
      vi.advanceTimersByTime(100);
      expect(store.state().activity.status).toBe('idle');
    });
  });

  it('ignores events for a different session', async () => {
    vi.useFakeTimers();
    await withRunningStore(({ store, handlers }) => {
      store.trackSession('ses_1');
      send(handlers, { type: 'session.tool.input.started', sessionID: 'ses_2', id: 'tool_1', name: 'edit' });
      vi.advanceTimersByTime(500);
      expect(store.state().activity.summary).not.toBe('Running edit');
    });
  });
});

describe('createPlanStore — selector, pin and cursor', () => {
  it('surfaces multiple active plans and pins one', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      writePlan(
        root,
        'older-plan',
        fixture('active-plan.md')
          .replace('title: Checkout Flow', 'title: Older Plan')
          .replace('updated: 2026-11-14', 'updated: 2026-10-21')
      );
      const { store } = harness({ locationDirectory: root });
      try {
        expect(store.state().status).toBe('selector');
        expect(store.state().selection.suggestedSlug).toBe('checkout-flow');
        store.pin('older-plan');
        const state = store.state();
        expect(store.ui().pinnedSlug).toBe('older-plan');
        expect(state.status).toBe('ready');
        expect(state.reason).toBe('pinned');
        expect(state.plan?.slug).toBe('older-plan');
      } finally {
        store.dispose();
      }
    });
  });

  it('clamps the panel cursor and resets it when pinning', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      const { store } = harness({ locationDirectory: root });
      try {
        store.setCursor(-4);
        expect(store.ui().panelCursor).toBe(0);
        store.setCursor(12.9);
        expect(store.ui().panelCursor).toBe(12);
        store.pin('checkout-flow');
        expect(store.ui().panelCursor).toBe(0);
      } finally {
        store.dispose();
      }
    });
  });
});

describe('createPlanStore — disposal', () => {
  it('unsubscribes every event type and is idempotent', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      const { store, unsubscribe } = harness({ locationDirectory: root });
      store.dispose();
      store.dispose();
      expect(unsubscribe).toHaveLength(11);
    });
  });

  it('becomes inert after disposal', async () => {
    await withTempDir((root) => {
      writePlan(root, 'checkout-flow', fixture('active-plan.md'));
      const { store } = harness({ locationDirectory: root });
      const revision = store.state().revision;
      store.dispose();
      store.refresh();
      store.pin('checkout-flow');
      store.trackSession('ses_1');
      expect(store.state().revision).toBe(revision);
      expect(store.state().sessionID).toBeNull();
      expect(store.ui().pinnedSlug).toBeNull();
    });
  });
});
