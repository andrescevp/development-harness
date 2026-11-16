/**
 * toon-restore.ts — forwarded bash command restoration for the
 * `execute.before` hook.
 *
 * Only two shell scopes are rewritten: single-/double-quoted strings and
 * heredoc bodies whose marker is QUOTED (`<<'EOF'`, `<<"EOF"`). An unquoted
 * heredoc (`<<EOF`) makes the shell expand its body (`$…`, `$(…)`, backticks,
 * backslashes), so restored JSON there would be altered or executed and is
 * left byte-identical. Exact cache hits win over the strict TOON decode
 * fallback; edited, invalid, and unquoted text is never rewritten.
 *
 * Heredoc detection is linear: an opener-only sticky regex plus
 * `String#indexOf` for the closing line, a per-call memo of markers that have
 * no terminator, and a total scan budget. When the budget is exceeded the rest
 * of the command is left byte-identical.
 */
import { decodeToon, looksLikeToon } from '../lib/toon.js';
import { getCachedJson } from './toon-cache.js';

/** Forwarded commands longer than this stay byte-identical (1 MiB). */
const MAX_RESTORE_CHARS = 1_048_576;

/** Total heredoc scan budget, as a multiple of the command length. */
const HEREDOC_SCAN_BUDGET_FACTOR = 8;

/**
 * Heredoc opener line only (never the body): operator, quoted or bare marker,
 * and the rest of the line up to its newline. Groups: 1 marker quote (empty
 * when unquoted), 2 marker name. Sticky so it matches exactly at the current
 * scan position.
 */
const HEREDOC_OPENER = /<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n/y;

