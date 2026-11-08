/**
 * errors.ts — typed-error assertions shared by unit tests.
 *
 * Keeps the "assert OperationalError and return it narrowed" contract in one
 * place so helpers never swallow the original failure.
 */
import { expect } from 'vitest';
import { OperationalError } from '../../cli/errors.js';

/** Assert that `error` is an `OperationalError` and return it narrowed. */
function expectOperationalError(error: unknown): OperationalError {
  expect(error).toBeInstanceOf(OperationalError);
  return error as OperationalError;
}

/** Await a rejecting promise and return its `OperationalError`. */
export async function rejectionOf(promise: Promise<unknown>): Promise<OperationalError> {
  try {
    await promise;
  } catch (err) {
    return expectOperationalError(err);
  }
  throw new Error('expected the promise to reject');
}

/** Run a throwing function and return its `OperationalError`. */
export function throwingOf(run: () => unknown): OperationalError {
  try {
    run();
  } catch (err) {
    return expectOperationalError(err);
  }
  throw new Error('expected the function to throw');
}
