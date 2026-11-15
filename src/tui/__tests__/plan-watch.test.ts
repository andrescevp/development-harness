/**
 * plan-watch.test.ts — debounce/max-wait/poll timing, fingerprint skip,
 * single-flight and disposal (§9, §9.4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import type { PlanWatchOptions } from '../plan-watch.js';
import { createPlanWatcher, fingerprintPlanTree } from '../plan-watch.js';
import { fixture, writePlan } from './helpers.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface Rig {
  calls: string[];
  watcher: ReturnType<typeof createPlanWatcher>;
  /** Change the fingerprint so the next run is not skipped. */
  bump(): void;
}

/** Watcher rig with a controllable fingerprint and a call recorder. */
function rig(overrides: Partial<PlanWatchOptions> = {}): Rig {
  let version = 0;
  const calls: string[] = [];
  const watcher = createPlanWatcher({
    plansDir: '/repo/docs/plans',
    onRefresh: (mode) => calls.push(mode),
    fingerprint: () => `v${version}`,
    watch: false,
    ...overrides,
  });
  return {
    calls,
    watcher,
    bump: () => {
      version += 1;
    },
  };
}

describe('createPlanWatcher', () => {
  it('refreshes once after the 300 ms trailing debounce', () => {
    const { calls, watcher, bump } = rig();
    bump();
    watcher.notify();
    vi.advanceTimersByTime(299);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['watch']);
    watcher.unsubscribe();
  });

  it('coalesces a burst into one refresh', () => {
    const { calls, watcher, bump } = rig();
    for (let index = 0; index < 3; index += 1) {
      bump();
      watcher.notify();
      vi.advanceTimersByTime(100);
    }
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(calls).toEqual(['watch']);
    watcher.unsubscribe();
  });

  it('honors the 1,000 ms max wait under a continuous burst', () => {
    const { calls, watcher, bump } = rig();
    for (let index = 0; index < 4; index += 1) {
      bump();
      watcher.notify();
      vi.advanceTimersByTime(200);
    }
    bump();
    watcher.notify();
    vi.advanceTimersByTime(199);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['watch']);
    watcher.unsubscribe();
  });

  it('skips the refresh when the fingerprint is unchanged', () => {
    const { calls, watcher } = rig();
    watcher.notify();
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual([]);
    watcher.unsubscribe();
  });

  it('falls back to the poll interval when watching is unavailable', () => {
    const { calls, watcher, bump } = rig();
    expect(watcher.mode()).toBe('poll');
    vi.advanceTimersByTime(1999);
    expect(calls).toEqual([]);
    bump();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['poll']);
    watcher.unsubscribe();
  });

  it('coalesces a re-entrant refresh into one follow-up run', () => {
    let version = 0;
    const calls: string[] = [];
    let watcher: ReturnType<typeof createPlanWatcher>;
    watcher = createPlanWatcher({
      plansDir: '/repo/docs/plans',
      fingerprint: () => `v${version}`,
      watch: false,
      onRefresh: (mode) => {
        calls.push(mode);
        if (calls.length === 1) {
          version += 1;
          watcher.refresh();
        }
      },
    });
    version = 1;
    watcher.notify();
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['watch']);
    vi.advanceTimersByTime(300);
    expect(calls).toEqual(['watch', 'watch']);
    watcher.unsubscribe();
  });

  it('runs an explicit refresh immediately and disposes idempotently', () => {
    const { calls, watcher, bump } = rig();
    bump();
    watcher.refresh();
    expect(calls).toEqual(['manual']);
    watcher.unsubscribe();
    watcher.unsubscribe();
    bump();
    watcher.notify();
    vi.advanceTimersByTime(5000);
    expect(calls).toEqual(['manual']);
  });
});

describe('watcher on a temp plan tree', () => {
  it('detects a real plan change through the fingerprint poll', async () => {
    await withTempDir((dir) => {
      writePlan(dir, 'checkout-flow', fixture('active-plan.md'));
      const plansDir = path.join(dir, 'docs', 'plans');
      const calls: string[] = [];
      const watcher = createPlanWatcher({ plansDir, onRefresh: (mode) => calls.push(mode), watch: false });
      const before = fingerprintPlanTree(plansDir);

      vi.advanceTimersByTime(1999);
      expect(calls).toEqual([]);
      const plan = path.join(plansDir, 'checkout-flow', 'plan.md');
      fs.appendFileSync(plan, '\n<!-- changed -->\n', 'utf8');
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(plan, future, future);

      vi.advanceTimersByTime(2000);
      vi.advanceTimersByTime(300);
      expect(calls).toEqual(['poll']);
      expect(fingerprintPlanTree(plansDir)).not.toBe(before);
      watcher.unsubscribe();
    });
  });

  it('attaches a real watcher when the platform allows it', async () => {
    await withTempDir((dir) => {
      writePlan(dir, 'checkout-flow', fixture('active-plan.md'));
      const watcher = createPlanWatcher({
        plansDir: path.join(dir, 'docs', 'plans'),
        onRefresh: () => undefined,
        watch: true,
      });
      expect(watcher.mode()).toBe('watch');
      watcher.unsubscribe();
    });
  });
});
