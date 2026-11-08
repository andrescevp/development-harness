/**
 * output.ts — command output conventions for human and `--json` modes.
 *
 * Human steps are prefixed with the command and written to stdout; diagnostics
 * always go to stderr. JSON mode emits exactly one machine-readable envelope on
 * stdout (`{ ok, command, ...payload }`) and suppresses human step lines, so
 * scripts never have to strip log noise. All human text is ASCII-sanitized.
 */
import { type CommandName, OperationalError, sanitizeToken } from './args.js';

/** Minimal writer contract; process streams and test collectors both fit. */
interface OutputWriter {
  write(chunk: string): unknown;
}

/** Arbitrary JSON payload merged into the envelope after the canonical fields. */
export type JsonPayload = Readonly<Record<string, unknown>>;

/** Stable machine-readable envelope shared by install, status, and uninstall. */
export interface JsonEnvelope {
  readonly ok: boolean;
  readonly command: CommandName;
  readonly [key: string]: unknown;
}

export interface OutputOptions {
  readonly command: CommandName;
  /** Machine-readable mode: step lines are suppressed, JSON is allowed. */
  readonly json?: boolean;
  readonly stdout?: OutputWriter;
  readonly stderr?: OutputWriter;
}

interface EmitJsonOptions {
  readonly ok?: boolean;
}

/** The writer handed to commands; both modes share one instance per run. */
export interface CommandOutput {
  readonly command: CommandName;
  readonly json: boolean;
  /** Human progress line (stdout, command-prefixed). No-op in JSON mode. */
  step(message: string): void;
  /** Non-fatal diagnostic (stderr, command-prefixed). */
  warn(message: string): void;
  /** Error diagnostic (stderr). */
  error(message: string): void;
  /** Emit the single JSON result for this command; invalid in human mode. */
  emitJson(payload?: JsonPayload, options?: EmitJsonOptions): void;
}

/**
 * Build the envelope with canonical fields first. Reserved payload keys are
 * dropped so a payload can never forge `ok` or the command name, and the
 * original object is left untouched.
 */
export function jsonEnvelope(command: CommandName, ok: boolean, payload: JsonPayload = {}): JsonEnvelope {
  const rest = { ...payload };
  delete rest.ok;
  delete rest.command;
  return { ok, command, ...rest };
}

/** A command-prefixed progress line, escaped to a single ASCII line. */
export function formatHumanLine(command: CommandName, message: string): string {
  return `${command}: ${sanitizeToken(message)}\n`;
}

/** A command-prefixed warning line for stderr. */
export function formatWarningLine(command: CommandName, message: string): string {
  return `${command}: warning: ${sanitizeToken(message)}\n`;
}

/** An error diagnostic line for stderr, matching the entry's error format. */
export function formatErrorLine(message: string): string {
  return `error: ${sanitizeToken(message)}\n`;
}

/**
 * Create the output writer for one command run. JSON emission is single-shot:
 * a second call means the command has a bug and fails operationally instead of
 * corrupting stdout with a second object.
 */
export function createOutput(options: OutputOptions): CommandOutput {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const json = options.json ?? false;
  let emitted = false;

  return {
    command: options.command,
    json,
    step(message: string): void {
      if (!json) stdout.write(formatHumanLine(options.command, message));
    },
    warn(message: string): void {
      stderr.write(formatWarningLine(options.command, message));
    },
    error(message: string): void {
      stderr.write(formatErrorLine(message));
    },
    emitJson(payload: JsonPayload = {}, emitOptions: EmitJsonOptions = {}): void {
      if (!json) throw new OperationalError('cannot emit JSON output in human mode');
      if (emitted) throw new OperationalError('JSON output was already emitted for this command');

      let serialized: string;
      try {
        serialized = JSON.stringify(jsonEnvelope(options.command, emitOptions.ok ?? true, payload));
      } catch (cause) {
        throw new OperationalError('failed to serialize JSON output', { cause });
      }
      emitted = true;
      stdout.write(`${serialized}\n`);
    },
  };
}
