/**
 * toon-hooks.ts — native tool-hook compression, restore cache, and forwarded
 * command restoration.
 *
 * The V2 plugin registers two hooks:
 *   - `execute.after` (eligible tools, default `bash`) replaces tool text that
 *     is valid JSON of at least `TOON_MIN_CHARS` characters with its TOON form
 *     when TOON is strictly shorter, remembering the original JSON in a
 *     100-entry exact-match cache.
 *   - `execute.before` (always `bash`) restores that JSON inside forwarded
 *     quoted strings and heredoc bodies: exact cache match first, strict TOON
 *     decode second. Unquoted command text, edited payloads, and invalid
 *     payloads are never rewritten.
 *
 * `content` is the model-facing channel; a string `output` is converted only
 * when `content` carries no convertable text. No payloads, commands, or inputs
 * are logged.
 */
import { createHash } from 'node:crypto';
import {
  decodeToon,
  looksLikeJson,
  looksLikeToon,
  TOON_MAX_CACHE,
  TOON_MIN_CHARS,
  tryEncodeToon,
} from '../lib/toon.js';

/** Default native tool whose output is eligible for compression. */
const DEFAULT_ELIGIBLE_TOOLS = ['bash'] as const;

/** Environment variable that overrides the eligible native tool names. */
const ELIGIBLE_TOOLS_ENV = 'OPENCODE_TOON_PLUGIN_TOOLS';

/** Structural subset of a tool content block; host schema types stay outside. */
export interface ToolContentBlockLike {
  type: string;
  text?: string;
}

/**
 * Structural subset of the host tool result the after-hook may rewrite.
 * Deliberately local: this module never imports host schema types, so tests
 * need no host runtime.
 */
export interface ToolResultLike {
  content?: string | ReadonlyArray<ToolContentBlockLike>;
  output?: unknown;
}

/** Insertion-ordered exact-match cache keyed by the TOON text hash. */
const convertedOutputs = new Map<string, { json: string; toon: string }>();

/** SHA-256 of the trimmed TOON payload (the cache key contract). */
function hashToon(toon: string): string {
  return createHash('sha256').update(toon.trim()).digest('hex');
}

/**
 * Resolve the eligible native tool names: default `bash`, or the
 * comma-separated `OPENCODE_TOON_PLUGIN_TOOLS` value (trimmed, lowercased,
 * empty entries dropped). An empty variable falls back to the default.
 */
export function getEligibleTools(env: Readonly<Record<string, string | undefined>> = process.env): Set<string> {
  const raw = env[ELIGIBLE_TOOLS_ENV];
  const names = raw ? raw.split(',') : DEFAULT_ELIGIBLE_TOOLS;
  return new Set(names.map((tool) => tool.trim().toLowerCase()).filter(Boolean));
}

/** Remember a converted payload; evicts the least recent past the bound. */
export function cacheConvertedOutput(toon: string, json: string): void {
  convertedOutputs.set(hashToon(toon), { json, toon });

  while (convertedOutputs.size > TOON_MAX_CACHE) {
    const oldest = convertedOutputs.keys().next().value;
    if (oldest === undefined) break;
    convertedOutputs.delete(oldest);
  }
}

/** Exact-match LRU lookup: returns the original JSON and refreshes recency. */
export function getCachedJson(text: string): string | undefined {
  const key = hashToon(text);
  const entry = convertedOutputs.get(key);
  if (entry === undefined) return undefined;
  convertedOutputs.delete(key);
  convertedOutputs.set(key, entry);
  return entry.json;
}

/** Test/reset hook: drop every remembered conversion. */
export function clearToonCache(): void {
  convertedOutputs.clear();
}

/**
 * Convert one JSON text payload to TOON when it is eligible, remembering the
 * original JSON. `undefined` means "keep the text exactly as it was".
 */
function convertJsonText(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length < TOON_MIN_CHARS) return undefined;
  if (!looksLikeJson(trimmed)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  const toon = tryEncodeToon(parsed, trimmed);
  if (toon === undefined) return undefined;

  cacheConvertedOutput(toon, trimmed);
  return toon;
}

/** Text block guard for content arrays; file blocks are left alone. */
function isTextBlock(block: unknown): block is { type: 'text'; text: string } {
  if (typeof block !== 'object' || block === null) return false;
  const candidate = block as { type?: unknown; text?: unknown };
  return candidate.type === 'text' && typeof candidate.text === 'string';
}

/**
 * Compress the text payload of a tool result in place.
 *
 * `content` string → replaced with TOON when eligible; `content` block array →
 * the first text block with an eligible JSON payload is replaced and every
 * other block stays untouched; string `output` → fallback channel, converted
 * only when `content` yielded nothing. Returns `true` when a payload changed.
 * Never throws: the hook must stay inert on any malformed shape.
 */
