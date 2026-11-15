import type { ResolvedTheme } from '@opencode/theme/tui';
import { createEffect } from 'solid-js';
import type { PlanState } from '../plan-render-model.js';
import { reactiveText } from './reactive.js';
import { sidebarCard } from './sidebar-model.js';

export interface SidebarPlanProps {
  /** Live `PlanState` accessor: store reads stay reactive inside it. */
  state: () => PlanState;
  theme: ResolvedTheme;
  /** Measured card width; the sidebar slot publishes none (notes §5). */
  width: () => number;
  sessionID: string;
  /** Report the session the card is rendering for (activity seeding). */
  onSession: (sessionID: string) => void;
}

/**
 * Compact `sidebar.content` card (R2, 3.1). Read-only: it renders the derived
 * model and never touches plan files. Every line is pre-truncated by the view
 * model, so narrow sidebars stay readable.
 */
export function SidebarPlan(props: SidebarPlanProps) {
  createEffect(() => props.onSession(props.sessionID));

  const card = () => sidebarCard({ state: props.state(), width: props.width() });

  return (
    <box flexDirection="column">
      <text fg={props.theme.text.base}>{reactiveText(() => card().heading)}</text>
      <text fg={props.theme.text.muted}>{reactiveText(() => card().lines.join('\n'))}</text>
    </box>
  );
}
