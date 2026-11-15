/**
 * panel-model.ts — pure view model for the `session.panel` contribution
 * (progress-contract §11 panel column, §16 windowed scrolling).
 *
 * The host owns the panel frame and input scope; this model only produces the
 * heading, fixed header lines, a windowed body slice and the keyboard legend.
 * It never reads files: the `PlanState` snapshot is the single input.
 */
import type { PlanState } from '../plan-render-model.js';
import { clampWidth, clip, progressBar, truncate } from './format.js';
import { planBody } from './panel-sections.js';

export interface PanelModelInput {
  state: PlanState;
  width: number;
  height: number;
  /** Requested top body line (UI store `panelCursor`). */
  cursor?: number;
  /** `ui.format.path(plansDir)`; absolute paths are never rendered directly. */
  displayPath?: string | null;
  ascii?: boolean;
}

export interface PanelModel {
  heading: string;
  header: string[];
  /** Windowed body slice; join with newlines. */
  body: string[];
  footer: string;
  /** Body line count before windowing. */
  total: number;
  offset: number;
  maxCursor: number;
  scrollable: boolean;
  selectable: boolean;
}

/** Base keyboard legend; scroll/pin hints are appended only when usable. */
export const PANEL_FOOTER = '[r] refresh · [f] fullscreen · [esc] close';

const READY_BAR_CELLS = 10;
const MIN_VIEWPORT = 3;
const CHROME_LINES = 2;

function barFor(state: PlanState, ascii: boolean): string {
  const plan = state.plan;
  if (!plan) return progressBar(0, READY_BAR_CELLS, { ascii });
  return progressBar(plan.progress.ratio, READY_BAR_CELLS, { ascii });
}

function readyHeader(state: PlanState, width: number, ascii: boolean): string[] {
  const plan = state.plan;
  if (!plan) return [];
  const counts = plan.counts.subTasks;
  return [
    truncate(`${plan.path} · ${plan.status} · ${plan.progress.percent}%`, width),
    truncate(
      `[${barFor(state, ascii)}] ${counts.completed}/${counts.total} sub-tasks · ${plan.counts.phases.completed}/${plan.counts.phases.total} phases`,
      width
    ),
    truncate(`Updated ${plan.updatedAt} · ${plan.updatedSource}`, width),
  ];
}

function selectorRows(state: PlanState, width: number): string[] {
  const selection = state.selection;
  return selection.candidates.map((candidate, index) => {
    const suggested = candidate.slug === selection.suggestedSlug ? ' (suggested)' : '';
    const invalid = candidate.valid ? '' : ` · invalid: ${candidate.issue?.code ?? 'unknown'}`;
    const row = `${index + 1}. ${candidate.slug} · ${candidate.status} · ${candidate.updatedAt}${invalid}${suggested}`;
    return truncate(row, width);
  });
}

function issueRows(issues: PlanState['errors'], width: number): string[] {
  return issues.map((issue) => {
    const file = issue.file ? ` ${issue.file}` : '';
    return clip(`  ${issue.severity === 'error' ? '✖' : '⚠'} ${issue.code}${file}: ${issue.message}`, width);
  });
}

function emptyCopy(
  state: PlanState,
  displayPath: string,
  width: number
): { heading: string; header: string[]; body: string[] } {
  if (state.reason === 'no-plans-dir') {
    return {
      heading: 'Plan progress',
      header: [truncate(`No docs/plans at ${displayPath}`, width)],
      body: [truncate('Start opencode at the workspace root so plan files resolve.', width)],
    };
  }
  if (state.reason === 'no-workspace') {
    return {
      heading: 'Plan progress',
      header: [truncate('No local workspace', width)],
      body: [truncate('Remote workspaces are not supported in v1.', width)],
    };
  }
  return {
    heading: 'Plan progress',
    header: [truncate('No active plan', width)],
    body: [
      truncate(`A plan in ${displayPath} must declare \`active: true\` (or the index row \`Active = Yes\`).`, width),
      truncate('The TUI is read-only: set the status with the harness skills.', width),
    ],
  };
}

function errorCopy(state: PlanState, width: number): { heading: string; header: string[]; body: string[] } {
  if (state.reason === 'scan-error') {
    return {
      heading: 'Plan progress',
      header: [truncate('⚠ Plans unavailable', width)],
      body: issueRows(state.errors, width),
    };
  }
  const slug = state.selection.pinnedSlug ?? state.selection.selectedSlug ?? 'plan';
  const others = state.selection.candidates.filter((candidate) => candidate.slug !== slug);
  const body = [...issueRows(state.errors, width)];
  if (others.length > 0) {
    body.push(clip('Other selectable plans:', width));
    for (const candidate of others) body.push(clip(`  ${candidate.slug} · ${candidate.status}`, width));
  }
  return { heading: 'Plan progress', header: [truncate(`⚠ Plan unreadable: ${slug}`, width)], body };
}

function footerFor(scrollable: boolean, selectable: boolean): string {
  const scroll = scrollable ? ' · [↑↓] scroll' : '';
  const pin = selectable ? ' · [1-9] pin' : '';
  return `${PANEL_FOOTER}${scroll}${pin}`;
}

/**
 * Build the panel snapshot (§11). `cursor` is clamped so a shrinking document
 * never leaves the viewport past the end.
 */
export function panelModel(input: PanelModelInput): PanelModel {
  const width = clampWidth(input.width);
  const height = Math.max(MIN_VIEWPORT, Math.floor(input.height));
  const displayPath = input.displayPath ?? 'docs/plans';
  const ascii = input.ascii ?? false;
  const state = input.state;

  let heading = 'Plan progress';
  let header: string[] = [];
  let all: string[] = [];
  let selectable = false;

  if (state.status === 'ready' && state.plan) {
    heading = truncate(state.plan.title, width);
    header = readyHeader(state, width, ascii);
    all = planBody(state.plan, width);
  } else if (state.status === 'loading') {
    header = [truncate('Loading plan progress…', width)];
  } else if (state.status === 'selector') {
    selectable = true;
    header = [truncate(`${state.selection.candidates.length} active plans — choose one`, width)];
    all = selectorRows(state, width);
    all.push(truncate('Press 1-9 to pin a plan; the sidebar follows the selection.', width));
  } else if (state.status === 'error') {
    const copy = errorCopy(state, width);
    heading = copy.heading;
    header = copy.header;
    all = copy.body;
  } else {
    const copy = emptyCopy(state, displayPath, width);
    heading = copy.heading;
    header = copy.header;
    all = copy.body;
  }

  const viewport = Math.max(MIN_VIEWPORT, height - header.length - CHROME_LINES);
  const maxCursor = Math.max(0, all.length - viewport);
  const offset = Math.min(Math.max(0, Math.floor(input.cursor ?? 0)), maxCursor);
  const scrollable = maxCursor > 0;
  return {
    heading,
    header,
    body: all.slice(offset, offset + viewport),
    footer: footerFor(scrollable, selectable),
    total: all.length,
    offset,
    maxCursor,
    scrollable,
    selectable,
  };
}
