/**
 * format.ts — small, renderer-free text helpers shared by the sidebar card and
 * the session panel (progress-contract §5.4, §11).
 *
 * Status is always conveyed by a symbol **and** a word so the UI stays readable
 * without color (R2). Everything here is pure and unit-testable.
 */
import type { PlanStatus } from '../plan-model.js';
import type { Activity } from '../plan-render-model.js';

const BAR_FILLED = '█';
const BAR_EMPTY = '░';
const ASCII_FILLED = '#';
const ASCII_EMPTY = '-';

/** Narrowest useful card/panel line; below this everything truncates to `…`. */
const MIN_WIDTH = 8;

/** Clamp a measured width to a positive, renderable integer. */
export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_WIDTH;
  return Math.max(MIN_WIDTH, Math.floor(width));
}

/** Collapse whitespace and cap to `width` columns with a trailing ellipsis. */
export function truncate(text: string, width: number): string {
  return clip(text.replace(/\s+/g, ' ').trim(), width);
}

/**
 * Clip an already-formatted line to `width` columns. Indentation is preserved
 * (panel body lines are indented), and no whitespace is collapsed.
 */
export function clip(text: string, width: number): string {
  const limit = Math.floor(width);
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  if (limit === 1) return '…';
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Text progress bar (§5.4): `filled = round(ratio * cells)`, `█`/`░` glyphs and
 * ASCII `#`/`-` when `ascii` is set (snapshots, low-color terminals).
 */
export function progressBar(ratio: number, cells: number, options: { ascii?: boolean } = {}): string {
  const total = Math.max(0, Math.floor(cells));
  const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const filled = Math.min(total, Math.round(safeRatio * total));
  const full = options.ascii ? ASCII_FILLED : BAR_FILLED;
  const empty = options.ascii ? ASCII_EMPTY : BAR_EMPTY;
  return `${full.repeat(filled)}${empty.repeat(total - filled)}`;
}

/** Symbol that always accompanies the status word (never color-only). */
export function statusSymbol(status: PlanStatus): string {
  if (status === 'Completed') return '✔';
  if (status === 'In Progress') return '▸';
  return '·';
}

/** Symbol for the session activity line. */
export function activitySymbol(activity: Activity): string {
  if (activity.status === 'running') return '▶';
  if (activity.status === 'retrying') return '↻';
  if (activity.status === 'idle') return '◦';
  return '·';
}

/** `[x]` / `[ ]`; `null` criteria are never presented as satisfied. */
export function checkboxGlyph(checked: boolean | null): string {
  return checked === true ? '[x]' : '[ ]';
}
