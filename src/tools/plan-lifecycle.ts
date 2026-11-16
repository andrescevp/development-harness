/**
 * plan-lifecycle.ts — pure helpers for the phased plan lifecycle (M2).
 *
 * Consumes the authoritative format contract from
 * skills/dh-planning/references/phased-plan-template.md:
 *   - `## Phases` → `### Phase N: <title>` (+ `- **Status:**`)
 *     → `#### Sub-Task N.M: <title>` (+ fields + `- **Status:**`)
 *   - status lines are the first `- **Status:**` bullet in their section
 *     (metadata bullets may precede it; keep it near the header for
 *     readability — a later duplicate is not authoritative).
 *   - only the `## Phases` region is parsed and fenced examples are ignored
 *     (plan-sections.ts); parallel metadata lives in plan-metadata.ts.
 *
 * Node built-ins only (no framework): string/line edits, so the helpers are
 * unit-testable and the tools stay thin; plan-file I/O lives in plan-io.ts.
 * CRLF-tolerant: all markers accept an optional trailing `\r` and edits
 * preserve the original line ending.
 */
import { parse } from 'yaml';
import { splitFrontmatter } from '../lib/frontmatter.js';
import { type PhaseMetadata, readPhaseMetadata, readSubTaskMetadata, type SubTaskMetadata } from './plan-metadata.js';
import { planLayout } from './plan-sections.js';
import { type PlanScaffoldInput, planScaffold } from './plan-template.js';

/** Canonical status/target domains shared by parser, editors, and adapters. */
export const PHASE_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];
export const STATUS_TARGETS = ['phase', 'subtask'] as const;
export type StatusTarget = (typeof STATUS_TARGETS)[number];

interface PlanSubTask extends SubTaskMetadata {
  /** Canonical "N.M" ref (phase.subtask). */
  index: string;
  phase: number;
  number: number;
  title: string;
  status: PhaseStatus;
  relatedRequirements: string[];
  /** Agent named by `- **Delegated to agent:**`; null on legacy plans. */
  delegatedTo: string | null;
}

interface PlanPhase extends PhaseMetadata {
  /** 1-based phase number. */
  index: number;
  title: string;
  status: PhaseStatus;
  subTasks: PlanSubTask[];
}

export interface PlanDocument {
  meta: Record<string, unknown>;
  title?: string;
  phases: PlanPhase[];
}

/** Matches bullets with an optional trailing CR. */
const RELATED_RE = /^-\s+\*\*Related Requirements:\*\*\s+(.+?)\r?$/;
const DELEGATED_RE = /^-\s+\*\*Delegated to agent:\*\*\s+(.+?)\r?$/;
const DELEGATED_EMPTY_RE = /^-\s+\*\*Delegated to agent:\*\*\s*\r?$/;

/** Return (value, hadCr) for a status line; throws on unknown statuses. */
function readStatusRaw(lines: readonly string[], line: number): { raw: string; cr: boolean } {
  const l = lines[line] ?? '';
  const m = l.match(/^-\s+\*\*Status:\*\*\s+(.+?)(\r?)$/);
  if (!m) throw new Error(`plan line ${line + 1}: no status marker`);
  return { raw: m[1]!.trim(), cr: m[2] === '\r' };
}

function statusOf(lines: readonly string[], line: number, file = '<plan>'): PhaseStatus {
  const { raw } = readStatusRaw(lines, line);
  if (!(PHASE_STATUSES as readonly string[]).includes(raw)) {
    throw new Error(`${file}: invalid status '${raw}' at line ${line + 1} (expected ${PHASE_STATUSES.join(' | ')})`);
  }
  return raw as PhaseStatus;
}

/** Plan frontmatter: missing header → {}; unterminated/malformed → throw. */
function parseMeta(contents: string): Record<string, unknown> {
  const split = splitFrontmatter(contents);
  if (split === null) return {};
  if ('error' in split) throw new Error(`plan frontmatter: ${split.error}`);
  const data = parse(split.fm);
  if (data === null || data === undefined) return {};
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('plan frontmatter must be a YAML mapping');
  return data as Record<string, unknown>;
}

