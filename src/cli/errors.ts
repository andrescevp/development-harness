/**
 * errors.ts — shared CLI exit codes and typed failures.
 *
 * Keeping these in a leaf module lets the parser, scope resolver, and entry
 * share one contract without a runtime cycle. Library code throws typed errors;
 * only the entry maps them to process exit codes.
 */

/** Exit codes shared by the parser, the entry, and command modules. */
export const EXIT_SUCCESS = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

export type ExitCode = typeof EXIT_SUCCESS | typeof EXIT_FAILURE | typeof EXIT_USAGE;

/** Base class for expected CLI failures; `exitCode` drives the process status. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCode,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Invalid command-line usage: exit 2. */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, EXIT_USAGE);
  }
}

/** Expected operational failure: exit 1. */
export class OperationalError extends CliError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, EXIT_FAILURE, options);
  }
}
