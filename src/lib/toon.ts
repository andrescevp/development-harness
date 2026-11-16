/**
 * toon.ts — shared safe TOON codec for MCP payloads and plugin hooks.
 *
 * TOON is a translation layer for LLM input only: JSON remains the canonical
 * data model. Encoding is deliberately conservative — non-null objects/arrays
 * only, serialized JSON of at least `TOON_MIN_CHARS`, and only when the TOON
 * form is strictly shorter — so every call site can use `toon ?? json`.
 * Payloads are encoded from their JSON-normalized form, so `undefined`
 * properties and array holes behave exactly like the JSON the client would
 * otherwise receive.
 *
 * Failures (circular payloads, encoder errors) return `undefined` instead of
 * throwing; decoding is strict and equally failure-tolerant. No I/O, no
 * logging, no payload retention.
 */
import { decode, encode } from '@toon-format/toon';

/** Minimum serialized-JSON length before TOON is attempted. */
export const TOON_MIN_CHARS = 256;

/** Restore-cache bound (entries) shared by the plugin hooks. */
export const TOON_MAX_CACHE = 100;

/** Largest JSON payload remembered for exact-match restore (256 KiB). */
export const TOON_MAX_ENTRY_CHARS = 262_144;

/**
 * Tab delimiters beat commas on tabular rows and show up inside the array
 * header (`users[3\t]{id\tname}:`), so the encoder and the sniffer agree.
 */
const TOON_ENCODE_OPTIONS = { delimiter: '\t' } as const;

/** Shorter text is never a clean TOON document worth sniffing. */
const TOON_MIN_SNIFF_CHARS = 64;

/**
 * First line of a clean TOON document: a root key with an optional array
 * header/field list (`users[3\t]{id\tname}:`, `head[20\t]:`), a root array
 * header (`[3\t]:`), or a plain `key:` line. The strict decode that follows —
 * which only accepts object/array results — is the real gate; this only skips
 * obvious prose cheaply.
 */
const TOON_ROOT_LINE = /^[ \t]*(?:(?:[A-Za-z_$][\w$.-]*)?\[\d+[\t|,]?\](?:\{[^}\n]+\})?|[A-Za-z_$][\w$.-]*)\s*:/;

/**
 * Encode JSON text after normalizing through `JSON.parse`, so the encoded
 * value is exactly the JSON value (`undefined` keys dropped, `toJSON` applied).
 * Returns `undefined` for non-object/array documents, parse errors, and
 * non-shorter output; never throws.
 */
function encodeJson(json: string): string | undefined {
  try {
    const normalized: unknown = JSON.parse(json);
    if (typeof normalized !== 'object' || normalized === null) return undefined;
    const toon = encode(normalized, TOON_ENCODE_OPTIONS);
    return toon.length < json.length ? toon : undefined;
  } catch {
    // Invalid JSON text or encoder failures: keep JSON.
    return undefined;
  }
}

/**
 * Encode `payload` as TOON when it is an object/array whose serialized JSON is
 * at least `TOON_MIN_CHARS` and whose TOON form is strictly shorter.
 * Returns `undefined` for every other case (non-objects, unserializable
 * payloads, encoder errors, non-shorter output) so callers fall back to JSON.
 *
 * @param jsonText Pre-computed `JSON.stringify(payload)`, when the caller
 * already has it; used for the length check and as the normalization source.
 */
export function tryEncodeToon(payload: unknown, jsonText?: string): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  try {
    const json = jsonText ?? JSON.stringify(payload);
    // `JSON.stringify` can return undefined at runtime (e.g. a `toJSON` that
    // yields undefined) even though its type says string.
    if (typeof json !== 'string' || json.length < TOON_MIN_CHARS) return undefined;
    return encodeJson(json);
  } catch {
    // Circular structures, BigInt values, and encoder failures: keep JSON.
    return undefined;
  }
}

/**
 * Encode text that should already be JSON: trims for the checks, requires the
 * `TOON_MIN_CHARS` threshold and a JSON object/array, and delegates to the
 * shared codec. `undefined` means "keep the text exactly as it was".
 */
export function tryEncodeToonText(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length < TOON_MIN_CHARS) return undefined;
  if (!looksLikeJson(trimmed)) return undefined;
  return encodeJson(trimmed);
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
 * Cheap sniff: multi-line text of sniffable length that starts like a clean
 * TOON document (key-value line or array header) and is not JSON. Tabular,
 * primitive-array, and plain key-value documents all pass; the caller's strict
 * decode plus object/array check decides whether the text really is TOON.
 */
export function looksLikeToon(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < TOON_MIN_SNIFF_CHARS || !trimmed.includes('\n')) return false;
  if (looksLikeJson(trimmed)) return false;
  return TOON_ROOT_LINE.test(trimmed);
}