/** Shell form of a literal string (`'` → `'\''`). */
export function shellSingleQuote(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

/**
 * JSON for a forwarded payload: the exact original when the TOON text is
 * remembered, otherwise a strict decode of a clean TOON document that yields
 * an object/array. `undefined` means "not restorable — leave the text
 * untouched".
 */
function getJsonForForwardedText(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;

  const cached = getCachedJson(trimmed);
  if (cached !== undefined) return cached;

  if (!looksLikeToon(trimmed)) return undefined;
  const decoded = decodeToon(trimmed);
  // A bare scalar decode is never a forwarded payload.
  if (typeof decoded !== 'object' || decoded === null) return undefined;

  try {
    const json = JSON.stringify(decoded);
    return typeof json === 'string' ? json : undefined;
  } catch {
    return undefined;
  }
}

/** Position of the closing quote, skipping `\x` escapes in double quotes. */
function findClosingQuote(command: string, start: number, quote: string): number {
  for (let index = start + 1; index < command.length; index += 1) {
    const char = command[index];
    if (quote === '"' && char === '\\') {
      index += 1;
      continue;
    }
    if (char === quote) return index;
  }
  return -1;
}

/** Closing line of one heredoc within the command. */
interface HeredocBounds {
  /** Index where the body ends (start of the closing marker). */
  bodyEnd: number;
  /** Index just past the closing marker and its newline, when any. */
  end: number;
}

/** Is `marker` at `markerStart` a whole line (end of command or newline)? */
function isClosingLine(command: string, markerStart: number, markerLength: number): boolean {
  const after = markerStart + markerLength;
  return after === command.length || command[after] === '\n';
}

/**
 * Locate the closing marker line of an opened heredoc. Returns `undefined` for
 * unterminated heredocs; the scan is forward-only, so a miss means no later
 * start position can find one either.
 */
function heredocBounds(command: string, bodyStart: number, marker: string): HeredocBounds | undefined {
  // An empty body is possible: the closing marker starts right after the opener.
  if (command.startsWith(marker, bodyStart) && isClosingLine(command, bodyStart, marker.length)) {
    const after = bodyStart + marker.length;
    return { bodyEnd: bodyStart, end: after };
  }

  let searchFrom = bodyStart;
  for (;;) {
    const found = command.indexOf(`\n${marker}`, searchFrom);
    if (found === -1) return undefined;

    const markerStart = found + 1;
    if (isClosingLine(command, markerStart, marker.length)) {
      const after = markerStart + marker.length;
      return { bodyEnd: found, end: after };
    }
    searchFrom = found + 1;
  }
}

/** Per-call heredoc scan state: failed markers, spend, and budget. */
interface HeredocScan {
  /** Markers already searched to the end of the command without a terminator. */
  missing: Set<string>;
  /** Characters charged to the budget so far. */
  spent: number;
  /** Hard ceiling for `spent`; exceeding it leaves the rest byte-identical. */
  budget: number;
}

/**
 * Match one heredoc that starts exactly at `index`. Only a QUOTED marker's body
 * may be restored; unquoted heredocs are still consumed so their body is never
 * rescanned as command text. `undefined` when the text at `index` is not a
 * complete heredoc (including unterminated ones).
 */
function readHeredoc(command: string, index: number, scan: HeredocScan): { text: string; end: number } | undefined {
  HEREDOC_OPENER.lastIndex = index;
  const opener = HEREDOC_OPENER.exec(command);
  if (opener === null) return undefined;

  const quote = opener[1] ?? '';
  const marker = opener[2] ?? '';
  const openerLine = opener[0];
  if (scan.missing.has(marker)) return undefined;

  scan.spent += openerLine.length;
  const bodyStart = index + openerLine.length;
  const bounds = heredocBounds(command, bodyStart, marker);

  if (bounds === undefined) {
    // Memoize the miss: every later opener with this marker would rescan to
    // end-of-command for nothing. Charge the failed search to the budget.
    scan.missing.add(marker);
    scan.spent += command.length - bodyStart;
    return undefined;
  }

  scan.spent += bounds.end - bodyStart;
  const unchanged = command.slice(index, bounds.end);
  // Shell expansion would corrupt restored JSON inside an unquoted heredoc.
  if (quote === '') return { text: unchanged, end: bounds.end };

  const json = getJsonForForwardedText(command.slice(bodyStart, bounds.bodyEnd));
  if (json === undefined) return { text: unchanged, end: bounds.end };

  return {
    text: `${openerLine}${json}${command.slice(bounds.bodyEnd, bounds.end)}`,
    end: bounds.end,
  };
}

/**
 * Restore remembered or clean TOON payloads inside a forwarded bash command.
 *
 * Only quoted strings and quoted-marker heredoc bodies are rewritten;
 * everything else — unquoted words, unquoted heredocs, comments, malformed
 * quoting — is copied verbatim, and inserted JSON is never rescanned, so the
 * rewrite cannot recurse. A restored payload is emitted as a single-quoted
 * JSON string, escaping apostrophes. Commands above `MAX_RESTORE_CHARS` are
 * returned unchanged.
 */
export function restoreForwardedCommand(command: string): string {
  if (command.length > MAX_RESTORE_CHARS) return command;
  // Neither quoting nor a heredoc opener means nothing can be restored.
  if (!command.includes("'") && !command.includes('"') && !command.includes('<<')) return command;

  const chunks: string[] = [];
  const scan: HeredocScan = {
    missing: new Set<string>(),
    spent: 0,
    budget: command.length * HEREDOC_SCAN_BUDGET_FACTOR,
  };
  let plainStart = 0;
  let index = 0;

  /** Queue the not-yet-copied plain run; restored chunks are already queued. */
  const flush = (end: number): void => {
    if (end > plainStart) chunks.push(command.slice(plainStart, end));
    plainStart = end;
  };

  while (index < command.length) {
    const char = command[index];

    // Outside quotes a backslash escapes the next character; skip the pair so
    // an escaped quote never opens a shell string.
    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === '<' && command[index + 1] === '<') {
      const heredoc = readHeredoc(command, index, scan);
      // Budget exhausted: leave the rest of the command byte-identical.
      if (scan.spent > scan.budget) {
        flush(command.length);
        break;
      }
      if (heredoc !== undefined) {
        flush(index);
        chunks.push(heredoc.text);
        index = heredoc.end;
        plainStart = index;
        continue;
      }
    }

    if (char === "'" || char === '"') {
      const end = findClosingQuote(command, index, char);
      if (end === -1) break;

      // `$'...'` is ANSI-C quoting: JSON backslashes would be interpreted by
      // the shell, so that form is never rewritten.
      const ansiCQuoted = char === "'" && command[index - 1] === '$';
      const json = ansiCQuoted ? undefined : getJsonForForwardedText(command.slice(index + 1, end));
      if (json !== undefined) {
        flush(index);
        chunks.push(shellSingleQuote(json));
        index = end + 1;
        plainStart = index;
        continue;
      }
      index = end + 1;
      continue;
    }

    index += 1;
  }

  flush(command.length);
  return chunks.join('');
}
