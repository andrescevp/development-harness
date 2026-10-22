/**
 * fs-errors.ts — shared path validation and error formatting for CLI I/O.
 *
 * Installer modules format filesystem failures the same way: an
 * `OperationalError` carrying the action, the target path, and a short error
 * code. Keeping these helpers in a leaf avoids copy-pasted error handling
 * across `fs-utils` and `config-file` without hiding the original cause.
 */
import path from 'node:path';
import { OperationalError } from './errors.js';

/** Node error code (`ENOENT`, `EACCES`, ...) when the value carries one. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** True for errors that mean "the path is not there". */
export function isMissing(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'ENOENT' || code === 'ENOTDIR';
}

function describeError(error: unknown): string {
  return errorCode(error) ?? (error instanceof Error && error.message !== '' ? error.message : 'unknown error');
}

/** Wrap a filesystem failure with the action and target; never exposes contents. */
export function operationError(action: string, target: string, error: unknown): OperationalError {
  return new OperationalError(`${action}: ${target} (${describeError(error)})`, { cause: error });
}

/** Absolute, normalized path for an operation; rejects blank/relative input. */
export function requireAbsolute(action: string, value: string): string {
  if (value.trim() === '') throw new OperationalError(`cannot ${action}: path must not be blank`);
  if (!path.isAbsolute(value)) throw new OperationalError(`cannot ${action}: path must be absolute: ${value}`);
  return path.resolve(value);
}