/** Parse a phased plan document into structured phases + sub-tasks. */
export function parsePlan(contents: string, file = '<plan>'): PlanDocument {
  const meta = parseMeta(contents);
  const layout = planLayout(contents);
  const fenceNote =
    layout.unterminatedFence === null ? '' : ` (unterminated code fence at line ${layout.unterminatedFence + 1})`;
  if (!layout.region) throw new Error(`not a phased plan: missing \`## Phases\` section${fenceNote}`);
  if (!layout.sections.some((section) => section.kind === 'phase')) {
    throw new Error(`not a phased plan: no \`### Phase N:\` headers found${fenceNote}`);
  }
  const phases: PlanPhase[] = [];

  for (const section of layout.sections) {
    if (section.kind !== 'phase') continue;
    phases.push({
      index: section.phase,
      title: section.title,
      status: statusOf(layout.lines, section.statusLine ?? section.headerLine, file),
      ...readPhaseMetadata(
        layout.lines,
        section.headerLine + 1,
        section.endLine,
        phaseWhere(file, section.ref),
        layout.fenced
      ),
      subTasks: [],
    });
  }

  for (const section of layout.sections) {
    if (section.kind !== 'subtask') continue;
    const related: string[] = [];
    let delegatedTo: string | null = null;
    let relatedFound = false;
    for (let i = section.headerLine + 1; i <= section.endLine; i++) {
      if (layout.fenced[i]) continue;
      const line = layout.lines[i] ?? '';
      if (delegatedTo === null) {
        const d = line.match(DELEGATED_RE);
        if (d) {
          delegatedTo = d[1]!.trim();
          continue;
        }
        if (DELEGATED_EMPTY_RE.test(line)) {
          throw new Error(`${file}: sub-task ${section.ref} has an empty Delegated to agent marker`);
        }
      }
      if (!relatedFound) {
        const r = line.match(RELATED_RE);
        if (r) {
          related.push(
            ...r[1]!
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          );
          relatedFound = true;
        }
      }
    }
    const phase = phases.find((candidate) => candidate.index === section.phase);
    if (!phase) throw new Error(`${file}: orphan sub-task ${section.ref} (no phase ${section.phase})`);
    phase.subTasks.push({
      index: section.ref,
      phase: section.phase,
      number: section.number!,
      title: section.title,
      status: statusOf(layout.lines, section.statusLine ?? section.headerLine, file),
      relatedRequirements: related,
      delegatedTo,
      ...readSubTaskMetadata(
        layout.lines,
        section.headerLine + 1,
        section.endLine,
        subTaskWhere(file, section.ref),
        layout.fenced
      ),
    });
  }

  const title = meta.title !== undefined ? String(meta.title) : undefined;
  return { meta, title, phases };
}

function phaseWhere(file: string, ref: string): string {
  return `${file}: phase ${ref}`;
}

function subTaskWhere(file: string, ref: string): string {
  return `${file}: sub-task ${ref}`;
}

/**
 * Line-aware status edit: locate the section by ref ("N" for phase, "N.M" for
 * sub-task), replace ONLY the first `- **Status:**` line inside it (preserving
 * CRLF), and re-parse. Throws on unknown refs, missing/invalid markers, and
 * the minimal transition violation (phase → Completed with open sub-tasks).
 */
export function setStatus(
  contents: string,
  target: StatusTarget,
  ref: string,
  status: PhaseStatus
): { contents: string; plan: PlanDocument } {
  if (!(PHASE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`invalid status '${status}' (expected ${PHASE_STATUSES.join(' | ')})`);
  }
  const layout = planLayout(contents);
  const section = layout.sections.find((candidate) => candidate.kind === target && candidate.ref === ref);
  if (!section) throw new Error(`${target} ref '${ref}' not found`);

  if (target === 'phase' && status === 'Completed') {
    for (const sub of parsePlan(contents).phases.find((p) => p.index === Number(ref))?.subTasks ?? []) {
      if (sub.status !== 'Completed')
        throw new Error(`phase ${ref} cannot complete: sub-task ${sub.index} is ${sub.status}`);
    }
  }

  for (let i = section.headerLine + 1; i <= section.endLine; i++) {
    if (layout.fenced[i]) continue;
    const m = layout.lines[i]?.match(/^(-\s+\*\*Status:\*\*\s+).+?(\r?)$/);
    if (m) {
      layout.lines[i] = `${m[1]}${status}${m[2]}`;
      const updated = layout.lines.join('\n');
      return { contents: updated, plan: parsePlan(updated) };
    }
  }
  throw new Error(`${target} '${ref}' has no status marker`);
}

/** Scaffold input — optional metadata renders as the documented defaults. */
export type PlanScaffold = PlanScaffoldInput;

/** Build the phased plan markdown from a scaffold (all statuses Pending). */
export function buildPlanTemplate(input: PlanScaffold): string {
  return planScaffold(input);
}