export function compressToolResult(result: ToolResultLike): boolean {
  try {
    if (typeof result !== 'object' || result === null) return false;

    if (typeof result.content === 'string') {
      const toon = convertJsonText(result.content);
      if (toon === undefined) return false;
      result.content = toon;
      return true;
    }

    if (Array.isArray(result.content)) {
      for (const block of result.content) {
        if (!isTextBlock(block)) continue;
        const toon = convertJsonText(block.text);
        if (toon === undefined) continue;
        block.text = toon;
        return true;
      }
    }

    if (typeof result.output === 'string') {
      const toon = convertJsonText(result.output);
      if (toon === undefined) return false;
      result.output = toon;
      return true;
    }

    return false;
  } catch {
    // Compression is best-effort; a host shape change must never surface.
    return false;
  }
}

/** Forwarded commands longer than this stay byte-identical (1 MiB). */
const MAX_RESTORE_CHARS = 1_048_576;

/**
 * Heredoc opener line, body, and closing marker (reference plugin shape):
 * 1 prefix (operator, marker and rest of the line, up to its newline),
 * 2 marker quote, 3 marker name, 4 body, 5 closing-marker line.
 */
const HEREDOC_PATTERN = /(<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2[^\n]*\n)([\s\S]*?)(\n\3(?:\n|$))/y;

/** Shell form of a literal string (`'` → `'\''`). */
function shellSingleQuote(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

/**
 * JSON for a forwarded payload: the exact original when the TOON text is
 * remembered, otherwise a strict decode of a clean TOON document. `undefined`
 * means "not restorable — leave the text untouched".
 */
function getJsonForForwardedText(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;

  const cached = getCachedJson(trimmed);
  if (cached !== undefined) return cached;

  if (!looksLikeToon(trimmed)) return undefined;
  const decoded = decodeToon(trimmed);
  if (decoded === undefined) return undefined;

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

/**
 * Match one heredoc that starts exactly at `index`. Only the body is restored;
 * the opener line and closing marker stay byte-identical. `undefined` when the
 * text at `index` is not a complete heredoc (including unterminated ones).
 */
function readHeredoc(command: string, index: number): { text: string; end: number } | undefined {
  HEREDOC_PATTERN.lastIndex = index;
  const match = HEREDOC_PATTERN.exec(command);
  if (match === null) return undefined;

  const prefix = match[1] ?? '';
  const body = match[4] ?? '';
  const suffix = match[5] ?? '';
  const json = getJsonForForwardedText(body);

  return {
    text: json === undefined ? (match[0] ?? '') : `${prefix}${json}${suffix}`,
    end: HEREDOC_PATTERN.lastIndex,
  };
}

/**
 * Restore remembered or clean TOON payloads inside a forwarded bash command.
 *
 * Only two shell scopes are rewritten: heredoc bodies and single/double-quoted
 * strings. Everything else — unquoted words, comments, malformed quoting — is
 * copied verbatim, and inserted JSON is never rescanned, so the rewrite cannot
 * recurse. A restored quoted payload is rewritten as a single-quoted JSON
 * string, escaping apostrophes. Commands above `MAX_RESTORE_CHARS` are
 * returned unchanged.
 */
export function restoreForwardedCommand(command: string): string {
  if (command.length > MAX_RESTORE_CHARS) return command;

  let restored = '';
  let index = 0;

  while (index < command.length) {
    const char = command[index];

    // Outside quotes a backslash escapes the next character; skip the pair so
    // an escaped quote never opens a shell string.
    if (char === '\\') {
      restored += command.slice(index, index + 2);
      index += 2;
      continue;
    }

    if (char === '<' && command[index + 1] === '<') {
      const heredoc = readHeredoc(command, index);
      if (heredoc !== undefined) {
        restored += heredoc.text;
        index = heredoc.end;
        continue;
      }
    }

    if (char === "'" || char === '"') {
      const end = findClosingQuote(command, index, char);
      if (end === -1) {
        restored += command.slice(index);
        break;
      }
      // `$'...'` is ANSI-C quoting: JSON backslashes would be interpreted by
      // the shell, so that form is never rewritten.
      const ansiCQuoted = char === "'" && command[index - 1] === '$';
      const body = command.slice(index + 1, end);
      const json = ansiCQuoted ? undefined : getJsonForForwardedText(body);
      restored += json === undefined ? command.slice(index, end + 1) : shellSingleQuote(json);
      index = end + 1;
      continue;
    }

    restored += char;
    index += 1;
  }

  return restored;
}
