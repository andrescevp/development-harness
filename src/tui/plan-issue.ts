/**
 * plan-issue.ts — typed issues and shared text/table helpers.
 *
 * Leaf module: no filesystem, process or renderer access. Issues are sanitized
 * at construction so no absolute path, file content or stack trace can leak
 * into a slot renderer (progress-contract §3.3).
 */

export type PlanIssueCode =
  | 'no-workspace'
  | 'no-plans-dir'
  | 'plans-dir-unreadable'
  | 'plan-missing'
  | 'plan-unreadable'
  | 'file-too-large'
  | 'frontmatter-malformed'
  | 'not-a-phased-plan'
  | 'invalid-status'
  | 'orphan-subtask'
  | 'empty-delegated-agent'
  | 'slug-mismatch'
  | 'phase-status-mismatch'
  | 'mirror-status-mismatch'
  | 'completed-plan-active'
  | 'index-malformed'
  | 'index-orphan'
  | 'review-malformed'
  | 'ledger-malformed'
  | 'workspace-root-override'
  | 'pin-stale'
  | 'session-unavailable'
  | 'scan-truncated';

export type IssueSeverity = 'error' | 'warning';

export interface PlanIssue {
  code: PlanIssueCode;
  severity: IssueSeverity;
  /** Workspace-relative path, or `null` for global issues. */
  file: string | null;
  /** Single line, <= 200 chars, never file contents or stack traces. */
  message: string;
}

const ISSUE_MESSAGE_MAX = 200;

/** Build a sanitized issue: whitespace collapsed, capped at 200 chars. */
export function planIssue(
  code: PlanIssueCode,
  severity: IssueSeverity,
  file: string | null,
  message: string
): PlanIssue {
  const single = message.replace(/\s+/g, ' ').trim();
  return {
    code,
    severity,
    file,
    message: single.length > ISSUE_MESSAGE_MAX ? single.slice(0, ISSUE_MESSAGE_MAX) : single,
  };
}

/** Collapse whitespace and cap text with an ellipsis (checklist/summary rule). */
export function clampText(value: string, max: number): string {
  const single = value.replace(/\s+/g, ' ').trim();
  if (single.length <= max) return single;
  return `${single.slice(0, Math.max(0, max - 1))}…`;
}

/** Strip a trailing CR so callers can use one grammar for CRLF and LF files. */
export function stripCr(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

/** Split a markdown table row on unescaped pipes; `\|` becomes a literal `|`. */
export function splitTableRow(line: string): string[] {
  const body = stripCr(line).trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]!;
    if (char === '\\' && body[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Read-or-create a record entry without an assignment expression. */
export function ensureValue<T>(record: Record<string, T>, key: string, create: () => T): T {
  const existing = record[key];
  if (existing !== undefined) return existing;
  const created = create();
  record[key] = created;
  return created;
}
