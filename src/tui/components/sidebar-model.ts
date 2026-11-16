/**
 * sidebar-model.ts — pure view model for the always-visible `sidebar.content`
 * card (progress-contract §11 card column, §5.4 bar, §8.4 summary).
 *
 * The card is deliberately small: a heading plus at most six short lines,
 * each truncated to the measured width. No Solid, no renderer, no I/O.
 */
import type { PlanProgress } from '../plan-model.js';
import type { PlanState, PlanStateReason } from '../plan-render-model.js';
import { activitySymbol, clampWidth, progressBar, statusSymbol, truncate } from './format.js';

export interface SidebarCard {
  heading: string;
  lines: string[];
}

export interface SidebarCardInput {
  state: PlanState;
  /** Columns available to the card; defaults to a compact 32. */
  width?: number;
  /** ASCII bar glyphs for snapshots/low-color terminals. */
  ascii?: boolean;
}

const DEFAULT_WIDTH = 32;
const MAX_WIDTH = 38;
const MIN_WIDTH = 20;
const SLUG_MIN_WIDTH = 24;
const WIDE_MIN_WIDTH = 30;
const NARROW_BAR_CELLS = 4;
const WIDE_BAR_CELLS = 10;

/**
 * Approximate the sidebar column from the terminal width. `sidebar.content`
 * publishes no width (notes §5), so the card derives a bounded, compact width
 * from `context.renderer.width` and clips its own text.
 */
export function sidebarWidth(terminalWidth: number): number {
  if (!Number.isFinite(terminalWidth)) return DEFAULT_WIDTH;
  const third = Math.round(Math.max(0, terminalWidth) / 3);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, third));
}

function phaseTotals(plan: PlanProgress): {
  phase: number;
  phaseTotal: number;
  subTask: number | null;
  subTaskTotal: number;
} {
  const ordinal = plan.current.ordinal;
  const phase = plan.current.phase?.index ?? ordinal?.phase ?? 0;
  const started = plan.phases.find((entry) => entry.index === phase);
  return {
    phase,
    phaseTotal: plan.counts.phases.total,
    subTask: ordinal?.subTask ?? null,
    subTaskTotal: started?.counts.total ?? 0,
  };
}

function positionLine(plan: PlanProgress, wide: boolean): string {
  const totals = phaseTotals(plan);
  if (plan.current.phase === null) return 'Completed';
  const reference = plan.current.position ?? totals.subTask;
  if (reference === null || reference === undefined) return `Phase ${totals.phase}/${totals.phaseTotal}`;
  const label = wide ? `Sub-Task ${reference}` : `${reference}`;
  return `Phase ${totals.phase}/${totals.phaseTotal} · ${label}/${totals.subTaskTotal}`;
}

function statusLine(state: PlanState, plan: PlanProgress): string {
  const suffix = hintFor(state.reason);
  if (plan.current.source === 'done') return `✔ Completed${suffix}`;
  // "Next" marks not-yet-started work; it is never labelled as active (§5.3).
  if (plan.current.source === 'next-pending') return `Next · ${plan.status}${suffix}`;
  return `${statusSymbol(plan.status)} ${plan.status}${suffix}`;
}

/** Small provenance hint for S4 (index fallback) and pinned selection. */
function hintFor(reason: PlanStateReason): string {
  if (reason === 'index') return ' · index';
  if (reason === 'pinned') return ' · pinned';
  return '';
}

function firstIssueCode(state: PlanState): string {
  const issue = state.errors[0];
  return issue ? issue.code : 'plan-error';
}

function readyCard(state: PlanState, plan: PlanProgress, width: number, ascii: boolean): SidebarCard {
  const wide = width >= WIDE_MIN_WIDTH;
  const lines: string[] = [];
  if (width >= SLUG_MIN_WIDTH) lines.push(truncate(`docs/plans/${plan.slug}`, width));
  lines.push(truncate(positionLine(plan, wide), width));
  lines.push(truncate(statusLine(state, plan), width));
  const bar = progressBar(plan.progress.ratio, wide ? WIDE_BAR_CELLS : NARROW_BAR_CELLS, { ascii });
  const count = `${plan.counts.subTasks.completed}/${plan.counts.subTasks.total}`;
  lines.push(truncate(`[${bar}] ${count}${wide ? ' sub-tasks' : ''}`, width));
  if (plan.activeSubTasks.length > 1) {
    lines.push(truncate(`Active: ${plan.activeSubTasks.length} tasks`, width));
  }
  lines.push(truncate(`Agent: ${plan.current.subTask?.delegatedTo ?? '—'}`, width));
  const stale = state.activity.stale ? ' (stale)' : '';
  lines.push(truncate(`${activitySymbol(state.activity)} ${state.activity.summary}${stale}`, width));
  return { heading: truncate(plan.title, width), lines };
}

function selectorCard(state: PlanState, width: number): SidebarCard {
  const selection = state.selection;
  const suggested = selection.candidates.find((candidate) => candidate.slug === selection.suggestedSlug);
  const suggestedLabel = suggested?.title ?? selection.suggestedSlug ?? '—';
  return {
    heading: 'Plan progress',
    lines: [
      truncate(`${selection.candidates.length} active plans`, width),
      truncate(`Suggested: ${suggestedLabel}`, width),
      truncate('open /plan-progress', width),
    ],
  };
}

function emptyCard(state: PlanState, width: number): SidebarCard {
  const lines: string[] = [];
  switch (state.reason) {
    case 'no-plans-dir':
      lines.push('No docs/plans here', 'start opencode at the workspace root');
      break;
    case 'no-workspace':
      lines.push('No local workspace');
      break;
    default:
      lines.push('No active plan', 'docs/plans');
  }
  return { heading: 'Plan progress', lines: lines.map((line) => truncate(line, width)) };
}

function errorCard(state: PlanState, width: number): SidebarCard {
  if (state.reason === 'scan-error') {
    return {
      heading: 'Plan progress',
      lines: [truncate('⚠ Plans unavailable', width), truncate(firstIssueCode(state), width)],
    };
  }
  const slug = state.selection.pinnedSlug ?? state.selection.selectedSlug ?? 'plan';
  return {
    heading: 'Plan progress',
    lines: [truncate(`⚠ Plan unreadable: ${slug}`, width), truncate(firstIssueCode(state), width)],
  };
}

/** Build the compact card for any `PlanState` (§11 S1–S8). */
export function sidebarCard(input: SidebarCardInput): SidebarCard {
  const width = clampWidth(input.width ?? DEFAULT_WIDTH);
  const ascii = input.ascii ?? false;
  const state = input.state;
  if (state.status === 'loading') {
    return { heading: 'Plan progress', lines: [truncate('Plans: loading…', width)] };
  }
  if (state.status === 'ready' && state.plan) return readyCard(state, state.plan, width, ascii);
  if (state.status === 'selector') return selectorCard(state, width);
  if (state.status === 'error') return errorCard(state, width);
  return emptyCard(state, width);
}
