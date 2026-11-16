import { Plugin } from '@opencode/plugin/tui';
import { toActivityPayload } from './activity-adapter.js';
import { PlanFileModal } from './components/PlanFileModal.js';
import { PlanPanel } from './components/PlanPanel.js';
import { SidebarPlan } from './components/SidebarPlan.js';
import { sidebarWidth } from './components/sidebar-model.js';
import { createPlanStore } from './plan-store.js';
import { TUI_PLAN_COMMAND, TUI_PLAN_PANEL, TUI_PLUGIN_ID } from './plugin-id.js';

/**
 * TUI part of dev-harness-skills (`package.json` `exports["./tui"]`).
 *
 * Read-only plan progress for the OpenCode V2 TUI:
 * - `sidebar.content`: compact card (3.1) fed by one `PlanState` snapshot;
 * - `session.panel` (`dev-harness-skills.plan`): full panel (3.2), opened by
 *   the `/plan-progress` slash/palette command (3.3);
 * - a debounced watcher on the workspace `docs/plans` and a throttled,
 *   allowlisted activity subscription, both released by the returned cleanup.
 *
 * No server part, tool, or write path is touched (progress-contract §10).
 */
export default Plugin.define({
  id: TUI_PLUGIN_ID,
  setup(context) {
    const store = createPlanStore({
      storage: context.storage,
      locationDirectory: context.location?.directory,
      env: typeof process === 'undefined' ? undefined : process.env,
      session: {
        status: (sessionID) => context.data.session.status(sessionID),
        agent: (sessionID) => context.data.session.get(sessionID)?.agent ?? null,
      },
      subscribe: (type, handler) =>
        context.data.on(type, (event) => {
          const payload = toActivityPayload(event);
          if (payload) handler(payload);
        }),
    });

    const plans = () => {
      const state = store.state();
      if (state.plans !== undefined && state.plans.length > 0) return state.plans;
      return state.plan === null ? [] : [state.plan];
    };

    const removeSidebar = context.ui.slot({
      append: 'sidebar.content',
      render: ({ sessionID }) => (
        <SidebarPlan
          state={store.state}
          plans={plans}
          theme={context.theme}
          width={() => sidebarWidth(context.renderer.width)}
          sessionID={sessionID}
          onSession={store.trackSession}
          collapsed={() => store.ui().collapsedSlugs}
          onToggle={store.toggleCollapsed}
          onOpen={(plan) => {
            // Defer past the sidebar mouseup: the dialog backdrop also closes
            // on mouseup and would otherwise dismiss the modal immediately.
            queueMicrotask(() => {
              context.ui.dialog.show(
                () => (
                  <PlanFileModal
                    path={plan.absPath}
                    title={plan.title}
                    theme={context.theme}
                    renderer={context.renderer}
                    keymap={context.keymap}
                  />
                ),
                () => {}
              );
              context.ui.dialog.set({ size: 'xlarge' });
            });
          }}
        />
      ),
    });

    const removePanel = context.ui.slot({
      append: 'session.panel',
      render: (panel) => (
        <PlanPanel
          panel={panel}
          theme={context.theme}
          state={store.state}
          height={() => {
            // `PanelInput` publishes width only; the host owns the panel frame.
            const screen = context.renderer.height;
            return panel.presentation === 'fullscreen' ? screen : Math.max(10, Math.floor(screen * 0.7));
          }}
          cursor={() => store.ui().panelCursor}
          displayPath={() => {
            const plansDir = store.state().plansDir;
            return plansDir === null ? null : context.ui.format.path(plansDir);
          }}
          keymap={context.keymap}
          refresh={() => store.refresh('manual')}
          setCursor={store.setCursor}
          pin={store.pin}
          onSession={store.trackSession}
        />
      ),
    });

    // Global command layer: lives for the plugin's lifetime (a layer created in
    // setup has no per-layer disposer; the host drops it with the plugin).
    context.keymap.layer(() => ({
      commands: [
        {
          id: TUI_PLAN_COMMAND,
          title: 'Plan progress',
          description: 'Open the dev-harness plan progress panel',
          group: 'Plan progress',
          palette: true,
          slash: { name: 'plan-progress' },
          run: () => {
            context.ui.panel.open(TUI_PLAN_PANEL);
          },
        },
      ],
    }));

    return () => {
      removeSidebar();
      removePanel();
      store.dispose();
    };
  },
});
