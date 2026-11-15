/**
 * activity-feed.ts — session activity subscription with a 100 ms throttle
 * (progress-contract §8, §9.3).
 *
 * It owns the normalized `ActivitySignal`, folds only allowlisted events from
 * the current session/location, and emits a derived `Activity` at most ten
 * times per second. `dispose` unsubscribes everything and is idempotent.
 */
import path from 'node:path';
import { ACTIVITY_EVENT_TYPES, type ActivityPayload } from './activity-adapter.js';
import type { PlanProgress, PlanSelection } from './plan-model.js';
import type { Activity, ActivityEvent, ActivitySignal } from './plan-render-model.js';
import { deriveActivity, emptySignal, foldActivityEvent } from './session-activity.js';

interface ActivitySeed {
  status(sessionID: string): 'idle' | 'running';
  agent(sessionID: string): string | null;
}

export interface ActivityFeedOptions {
  /** Latest plan/selection snapshot for the fallback line (§8.4). */
  current: () => { plan: PlanProgress | null; selection: PlanSelection };
  onChange: (activity: Activity) => void;
  session?: ActivitySeed;
  subscribe?: (type: ActivityEvent['type'], handler: (payload: ActivityPayload) => void) => () => void;
  now?: () => string;
  throttleMs?: number;
  /** Resolved workspace root; events from another location are ignored. */
  root?: string | null;
}

export interface ActivityFeed {
  /** Derive the current activity, optionally against a freshly derived plan. */
  activity(plan?: PlanProgress | null, selection?: PlanSelection): Activity;
  /** Switch session: resets the signal, seeds status/agent and returns activity. */
  setSession(sessionID: string | null): Activity;
  dispose(): void;
}

const DEFAULT_THROTTLE_MS = 100;

function isoNow(now: (() => string) | undefined): string {
  return now ? now() : new Date().toISOString();
}

function seedSignal(sessionID: string, seed: ActivitySeed | undefined, at: string): ActivitySignal {
  const base = emptySignal(sessionID, at);
  if (!seed) return base;
  try {
    const status = seed.status(sessionID);
    return { ...base, status: status === 'running' ? 'running' : 'idle', agent: seed.agent(sessionID) };
  } catch {
    // A session the host has not loaded yet keeps the safe default signal.
    return base;
  }
}

/** Create the throttled activity feed for the current TUI session. */
export function createActivityFeed(options: ActivityFeedOptions): ActivityFeed {
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  let signal: ActivitySignal | null = null;
  let sessionID: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function activity(plan?: PlanProgress | null, selection?: PlanSelection): Activity {
    const current = options.current();
    return deriveActivity({
      signal,
      plan: plan === undefined ? current.plan : plan,
      selection: selection ?? current.selection,
      sessionID,
      now: isoNow(options.now),
    });
  }

  function emit(): void {
    timer = null;
    if (disposed) return;
    options.onChange(activity());
  }

  function schedule(): void {
    if (disposed || timer !== null) return;
    timer = setTimeout(emit, throttleMs);
  }

  function onPayload(payload: ActivityPayload): void {
    if (disposed || signal === null || payload.event.sessionID !== sessionID) return;
    if (payload.directory !== null && options.root) {
      if (path.resolve(payload.directory) !== path.resolve(options.root)) return;
    }
    signal = foldActivityEvent(signal, payload.event);
    schedule();
  }

  const disposers: Array<() => void> = [];
  if (options.subscribe) {
    for (const type of ACTIVITY_EVENT_TYPES) disposers.push(options.subscribe(type, onPayload));
  }

  return {
    activity,
    setSession(nextSessionID: string | null): Activity {
      sessionID = nextSessionID;
      const at = isoNow(options.now);
      signal = nextSessionID === null ? null : seedSignal(nextSessionID, options.session, at);
      return activity();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      for (const dispose of disposers.splice(0)) dispose();
    },
  };
}
