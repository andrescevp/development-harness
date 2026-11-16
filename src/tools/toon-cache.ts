/**
 * toon-cache.ts — process-local restore cache, cache key, and eligible-tool
 * resolution for the two TOON execute hooks.
 *
 * The cache holds only the original JSON, keyed by the SHA-256 of the trimmed
 * TOON text. It is bounded twice: `TOON_MAX_CACHE` entries and
 * `TOON_MAX_ENTRY_CHARS` per entry (larger payloads are still emitted as TOON,
 * just not remembered). It is an LRU: a cache hit and a re-store both refresh
 * recency. Nothing here is persisted or logged.
 */
import { createHash } from 'node:crypto';
import { TOON_MAX_CACHE, TOON_MAX_ENTRY_CHARS } from '../lib/toon.js';

/** Default native tool whose output is eligible for compression. */
const DEFAULT_ELIGIBLE_TOOLS = ['bash'] as const;

/** Environment variable that overrides the eligible native tool names. */
const ELIGIBLE_TOOLS_ENV = 'OPENCODE_TOON_PLUGIN_TOOLS';

/** Insertion-ordered LRU map: TOON hash → original JSON. */
const convertedOutputs = new Map<string, string>();

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

/**
 * Remember a converted payload; a re-store refreshes recency, and the least
 * recently used entry is evicted past the 100-entry bound. Entries above
 * `TOON_MAX_ENTRY_CHARS` are skipped (the TOON text is still emitted).
 */
export function cacheConvertedOutput(toon: string, json: string): void {
  if (json.length > TOON_MAX_ENTRY_CHARS) return;

  const key = hashToon(toon);
  convertedOutputs.delete(key);
  convertedOutputs.set(key, json);

  if (convertedOutputs.size > TOON_MAX_CACHE) {
    const oldest = convertedOutputs.keys().next().value;
    if (oldest !== undefined) convertedOutputs.delete(oldest);
  }
}

/** Exact-match LRU lookup: returns the original JSON and refreshes recency. */
export function getCachedJson(text: string): string | undefined {
  const key = hashToon(text);
  const entry = convertedOutputs.get(key);
  if (entry === undefined) return undefined;
  convertedOutputs.delete(key);
  convertedOutputs.set(key, entry);
  return entry;
}

/** Test/reset hook: drop every remembered conversion. */
export function clearToonCache(): void {
  convertedOutputs.clear();
}
