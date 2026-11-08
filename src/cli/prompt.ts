/**
 * prompt.ts — interactive install-scope selection with deterministic fallbacks.
 *
 * A scope supplied by flags always wins and never touches a terminal. Without
 * one, the prompt runs only when stdin and stdout are both TTYs and the caller
 * allows it (`--json` forbids it); otherwise the command fails with a usage
 * error that shows explicit flags. Line reading is lazily imported and fully
 * injectable, so tests and non-interactive runs never wait on stdin.
 */
import { OperationalError, UsageError } from './errors.js';
import type { Scope } from './scope.js';

/** Options offered by the prompt, in display order. */
export type ScopeAnswer =
  | { readonly kind: 'scope'; readonly scope: Scope }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'invalid' };

/** Result of the terminal/flag decision, kept pure for direct testing. */
export type ScopeDecision =
  | { readonly kind: 'explicit'; readonly scope: Scope }
  | { readonly kind: 'prompt' }
  | { readonly kind: 'unavailable'; readonly error: UsageError };

export interface ScopeDecisionInput {
  /** Scope supplied by `--global` or `--project`. */
  readonly scope?: Scope;
  /** False when interactive output would corrupt machine-readable stdout. */
  readonly promptAllowed?: boolean;
  readonly inputIsTTY: boolean;
  readonly outputIsTTY: boolean;
}

interface PromptInput extends NodeJS.ReadableStream {
  readonly isTTY?: boolean;
}

interface PromptOutput extends NodeJS.WritableStream {
  readonly isTTY?: boolean;
}

/** Minimal diagnostics writer; defaults to stderr in the CLI. */
interface PromptDiagnostics {
  write(chunk: string): unknown;
}

/** Line reader abstraction; the default wraps `node:readline/promises`. */
export interface ScopePromptReader {
  question(query: string): Promise<string>;
  close(): void;
}

type ScopePromptReaderFactory = (input: PromptInput, output: PromptOutput) => Promise<ScopePromptReader>;

export interface ScopePromptDependencies {
  /** Explicit scope from flags; short-circuits the prompt. */
  readonly scope?: Scope;
  readonly input?: PromptInput;
  readonly output?: PromptOutput;
  /** TTY overrides for tests and embedders; default to each stream's flag. */
  readonly inputIsTTY?: boolean;
  readonly outputIsTTY?: boolean;
  /** Defaults to true; commands set false for `--json`. */
  readonly promptAllowed?: boolean;
  readonly diagnostics?: PromptDiagnostics;
  readonly maxAttempts?: number;
  readonly createReader?: ScopePromptReaderFactory;
}

export const DEFAULT_PROMPT_ATTEMPTS = 3;

/** Usage failure when no scope can be selected non-interactively. */
export const SCOPE_REQUIRED_MESSAGE =
  'no scope selected: pass --global or --project (for example: "install --global" or "install --project --path .")';

const RETRY_PROMPT_TEXT = 'Scope [G/P/C] (P): ';

/** Full menu plus query, shown on the first attempt. ASCII only. */
export const SCOPE_PROMPT_TEXT = `Select an install scope:
  [G]lobal  - install into the global OpenCode config
  [P]roject - install into the current project (default)
  [C]ancel  - exit without making changes
${RETRY_PROMPT_TEXT}`;

const INVALID_ANSWER_MESSAGE = 'invalid selection: expected G, P, or C; try again\n';

/** User chose Cancel: an expected operational failure, not a usage error. */
export class PromptCancelledError extends OperationalError {
  constructor() {
    super('cancelled: no scope selected (run again with --global or --project)');
  }
}

/**
 * Pure routing decision: explicit scope wins; prompting requires both TTYs and
 * caller permission; everything else is a usage error.
 */
export function decideScope(input: ScopeDecisionInput): ScopeDecision {
  if (input.scope !== undefined) return { kind: 'explicit', scope: input.scope };
  const canPrompt = input.promptAllowed ?? true;
  if (canPrompt && input.inputIsTTY && input.outputIsTTY) return { kind: 'prompt' };
  return { kind: 'unavailable', error: new UsageError(SCOPE_REQUIRED_MESSAGE) };
}

/** Map a raw answer to a scope, cancel, or invalid; empty means project. */
export function parseScopeAnswer(raw: string): ScopeAnswer {
  const answer = raw.trim().toLowerCase();
  if (answer === '' || answer === 'p' || answer === 'project') return { kind: 'scope', scope: 'project' };
  if (answer === 'g' || answer === 'global') return { kind: 'scope', scope: 'global' };
  if (answer === 'c' || answer === 'cancel') return { kind: 'cancel' };
  return { kind: 'invalid' };
}

function assertAttemptBudget(value: number | undefined): number {
  if (value === undefined) return DEFAULT_PROMPT_ATTEMPTS;
  if (!Number.isInteger(value) || value < 1) {
    throw new OperationalError('prompt attempts must be a positive integer');
  }
  return value;
}

async function createReadlineReader(input: PromptInput, output: PromptOutput): Promise<ScopePromptReader> {
  const { createInterface } = await import('node:readline/promises');
  // Canonical mode: the terminal handles echo and editing, and the multi-line
  // menu is written once instead of being redrawn on every keystroke.
  const readline = createInterface({ input, output, terminal: false });
  return {
    question: (query: string) => readline.question(query),
    close: () => readline.close(),
  };
}

/**
 * Resolve the install scope, prompting only when allowed. Supplied scopes,
 * non-TTY runs, and machine-readable modes never construct a line reader.
 */
export async function promptForScope(options: ScopePromptDependencies = {}): Promise<Scope> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const decision = decideScope({
    ...(options.scope === undefined ? {} : { scope: options.scope }),
    ...(options.promptAllowed === undefined ? {} : { promptAllowed: options.promptAllowed }),
    inputIsTTY: options.inputIsTTY ?? input.isTTY === true,
    outputIsTTY: options.outputIsTTY ?? output.isTTY === true,
  });

  if (decision.kind === 'explicit') return decision.scope;
  if (decision.kind === 'unavailable') throw decision.error;

  const maxAttempts = assertAttemptBudget(options.maxAttempts);
  const diagnostics = options.diagnostics ?? process.stderr;
  let reader: ScopePromptReader;
  try {
    reader = await (options.createReader ?? createReadlineReader)(input, output);
  } catch (cause) {
    throw new OperationalError('cannot start the interactive scope prompt', { cause });
  }

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let raw: string;
      try {
        raw = await reader.question(attempt === 1 ? SCOPE_PROMPT_TEXT : RETRY_PROMPT_TEXT);
      } catch (cause) {
        throw new OperationalError('scope prompt closed before a selection was made', { cause });
      }

      const answer = parseScopeAnswer(raw);
      if (answer.kind === 'scope') return answer.scope;
      if (answer.kind === 'cancel') throw new PromptCancelledError();
      if (attempt < maxAttempts) diagnostics.write(INVALID_ANSWER_MESSAGE);
    }
  } finally {
    reader.close();
  }

  throw new OperationalError(`invalid scope selection after ${maxAttempts} attempts (expected G, P, or C)`);
}
