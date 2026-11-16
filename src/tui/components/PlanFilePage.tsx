import type { ResolvedTheme } from '@opencode/theme/tui';
import { createMemo } from 'solid-js';
import { PLAN_MAX_BYTES, readFileAt } from '../plan-read-files.js';
import { reactiveText } from './reactive.js';

export interface PlanFilePageProps {
  /** Absolute plan.md path supplied by the sidebar open action. */
  path: string | null;
  title: string;
  theme: ResolvedTheme;
}

/**
 * Read-only plugin page for one plan file. Opened from the sidebar "open"
 * button; reads once per path change and renders the file text, never writes.
 */
export function PlanFilePage(props: PlanFilePageProps) {
  const file = createMemo(() => {
    if (props.path === null) return null;
    return readFileAt(props.path, props.path, {
      maxBytes: PLAN_MAX_BYTES,
      severity: 'error',
      issues: [],
    });
  });

  return (
    <box flexDirection="column" flexGrow={1}>
      <text fg={props.theme.text.base}>{reactiveText(() => `${props.title} — ${props.path ?? 'no path'}`)}</text>
      <text fg={props.theme.text.muted}>
        {reactiveText(() => {
          const source = file();
          if (source === null) return 'Plan file is unavailable or unreadable.';
          const lines = source.contents.replace(/\r\n/g, '\n').split('\n');
          return lines.slice(0, 2000).join('\n');
        })}
      </text>
    </box>
  );
}
