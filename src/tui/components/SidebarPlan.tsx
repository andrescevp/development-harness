import type { ResolvedTheme } from '@opencode/theme/tui';
import { createComponent, createEffect, For } from 'solid-js';
import type { PlanProgress } from '../plan-model.js';
import type { PlanState } from '../plan-render-model.js';
import { reactiveShow, reactiveText } from './reactive.js';
import { planCardLines, sidebarCard } from './sidebar-model.js';

export interface SidebarPlanProps {
  /** Live `PlanState` accessor: store reads stay reactive inside it. */
  state: () => PlanState;
  /** Executing plans, derived from the live state by the caller. */
  plans: () => PlanProgress[];
  theme: ResolvedTheme;
  /** Measured card width; the sidebar slot publishes none (notes §5). */
  width: () => number;
  sessionID: string;
  /** Report the session the card is rendering for (activity seeding). */
  onSession: (sessionID: string) => void;
  /** Slugs whose section is collapsed. */
  collapsed: () => readonly string[];
  onToggle: (slug: string) => void;
  /** Open one plan file in the read-only modal. */
  onOpen: (plan: PlanProgress) => void;
}

/**
 * Compact `sidebar.content` card (R2, 3.1) with one collapsible section per
 * executing plan and an `open` action per plan. Read-only.
 *
 * Conditions and list sources are passed as getters to `Show`/`For` so the
 * card reacts to store changes; this transform does not wrap JSX prop
 * expressions on its own.
 */
export function SidebarPlan(props: SidebarPlanProps) {
  createEffect(() => props.onSession(props.sessionID));

  const fallback = () => sidebarCard({ state: props.state(), width: props.width() });

  const rows = () =>
    createComponent(For, {
      get each() {
        return props.plans();
      },
      children: (plan: PlanProgress) => (
        <box flexDirection="column">
          <box flexDirection="row">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no button primitive; box mouse handler is the control. */}
            <box onMouseUp={() => props.onToggle(plan.slug)}>
              <text fg={props.theme.text.base}>
                {reactiveText(() => `${props.collapsed().includes(plan.slug) ? '▸' : '▾'} ${plan.title}`)}
              </text>
            </box>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no button primitive; box mouse handler is the control. */}
            <box onMouseUp={() => props.onOpen(plan)}>
              <text fg={props.theme.text.muted}>{reactiveText(() => ' [open]')}</text>
            </box>
          </box>
          {reactiveShow({
            when: () => !props.collapsed().includes(plan.slug),
            children: (
              <text fg={props.theme.text.muted}>
                {reactiveText(() => planCardLines(plan, props.width()).join('\n'))}
              </text>
            ),
          })}
        </box>
      ),
    });

  return (
    <box flexDirection="column">
      {reactiveShow({
        when: () => props.plans().length > 0,
        fallback: (
          <box flexDirection="column">
            <text fg={props.theme.text.base}>{reactiveText(() => fallback().heading)}</text>
            <text fg={props.theme.text.muted}>{reactiveText(() => fallback().lines.join('\n'))}</text>
          </box>
        ),
        children: rows(),
      })}
    </box>
  );
}
