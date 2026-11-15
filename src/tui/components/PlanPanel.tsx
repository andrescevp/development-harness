import type { Keymap, PanelInput } from '@opencode/plugin/tui/context';
import type { ResolvedTheme } from '@opencode/theme/tui';
import { createEffect } from 'solid-js';
import type { PlanState } from '../plan-render-model.js';
import { TUI_PLAN_PANEL, TUI_PLUGIN_ID } from '../plugin-id.js';
import { panelModel } from './panel-model.js';
import { reactiveText } from './reactive.js';

export interface PlanPanelProps {
  panel: PanelInput;
  theme: ResolvedTheme;
  /** Live `PlanState` accessor: store reads stay reactive inside it. */
  state: () => PlanState;
  /** `context.renderer.height` accessor: `PanelInput` publishes width only. */
  height: () => number;
  /** UI-store scroll cursor accessor. */
  cursor: () => number;
  /** `ui.format.path(plansDir)` accessor for the empty-state copy. */
  displayPath: () => string | null;
  keymap: Keymap;
  refresh: () => void;
  setCursor: (cursor: number) => void;
  pin: (slug: string | null) => void;
  onSession: (sessionID: string) => void;
}

const PIN_LIMIT = 9;
const SCROLL_STEP = 10;

/**
 * Full `session.panel` view for `/plan-progress` (R3, 3.2).
 *
 * Read-only: phases, sub-tasks, criteria, checklists, review, fast ledger and
 * the last update. The keyboard layer (`r`/`f`/`escape`, scrolling and 1-9
 * pinning) is owned by this component and inert unless the panel is both
 * focused and showing this contribution (notes §7).
 */
export function PlanPanel(props: PlanPanelProps) {
  createEffect(() => props.onSession(props.panel.sessionID));

  const active = () => props.panel.focused && props.panel.name === TUI_PLAN_PANEL;
  const model = () =>
    panelModel({
      state: props.state(),
      width: props.panel.width,
      height: props.height(),
      cursor: props.cursor(),
      displayPath: props.displayPath(),
    });

  const move = (delta: number) => {
    const current = model();
    const page = Math.max(1, current.body.length - 1);
    const step = Math.abs(delta) > 1 ? page : 1;
    const next = current.offset + Math.sign(delta) * step;
    props.setCursor(Math.min(current.maxCursor, Math.max(0, next)));
  };

  props.keymap.layer(() => ({
    enabled: active,
    commands: [
      {
        id: `${TUI_PLUGIN_ID}.plan.refresh`,
        title: 'Refresh plan progress',
        group: 'Plan progress',
        bind: 'r',
        run: () => props.refresh(),
      },
      {
        id: `${TUI_PLUGIN_ID}.plan.fullscreen`,
        title: 'Toggle plan progress fullscreen',
        group: 'Plan progress',
        bind: 'f',
        run: () => props.panel.toggleFullscreen(),
      },
      {
        id: `${TUI_PLUGIN_ID}.plan.close`,
        title: 'Close plan progress',
        group: 'Plan progress',
        bind: 'escape',
        run: () => props.panel.close(),
      },
      {
        id: `${TUI_PLUGIN_ID}.plan.scroll-up`,
        title: 'Scroll plan progress up',
        group: 'Plan progress',
        bind: 'up',
        run: () => move(-1),
      },
      {
        id: `${TUI_PLUGIN_ID}.plan.scroll-down`,
        title: 'Scroll plan progress down',
        group: 'Plan progress',
        bind: 'down',
        run: () => move(1),
      },
      {
        id: `${TUI_PLUGIN_ID}.plan.page-up`,
        title: 'Page plan progress up',
        group: 'Plan progress',
        bind: 'pageup',
        run: () => move(-SCROLL_STEP),
      },
      {
        id: `${TUI_PLUGIN_ID}.plan.page-down`,
        title: 'Page plan progress down',
        group: 'Plan progress',
        bind: 'pagedown',
        run: () => move(SCROLL_STEP),
      },
      ...props
        .state()
        .selection.candidates.slice(0, PIN_LIMIT)
        .map((candidate, index) => ({
          id: `${TUI_PLUGIN_ID}.plan.pin-${index + 1}`,
          title: `Pin plan ${candidate.slug}`,
          group: 'Plan progress',
          bind: String(index + 1),
          enabled: () => props.state().status === 'selector',
          run: () => props.pin(candidate.slug),
        })),
    ],
  }));

  if (props.panel.name !== TUI_PLAN_PANEL) return <box height={0} />;

  return (
    <box flexDirection="column" flexGrow={1}>
      <text fg={props.theme.text.base}>{reactiveText(() => model().heading)}</text>
      <text fg={props.theme.text.muted}>{reactiveText(() => model().header.join('\n'))}</text>
      <text fg={props.theme.text.muted}>{reactiveText(() => model().body.join('\n'))}</text>
      <text fg={props.theme.text.muted}>{reactiveText(() => model().footer)}</text>
    </box>
  );
}
