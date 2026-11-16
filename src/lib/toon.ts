/**
 * toon.ts — shared safe TOON codec for MCP payloads and plugin hooks.
 *
 * TOON is a translation layer for LLM input only: JSON remains the canonical
 * data model. Encoding is deliberately conservative — non-null objects/arrays
 * only, serialized JSON of at least `TOON_MIN_CHARS`, and only when the TOON
 * form is strictly shorter — so every call site can use `toon ?? json`.
 * Failures (circular payloads, encoder errors) return `undefined` instead of
 * throwing; decoding is strict and equally failure-tolerant. No I/O, no
 * logging, no payload retention.
 */
import { decode, encode } from '@toon-format/toon';

/** Minimum serialized-JSON length before TOON is attempted. */
export const TOON_MIN_CHARS = 256;

/** Restore-cache bound (entries) shared by the plugin hooks. */
export const TOON_MAX_CACHE = 100;

/**
 * Tab delimiters beat commas on tabular rows and show up inside the array
 * header (`users[3\t]{id\tname}:`), so the encoder and the sniffer agree.
 */
const TOON_ENCODE_OPTIONS = { delimiter: '\t' } as const;

/** Shorter text is never a tabular TOON payload worth sniffing. */
const TOON_MIN_SNIFF_CHARS = 64;

/**
 * Tabular TOON header, at the start of any line: an optional key (`users`,
 * absent for root arrays), the array length and delimiter (`[3\t]`), the field
 * list (`{id\tname}`), and the trailing colon. Matches the tab-delimited
 * output of `TOON_ENCODE_OPTIONS`.
 */
const TOON_TABLE_HEADER = /^[ \t]*(?:[A-Za-z_$][\w$.-]*)?\[\d*[\t|,]?\]\{[^}\n]+\}:/m;

/**
 * Encode `payload` as TOON when it is an object/array whose serialized JSON is
 * at least `TOON_MIN_CHARS` and whose TOON form is strictly shorter.
 * Returns `undefined` for every other case (non-objects, unserializable
 * payloads, encoder errors, non-shorter output) so callers fall back to JSON.
 *
 * @param jsonText Pre-computed `JSON.stringify(payload)`, when the caller
 * already has it; used for the length and shorter checks.
 */
export function tryEncodeToon(payload: unknown, jsonText?: string): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  try {
    const json = jsonText ?? JSON.stringify(payload);
    // `JSON.stringify` can return undefined at runtime (e.g. a `toJSON` that
    // yields undefined) even though its type says string.
    if (typeof json !== 'string' || json.length < TOON_MIN_CHARS) return undefined;

    const toon = encode(payload, TOON_ENCODE_OPTIONS);
    return toon.length < json.length ? toon : undefined;
  } catch {
    // Circular structures, BigInt values, and encoder failures: keep JSON.
    return undefined;
  }
}

/**
 * Strict-decode TOON text. Returns `undefined` when strict decoding fails;
 * never throws to callers. Empty text is rejected up front because the codec
 * would otherwise decode it to `{}`, which is never a forwarded payload.
 */
export function decodeToon(text: string): unknown | undefined {
  if (text.trim() === '') return undefined;
  try {
    return decode(text);
  } catch {
    // Strict decode rejects edited or malformed payloads; leave them alone.
    return undefined;
  }
}

/** Cheap sniff: trimmed text starts and ends with matching JSON braces. */
export function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return (first === '{' && last === '}') || (first === '[' && last === ']');
}

/**
 * Cheap sniff: multi-line text of sniffable length containing a tabular TOON
 * header (not JSON). Used before attempting a strict decode of forwarded text.
 */
export function looksLikeToon(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < TOON_MIN_SNIFF_CHARS || !trimmed.includes('\n')) return false;
  if (looksLikeJson(trimmed)) return false;
  return TOON_TABLE_HEADER.test(trimmed);
}
