/**
 * Shared TOON test fixtures. Kept in one module so the codec, hook, and
 * restore suites exercise the same `logged_command`-shaped payload.
 */
import { tryEncodeToon } from '../../lib/toon.js';

/** `logged_command`-shaped payload: primitive arrays, no tabular fields. */
export function loggedCommandPayload(): Record<string, unknown> {
  return {
    ok: true,
    exitCode: 0,
    logPath: '/tmp/harness-exec-123456.log',
    head: Array.from({ length: 20 }, (_, i) => `line-${i}: build output detail`),
    tail: Array.from({ length: 5 }, (_, i) => `tail-${i}: build output detail`),
    truncated: true,
  };
}

/** Encode a fixture through the production codec; guard against drift. */
export function encodeFixture(payload: unknown): string {
  const toon = tryEncodeToon(payload);
  if (toon === undefined) throw new Error('fixture payload is not TOON-eligible');
  return toon;
}

/** TOON form of `loggedCommandPayload()` (cross-process decode fixture). */
export const LOGGED_COMMAND_TOON = encodeFixture(loggedCommandPayload());
