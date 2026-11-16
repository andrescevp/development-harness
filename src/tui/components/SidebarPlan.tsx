import type { ResolvedTheme } from '@opencode/theme/tui';
import { createEffect, For, Show } from 'solid-js';
import type { PlanProgress } from '../plan-model.js';
import type { PlanState } from '../plan-render-model.js';
import { reactiveText } from './reactive.js';
import { planCardLines, sidebarCard } from './sidebar-model.js';

export interface SidebarPlanProps {
  /** Live `PlanState` accessor: store reads stay reactive inside it. */
  state: () => PlanState;
  theme: ResolvedTheme;
  /** Measured card width; the sidebar slot publishes none (notes §5). */
  width: () => number;
  sessionID: string;
  /** Report the session the card is rendering for (activity seeding). */
  onSession: (sessionID: string) => void;
  /** Slugs whose section is collapsed. */
  collapsed: () => readonly string[];
  onToggle: (slug: string) => void;
  /** Open one plan file in the read-only plan-file page. */
  onOpen: (plan: PlanProgress) => void;
}

/**
 * Compact `sidebar.content` card (R2, 3.1) with one collapsible section per
 * executing plan and an `open` action per plan. Read-only.
 */
export function SidebarPlan(props: SidebarPlanProps) {
  createEffect(() => props.onSession(props.sessionID));

  const plans = (): PlanProgress[] => {
    const state = props.state();
    if (state.plans !== undefined && state.plans.length > 0) return state.plans;
    return state.plan === null ? [] : [state.plan];
  };
  const isCollapsed = (slug: string) => props.collapsed().includes(slug);
  const fallback = () => sidebarCard({ state: props.state(), width: props.width() });

  return (
    <box flexDirection="column">
      <Show
        when={plans().length > 0}
        fallback={
          <box flexDirection="column">
            <text fg={props.theme.text.base}>{reactiveText(() => fallback().heading)}</text>
            <text fg={props.theme.text.muted}>{reactiveText(() => fallback().lines.join('\n'))}</text>
          </box>
        }
      >
        <For each={plans()}>
          {(plan) => (
            <box flexDirection="column">
              <box flexDirection="row">
                {/* biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no button primitive; box mouse handler is the control. */}
                <box onMouseDown={() => props.onToggle(plan.slug)}>
                  <text fg={props.theme.text.base}>
                    {reactiveText(() => `${isCollapsed(plan.slug) ? '▸' : '▾'} ${plan.title}`)}
                  </text>
                </box>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no button primitive; box mouse handler is the control. */}
                <box onMouseDown={() => props.onOpen(plan)}>
                  <text fg={props.theme.text.muted}>{reactiveText(() => ' [open]')}</text>
                </box>
              </box>
              <Show when={!isCollapsed(plan.slug)}>
                <text fg={props.theme.text.muted}>
                  {reactiveText(() => planCardLines(plan, props.width()).join('\n'))}
                </text>
              </Show>
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}
