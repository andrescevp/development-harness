/**
 * plan-checklists.ts — pure checklist/criteria extraction (§6).
 *
 * Grammar mirrors the parser's heading grammar so an item's `section` and
 * `subTaskIndex` always agree with the phase/sub-task it renders under. No new
 * plan fields: checkboxes, `Done When`/`Acceptance Criteria` and the final
 * verification checklist are read from existing markdown.
 */
import { clampText, ensureValue, stripCr } from './plan-issue.js';
import type { Checklist, ChecklistItem, Criterion } from './plan-model.js';

const CHECKBOX = /^(\s*)- \[([ xX])\]\s+(.*)$/;
const HEADING = /^#{1,6}\s/;
const BULLET = /^\s*[*-] /;
const H2 = /^##\s+(.*)$/;
const SUBTASK = /^####\s+Sub-Task\s+(\d+\.\d+):/;
const COMPLETION = /^(\s*)- \*\*Completion Checklist:\*\*\s*(.*)$/;
const CRITERION = /^(\s*)- \*\*(Done When|Acceptance Criteria):\*\*\s*(.*)$/;

const FINAL_SECTION = 'Final Integration & Verification';
const MAX_ITEMS = 50;
const MAX_TEXT = 200;

interface RawItem {
  item: ChecklistItem;
  indent: number;
}

export interface ChecklistExtraction {
  plan: Checklist;
  finalVerification: Checklist;
  /** Checkbox items keyed by `"N.M"`. */
  bySubTask: Record<string, ChecklistItem[]>;
  /** Done-When / Acceptance criteria values keyed by `"N.M"`, max 2 each. */
  criteria: Record<string, Criterion[]>;
}

function indentOf(line: string): number {
  const match = line.match(/^\s*/);
  return match ? match[0].length : 0;
}

/** Join the indented continuation lines of a bullet/checkbox (§6.1). */
function readContinuation(lines: readonly string[], start: number, indent: number, initial: string): string {
  let text = initial.trim();
  let index = start;
  while (index < lines.length) {
    const line = stripCr(lines[index]!);
    if (line.trim().length === 0) break;
    if (HEADING.test(line)) break;
    if (BULLET.test(line)) break;
    if (indentOf(line) <= indent) break;
    text = `${text} ${line.trim()}`;
    index += 1;
  }
  return text;
}

function checklistOf(items: ChecklistItem[], inlineText: string | null = null): Checklist {
  const limited = items.slice(0, MAX_ITEMS);
  return {
    items: limited,
    total: limited.length,
    checked: limited.filter((item) => item.checked === true).length,
    truncated: items.length > MAX_ITEMS,
    inlineText,
  };
}

function normalizedSection(section: string): string {
  return section.replace(/\s+/g, ' ').trim();
}

/** End line of the `Completion Checklist` bullet's child block (0-based). */
function completionBlockEnd(lines: readonly string[], start: number, indent: number): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = stripCr(lines[index]!);
    if (HEADING.test(line)) return index;
    if (line.trim().length === 0) continue;
    if (indentOf(line) <= indent) return index;
  }
  return lines.length;
}

/**
 * Extract every checklist, per-sub-task checkbox group and the criteria fields.
 * `relPath` only feeds stable item ids (`<relPath>#L<line>`).
 */
export function extractChecklists(contents: string, relPath: string): ChecklistExtraction {
  const lines = contents.split('\n');
  const items: RawItem[] = [];
  let section = '';
  let subTaskIndex: string | null = null;
  let completionLine = -1;
  let completionIndent = 0;
  let completionInline = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripCr(lines[index]!);
    const h2 = line.match(H2);
    if (h2) {
      section = h2[1]!.trim();
      subTaskIndex = null;
      continue;
    }
    const subTask = line.match(SUBTASK);
    if (subTask) {
      subTaskIndex = subTask[1]!;
      continue;
    }
    if (normalizedSection(section) === FINAL_SECTION) {
      const completion = line.match(COMPLETION);
      if (completion && completionLine === -1) {
        completionLine = index;
        completionIndent = completion[1]!.length;
        completionInline = completion[2]!.trim();
        continue;
      }
    }
    const checkbox = line.match(CHECKBOX);
    if (!checkbox) continue;
    const indent = checkbox[1]!.length;
    const text = readContinuation(lines, index + 1, indent, checkbox[3]!);
    items.push({
      indent,
      item: {
        id: `${relPath}#L${index + 1}`,
        text: clampText(text, MAX_TEXT),
        checked: checkbox[2] !== ' ',
        line: index + 1,
        section,
        subTaskIndex,
        kind: 'checkbox',
      },
    });
  }

  const blockEnd = completionLine === -1 ? -1 : completionBlockEnd(lines, completionLine, completionIndent);
  const completionItems =
    completionLine === -1 ? [] : items.filter(({ item }) => item.line > completionLine + 1 && item.line < blockEnd);
  const inlineText =
    completionInline.length > 0 && completionItems.length === 0 ? clampText(completionInline, MAX_TEXT) : null;

  const finalItems = items.filter(({ item, indent }) => {
    if (normalizedSection(item.section) !== FINAL_SECTION) return false;
    if (item.subTaskIndex !== null) return false;
    if (indent === 0) return true;
    return completionLine !== -1 && item.line > completionLine + 1 && item.line < blockEnd;
  });

  const criteria: Record<string, Criterion[]> = {};
  let current: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripCr(lines[index]!);
    if (HEADING.test(line)) {
      const subTask = line.match(SUBTASK);
      current = subTask ? subTask[1]! : null;
      continue;
    }
    if (current === null) continue;
    const field = line.match(CRITERION);
    if (!field) continue;
    const list = ensureValue(criteria, current, () => []);
    if (list.length >= 2) continue;
    const text = readContinuation(lines, index + 1, field[1]!.length, field[3]!);
    list.push({ kind: field[2] === 'Done When' ? 'done-when' : 'acceptance', text: clampText(text, MAX_TEXT) });
  }

  const bySubTask: Record<string, ChecklistItem[]> = {};
  for (const { item } of items) {
    if (item.subTaskIndex === null) continue;
    const list = ensureValue(bySubTask, item.subTaskIndex, () => []);
    if (list.length < MAX_ITEMS) list.push(item);
  }

  return {
    plan: checklistOf(items.map(({ item }) => item)),
    finalVerification: checklistOf(
      finalItems.map(({ item }) => item),
      inlineText
    ),
    bySubTask,
    criteria,
  };
}
