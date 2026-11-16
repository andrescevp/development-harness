import type { Keymap } from '@opencode/plugin/tui/context';
import type { ResolvedTheme } from '@opencode/theme/tui';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/solid';
import { createMemo } from 'solid-js';
import { PLAN_MAX_BYTES, readFileAt } from '../plan-read-files.js';
import { reactiveText } from './reactive.js';

export interface PlanFileModalProps {
  /** Absolute plan.md path; null renders the unavailable state. */
  path: string | null;
  title: string;
  theme: ResolvedTheme;
  /** Host keymap: adds modal scroll keys while this component is mounted. */
  keymap: Keymap;
}

/**
 * Read-only plan-file modal opened from a sidebar `[open]` action.
 *
 * The host dialog owns the overlay, Escape handling, and dismissal; this
 * component renders the file in a focused scrollbox. Reads once per path
 * change, never during a slot render.
 */
export function PlanFileModal(props: PlanFileModalProps) {
  const dimensions = useTerminalDimensions();
  let scroll: ScrollBoxRenderable | undefined;
  const height = () => Math.max(8, dimensions().height - 12);

  const contents = createMemo(() => {
    if (props.path === null) return 'Plan file is unavailable.';
    const source = readFileAt(props.path, props.path, {
      maxBytes: PLAN_MAX_BYTES,
      severity: 'error',
      issues: [],
    });
    if (source === null) return 'Plan file is unavailable or unreadable.';
    return source.contents.replace(/\r\n/g, '\n');
  });

  props.keymap.layer(() => ({
    mode: 'modal',
    commands: [
      { bind: 'up', title: 'Scroll plan up', run: () => scroll?.scrollBy(-1) },
      { bind: 'down', title: 'Scroll plan down', run: () => scroll?.scrollBy(1) },
      { bind: 'pageup', title: 'Scroll plan up one page', run: () => scroll?.scrollBy(-height()) },
      { bind: 'pagedown', title: 'Scroll plan down one page', run: () => scroll?.scrollBy(height()) },
      { bind: 'home', title: 'Jump to plan start', run: () => scroll?.scrollTo(0) },
      { bind: 'end', title: 'Jump to plan end', run: () => scroll?.scrollTo(Infinity) },
    ],
  }));

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <text fg={props.theme.text.base}>{reactiveText(() => props.title)}</text>
      <text fg={props.theme.text.faint}>{reactiveText(() => props.path ?? 'no path')}</text>
      <scrollbox
        ref={(value: ScrollBoxRenderable) => {
          scroll = value;
        }}
        height={height()}
        focused
        scrollbarOptions={{ visible: true }}
      >
        <text fg={props.theme.text.muted}>{reactiveText(() => contents())}</text>
      </scrollbox>
      <text fg={props.theme.text.faint}>↑/↓ scroll · PgUp/PgDn · esc close</text>
    </box>
  );
}
