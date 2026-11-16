/**
 * plan-sections.ts — locate the `## Phases` region and its sections.
 *
 * Format contract: phases live under `## Phases`, and the region ends at the
 * next top-level `##` heading or EOF. Fenced code blocks (``` / ~~~) are
 * ignored everywhere, so format examples in `## Core concepts` — or inside the
 * region — never become phantom phases or status markers.
 * Split from plan-lifecycle.ts to keep files under the 300-line rule.
 */

interface PlanSection {
  kind: 'phase' | 'subtask';
  /** "N" for phases, "N.M" for sub-tasks. */
  ref: string;
  /** Phase number (phases) or parent phase number (sub-tasks). */
  phase: number;
  /** 1-based sub-task number; undefined for phases. */
  number?: number;
  title: string;
  /** 0-based header line. */
  headerLine: number;
  /** 0-based first `- **Status:**` line; undefined when absent. */
  statusLine: number | undefined;
  /** 0-based last line of the section (inclusive). */
  endLine: number;
}

export interface PlanLayout {
  lines: string[];
  /** Lines that belong to a fenced code block (delimiters included). */
  fenced: boolean[];
  /** `## Phases` heading line and exclusive end; null when the heading is absent. */
  region: { start: number; end: number } | null;
  sections: PlanSection[];
}

const PHASE = /^###\s+Phase\s+(\d+):\s+(.+?)\r?$/;
const SUBTASK = /^####\s+Sub-Task\s+(\d+)\.(\d+):\s+(.+?)\r?$/;
const STATUS = /^-\s+\*\*Status:\*\*\s+(.+?)\r?$/;
const H2 = /^##\s+/;
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

/**
 * Mark every line that belongs to a fenced block: the opening/closing
 * delimiters must use the same character, and a closing fence must be at
 * least as long as the opener with nothing but whitespace after it.
 */
function fencedLines(lines: readonly string[]): boolean[] {
  const fenced = new Array<boolean>(lines.length).fill(false);
  let open: { char: string; length: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const match = (lines[i] ?? '').match(FENCE);
    if (open === null) {
      if (!match) continue;
      const marker = match[1]!;
      // A backtick opener with a backtick in its info string is inline code.
      if (marker[0] === '`' && match[2]!.includes('`')) continue;
      open = { char: marker[0]!, length: marker.length };
      fenced[i] = true;
    } else {
      fenced[i] = true;
      if (match && match[1]![0] === open.char && match[1]!.length >= open.length && match[2]!.trim() === '') {
        open = null;
      }
    }
  }
  return fenced;
}

/** `## Phases` heading → next top-level `##` (exclusive) or EOF. */
function phasesRegion(lines: readonly string[], fenced: readonly boolean[]): { start: number; end: number } | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!fenced[i] && /^##\s+Phases\s*\r?$/.test(lines[i]!)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (!fenced[i] && H2.test(lines[i]!)) return { start, end: i };
  }
  return { start, end: lines.length };
}

/** Scan a plan document into its fenced map, phases region, and sections. */
export function planLayout(contents: string): PlanLayout {
  const lines = contents.split('\n');
  const fenced = fencedLines(lines);
  const region = phasesRegion(lines, fenced);
  const sections: PlanSection[] = [];
  if (!region) return { lines, fenced, region, sections };

  let current: PlanSection | undefined;
  const lastLine = region.end - 1;
  for (let i = region.start + 1; i < region.end; i++) {
    if (fenced[i]) continue;
    const line = lines[i] ?? '';
    const phase = line.match(PHASE);
    const sub = line.match(SUBTASK);
    if (phase) {
      if (current) current.endLine = i - 1;
      current = {
        kind: 'phase',
        ref: phase[1]!,
        phase: Number(phase[1]),
        title: phase[2]!.trim(),
        headerLine: i,
        statusLine: undefined,
        endLine: lastLine,
      };
      sections.push(current);
    } else if (sub) {
      // Close the previous section regardless of its kind (siblings, phases).
      if (current) current.endLine = i - 1;
      current = {
        kind: 'subtask',
        ref: `${sub[1]}.${sub[2]}`,
        phase: Number(sub[1]),
        number: Number(sub[2]),
        title: sub[3]!.trim(),
        headerLine: i,
        statusLine: undefined,
        endLine: lastLine,
      };
      sections.push(current);
    } else if (current && current.statusLine === undefined && STATUS.test(line)) {
      current.statusLine = i;
    }
  }
  return { lines, fenced, region, sections };
}
