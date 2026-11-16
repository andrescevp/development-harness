/**
 * toon-hooks.ts — native tool-hook compression plus the pure handlers the
 * plugin registers for `execute.after` and `execute.before`.
 *
 * `execute.after` (eligible tools, default `bash`): a completed call's text
 * payload that is valid JSON of at least `TOON_MIN_CHARS` characters is
 * replaced with its TOON form when TOON is strictly shorter; the original JSON
 * is remembered in the bounded LRU cache from `toon-cache.ts`.
 *
 * `execute.before` (always `bash`): forwarded quoted strings and
 * QUOTED-marker heredoc bodies are restored — exact cache match first, strict
 * TOON decode second. Unquoted heredocs (`<<EOF`), unquoted command text,
 * edited payloads, and invalid payloads are never rewritten.
 *
 * `content` is the model-facing channel: a string `content` is authoritative
 * (a non-JSON string does not fall through), and a string `output` is
 * converted only when `content` is absent or holds no text block with a
 * convertible payload. No payloads, commands, or inputs are logged.
 */
import { tryEncodeToonText } from '../lib/toon.js';
import { cacheConvertedOutput } from './toon-cache.js';
import { restoreForwardedCommand } from './toon-restore.js';

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

/**
 * Structural subset of the `execute.after` event handed to the handler.
 * Completed calls carry `result`; error calls carry `error` and no result.
 */
export interface AfterHookEventLike {
  readonly tool: string;
  readonly status: string;
  result?: ToolResultLike;
}

/** Structural subset of the `execute.before` event (the hook mutates `input`). */
export interface BeforeHookEventLike {
  readonly tool: string;
  input?: unknown;
}

/**
 * Convert one JSON text payload to TOON when it is eligible, remembering the
 * original JSON. `undefined` means "keep the text exactly as it was".
 */
function convertJsonText(text: string): string | undefined {
  const toon = tryEncodeToonText(text);
  if (toon === undefined) return undefined;

  cacheConvertedOutput(toon, text.trim());
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
 * `content` string → replaced with TOON when eligible; the string form is
 * authoritative, so a non-JSON string is left alone without an `output`
 * fallback. `content` block array → the first text block with an eligible JSON
 * payload is replaced and every other block stays untouched; when no block is
 * convertible, a string `output` is tried. Returns `true` when a payload
 * changed. Never throws: the hook must stay inert on any malformed shape.
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

/**
 * `execute.after` handler: compress the result of a completed eligible tool.
 * Failed calls, ineligible tools, and malformed shapes stay untouched, and no
 * error ever reaches the host. Returns `true` when a payload was replaced.
 */
export function handleAfterHook(event: AfterHookEventLike, eligible: ReadonlySet<string>): boolean {
  try {
    if (event.status !== 'completed') return false;
    if (!eligible.has(event.tool.toLowerCase())) return false;
    if (event.result === undefined) return false;
    return compressToolResult(event.result);
  } catch {
    // Best-effort hook: keep the original output on any unexpected shape.
    return false;
  }
}

/**
 * `execute.before` handler: restore forwarded TOON payloads in a `bash`
 * command. Only quoted strings and quoted-marker heredoc bodies are rewritten;
 * non-bash tools, missing/non-string commands, and malformed inputs stay
 * untouched. Returns `true` when the command changed.
 */
export function handleBeforeHook(event: BeforeHookEventLike): boolean {
  try {
    if (event.tool.toLowerCase() !== 'bash') return false;
    if (typeof event.input !== 'object' || event.input === null) return false;

    const input = event.input as { command?: unknown };
    if (typeof input.command !== 'string') return false;

    const restored = restoreForwardedCommand(input.command);
    if (restored === input.command) return false;
    input.command = restored;
    return true;
  } catch {
    // Best-effort hook: restoration must never surface an error into the host.
    return false;
  }
}
