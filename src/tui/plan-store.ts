/**
 * plan-store.ts — the TUI wiring layer: one `PlanState` snapshot in
 * `storage.memory`, a debounced plan watcher, and the throttled activity feed
 * (progress-contract §3.1, §3.6, §9, §9.4, §10).
 *
 * Reads plan files in timer callbacks only, never during a slot render.
 * Everything it creates (watcher, timers, event subscriptions) is released by
 * the idempotent `dispose()`.
 */
import path from 'node:path';
import type { Store } from 'solid-js/store';
import type { ActivityPayload } from './activity-adapter.js';
import { createActivityFeed } from './activity-feed.js';
import type { PlanProgress, PlanSelection } from './plan-model.js';
import { derivePlanProgress } from './plan-progress.js';
import { readPlanDetails, readPlanScan, resolvePlanRoot } from './plan-read.js';
import type { ActivityEvent, PlanState } from './plan-render-model.js';
import { derivePlanState, loadingPlanState, selectPlan } from './plan-state.js';
import { createPlanWatcher, type PlanWatcher, type RefreshMode } from './plan-watch.js';
import { deriveActivity } from './session-activity.js';

const PLAN_STATE_KEY = 'dev-harness-skills.plan-progress.state';
const PLAN_UI_KEY = 'dev-harness-skills.plan-progress.ui';

/** UI-only state (never persisted): selector pin and panel scroll cursor. */
interface PlanUiState {
  pinnedSlug: string | null;
  panelCursor: number;
  /** Slugs whose sidebar section is collapsed. */
  collapsedSlugs: string[];
}

interface StateSlot {
  state: PlanState;
}

type MemoryTuple<Value extends object> = readonly [Store<Value>, (mutation: (draft: Value) => void) => void];

/** Structural subset of the host `context.storage`. */
export interface PlanStoreStorage {
  memory<Value extends object>(key: string, options: { readonly initial: Value }): MemoryTuple<Value>;
}

/** Structural subset of `context.data.session` used for activity seeding. */
interface PlanStoreSessionSource {
  status(sessionID: string): 'idle' | 'running';
  agent(sessionID: string): string | null;
}

export interface PlanStoreOptions {
  storage: PlanStoreStorage;
  /** `context.location?.directory`; the only plan-root input (§4.1). */
  locationDirectory: string | undefined;
  /** Process env, checked only for the `workspace-root-override` warning. */
  env?: { DH_WORKSPACE_ROOT?: string } | undefined;
  session?: PlanStoreSessionSource;
  subscribe?: (type: ActivityEvent['type'], handler: (payload: ActivityPayload) => void) => () => void;
  now?: () => string;
  /** `false` disables `fs.watch` (deterministic tests keep the poll fallback). */
  watch?: boolean;
  debounceMs?: number;
  pollMs?: number;
  throttleMs?: number;
}

export interface PlanStore {
  state: () => PlanState;
  ui: () => PlanUiState;
  refresh(mode?: RefreshMode): void;
  trackSession(sessionID: string | null): void;
  pin(slug: string | null): void;
  setCursor(cursor: number): void;
  toggleCollapsed(slug: string): void;
  dispose(): void;
}

function initialActivity(now: () => string) {
  return deriveActivity({ signal: null, plan: null, sessionID: null, now: now() });
}

/** Build the TUI store and perform the first (synchronous) refresh. */
export function createPlanStore(options: PlanStoreOptions): PlanStore {
  const now = options.now ?? (() => new Date().toISOString());
  const resolved = resolvePlanRoot(options.locationDirectory, options.env);
  const root = resolved.root;
  const [store, update] = options.storage.memory<StateSlot>(PLAN_STATE_KEY, {
    initial: { state: loadingPlanState(initialActivity(now), null, now()) },
  });
  const [uiStore, updateUi] = options.storage.memory<PlanUiState>(PLAN_UI_KEY, {
    initial: { pinnedSlug: null, panelCursor: 0, collapsedSlugs: [] },
  });

  const state = (): PlanState => store.state;
  const ui = (): PlanUiState => uiStore;

  const feed = createActivityFeed({
    current: (): { plan: PlanProgress | null; selection: PlanSelection } => ({
      plan: state().plan,
      selection: state().selection,
    }),
    onChange: (activity) => {
      update((draft) => {
        draft.state.activity = activity;
      });
    },
    session: options.session,
    subscribe: options.subscribe,
    now,
    throttleMs: options.throttleMs,
    root,
  });

  let watcher: PlanWatcher | null = null;
  let disposed = false;

  function refresh(mode: RefreshMode = 'manual'): void {
    if (disposed) return;
    const started = Date.now();
    const previous = state();
    const scan = readPlanScan(root);
    const selection = selectPlan(scan.candidates, scan.index, ui().pinnedSlug, {
      scanned: scan.scanned,
      truncated: scan.truncated,
    });
    const details = root !== null && selection.selectedSlug ? readPlanDetails(root, selection.selectedSlug) : null;
    const plans =
      root === null
        ? []
        : scan.candidates
            .filter((candidate) => candidate.status === 'In Progress' || candidate.active === true)
            .map((candidate) => {
              const candidateDetails = readPlanDetails(root, candidate.slug);
              if (!candidateDetails.plan) return null;
              try {
                return derivePlanProgress({
                  candidate,
                  planContents: candidateDetails.plan.contents,
                  details: candidateDetails,
                  now: now(),
                });
              } catch {
                return null;
              }
            })
            .filter((plan): plan is PlanProgress => plan !== null)
            .sort((a, b) => (a.slug === selection.selectedSlug ? -1 : b.slug === selection.selectedSlug ? 1 : 0));
    const derived = derivePlanState({
      root,
      scan,
      details,
      pinnedSlug: ui().pinnedSlug,
      sessionID: previous.sessionID,
      activity: previous.activity,
      now: now(),
      previousRevision: previous.revision,
      rootIssues: resolved.issues,
      refresh: { mode: mode === 'manual' ? 'none' : mode, pending: false, durationMs: 0 },
    });
    const next: PlanState = {
      ...derived,
      plans,
      activity: feed.activity(derived.plan, derived.selection),
      refresh: { ...derived.refresh, durationMs: Date.now() - started },
    };
    update((draft) => {
      draft.state = next;
    });
  }

  refresh();
  if (root !== null) {
    watcher = createPlanWatcher({
      plansDir: path.join(root, 'docs', 'plans'),
      onRefresh: (mode) => refresh(mode),
      watch: options.watch,
      debounceMs: options.debounceMs,
      pollMs: options.pollMs,
    });
  }

  return {
    state,
    ui,
    refresh,
    trackSession(sessionID: string | null): void {
      if (disposed || sessionID === state().sessionID) return;
      const activity = feed.setSession(sessionID);
      update((draft) => {
        draft.state.sessionID = sessionID;
        draft.state.activity = activity;
      });
    },
    pin(slug: string | null): void {
      if (disposed) return;
      updateUi((draft) => {
        draft.pinnedSlug = slug;
        draft.panelCursor = 0;
      });
      refresh('manual');
    },
    setCursor(cursor: number): void {
      if (disposed) return;
      updateUi((draft) => {
        draft.panelCursor = Math.max(0, Math.floor(cursor));
      });
    },
    toggleCollapsed(slug: string): void {
      if (disposed) return;
      updateUi((draft) => {
        const index = draft.collapsedSlugs.indexOf(slug);
        if (index === -1) draft.collapsedSlugs.push(slug);
        else draft.collapsedSlugs.splice(index, 1);
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      watcher?.unsubscribe();
      watcher = null;
      feed.dispose();
    },
  };
}
