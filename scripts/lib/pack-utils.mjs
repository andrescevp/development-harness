/**
 * pack-utils.mjs — small shared helpers for the package smoke checks.
 */
import fs from 'node:fs';

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Keep failure details readable without dumping an entire command log. */
export function tail(text, limit = 800) {
  const value = String(text ?? '').trim();
  return value.length > limit ? `...${value.slice(-limit)}` : value;
}
