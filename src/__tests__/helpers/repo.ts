/**
 * repo.ts — repo-root and file-reading helpers shared by skill contract tests.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute repository root (helpers/ → __tests__/ → src/ → repo root). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Read a UTF-8 file. */
export function read(file: string): string {
  return readFileSync(file, 'utf8');
}
