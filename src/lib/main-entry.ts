/**
 * main-entry.ts — shared "is this module the process main entry?" guard.
 *
 * Realpath-based so npm/npx bin symlinks and relative invocations still match
 * the on-disk module. Used by the MCP stdio bin and the installer CLI; the
 * caller passes its own `import.meta.url` so the comparison stays correct.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * True when `entry` (default `process.argv[1]`) is the module at `moduleUrl`
 * on disk. Realpath-based: npm/npx bin symlinks and relative paths still match.
 */
export function isMainEntry(moduleUrl: string, entry: string | undefined = process.argv[1]): boolean {
  if (entry === undefined) return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
