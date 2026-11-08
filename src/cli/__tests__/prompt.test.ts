/**
 * prompt.test.ts — interactive scope selection and its non-interactive guard.
 *
 * Every dependency is injected: the line reader is scripted, the TTY flags are
 * explicit booleans, and diagnostics go to a string collector. Nothing here can
 * read from or write to a real terminal, and no test waits on stdin.
 */
import { describe, expect, it } from 'vitest';
import { EXIT_FAILURE, EXIT_USAGE, OperationalError, UsageError } from '../args.js';
import {
  DEFAULT_PROMPT_ATTEMPTS,
  decideScope,
  PromptCancelledError,
  parseScopeAnswer,
  promptForScope,
  SCOPE_PROMPT_TEXT,
  SCOPE_REQUIRED_MESSAGE,
  type ScopePromptDependencies,
  type ScopePromptReader,
} from '../prompt.js';

class StringWriter {
  text = '';

  write(chunk: string): boolean {
    this.text += chunk;
    return true;
  }
}

class ScriptedReader implements ScopePromptReader {
  readonly queries: string[] = [];
  closed = false;
  private index = 0;

  constructor(private readonly answers: readonly string[]) {}

  async question(query: string): Promise<string> {
    this.queries.push(query);
    const answer = this.answers[this.index];
    this.index += 1;
    if (answer === undefined) throw new Error('no scripted answer left');
    return answer;
  }

  close(): void {
    this.closed = true;
  }
}

class ThrowingReader implements ScopePromptReader {
  closed = false;

  async question(): Promise<string> {
    throw new Error('terminal closed');
  }

  close(): void {
    this.closed = true;
  }
}

function deps(reader: ScopePromptReader, overrides: Partial<ScopePromptDependencies> = {}): ScopePromptDependencies {
  return {
    inputIsTTY: true,
    outputIsTTY: true,
    diagnostics: new StringWriter(),
    createReader: async () => reader,
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the promise to reject');
}

function assertAscii(text: string): void {
  expect([...text].every((char) => char.charCodeAt(0) < 0x7f)).toBe(true);
}

const ANSWER_CASES = [
  { name: 'empty selects project', answer: '', expected: { kind: 'scope', scope: 'project' } },
  { name: 'whitespace selects project', answer: '   ', expected: { kind: 'scope', scope: 'project' } },
  { name: 'P selects project', answer: 'P', expected: { kind: 'scope', scope: 'project' } },
  { name: 'p selects project', answer: 'p', expected: { kind: 'scope', scope: 'project' } },
  { name: 'Project selects project', answer: 'Project', expected: { kind: 'scope', scope: 'project' } },
  { name: 'padded PROJECT selects project', answer: '  PROJECT  ', expected: { kind: 'scope', scope: 'project' } },
  { name: 'G selects global', answer: 'G', expected: { kind: 'scope', scope: 'global' } },
  { name: 'global selects global', answer: 'global', expected: { kind: 'scope', scope: 'global' } },
  { name: 'GLOBAL selects global', answer: 'GLOBAL', expected: { kind: 'scope', scope: 'global' } },
  { name: 'C cancels', answer: 'C', expected: { kind: 'cancel' } },
  { name: 'cancel cancels', answer: 'cancel', expected: { kind: 'cancel' } },
  { name: 'CANCEL cancels', answer: 'CANCEL', expected: { kind: 'cancel' } },
  { name: 'unknown word is invalid', answer: 'glob', expected: { kind: 'invalid' } },
  { name: 'number is invalid', answer: '1', expected: { kind: 'invalid' } },
  { name: 'two letters are invalid', answer: 'GP', expected: { kind: 'invalid' } },
] as const;

describe('decideScope', () => {
  it('resolves an explicit scope without consulting the terminals', () => {
    expect(decideScope({ scope: 'global', inputIsTTY: false, outputIsTTY: false })).toEqual({
      kind: 'explicit',
      scope: 'global',
    });
  });

  it('prompts only when both terminals are interactive', () => {
    expect(decideScope({ inputIsTTY: true, outputIsTTY: true })).toEqual({ kind: 'prompt' });
  });

  it.each([
    { name: 'stdin is not a TTY', inputIsTTY: false, outputIsTTY: true },
    { name: 'stdout is not a TTY', inputIsTTY: true, outputIsTTY: false },
    { name: 'neither is a TTY', inputIsTTY: false, outputIsTTY: false },
  ])('returns a usage error when $name', ({ inputIsTTY, outputIsTTY }) => {
    const decision = decideScope({ inputIsTTY, outputIsTTY });

    expect(decision.kind).toBe('unavailable');
    if (decision.kind !== 'unavailable') throw new Error('expected an unavailable decision');
    expect(decision.error).toBeInstanceOf(UsageError);
    expect(decision.error.exitCode).toBe(EXIT_USAGE);
    expect(decision.error.message).toContain('install --global');
    expect(decision.error.message).toContain('install --project --path .');
  });

  it('does not prompt when the caller forbids it (for example --json)', () => {
    const decision = decideScope({ inputIsTTY: true, outputIsTTY: true, promptAllowed: false });

    expect(decision.kind).toBe('unavailable');
  });
});

describe('parseScopeAnswer', () => {
  it.each(ANSWER_CASES)('$name', ({ answer, expected }) => {
    expect(parseScopeAnswer(answer)).toEqual(expected);
  });
});

describe('promptForScope', () => {
  it('returns a supplied scope and never creates a reader', async () => {
    const scope = await promptForScope({
      scope: 'project',
      inputIsTTY: true,
      outputIsTTY: true,
      createReader: async () => {
        throw new Error('reader must not be created');
      },
    });

    expect(scope).toBe('project');
  });

  it('defaults to project on an empty answer', async () => {
    const reader = new ScriptedReader(['']);
    const diagnostics = new StringWriter();
    const scope = await promptForScope(deps(reader, { diagnostics }));

    expect(scope).toBe('project');
    expect(reader.queries).toHaveLength(1);
    expect(diagnostics.text).toBe('');
    expect(reader.closed).toBe(true);
  });

  it('accepts case-insensitive full words', async () => {
    const reader = new ScriptedReader(['Global']);
    await expect(promptForScope(deps(reader))).resolves.toBe('global');
  });

  it('prints the full menu on the first attempt and accepts ASCII labels only', async () => {
    const reader = new ScriptedReader(['P']);
    await promptForScope(deps(reader));

    const first = reader.queries[0] ?? '';
    expect(first).toContain('[G]lobal');
    expect(first).toContain('[P]roject');
    expect(first).toContain('[C]ancel');
    expect(first).toContain('(P)');
    assertAscii(first);
    expect(SCOPE_PROMPT_TEXT).toBe(first);
    assertAscii(SCOPE_REQUIRED_MESSAGE);
  });

  it('re-prompts after an invalid answer and reports it on stderr', async () => {
    const reader = new ScriptedReader(['nope', 'g']);
    const diagnostics = new StringWriter();
    const scope = await promptForScope(deps(reader, { diagnostics }));

    expect(scope).toBe('global');
    expect(reader.queries).toHaveLength(2);
    expect(reader.queries[1]).not.toContain('[G]lobal');
    expect(diagnostics.text).toContain('invalid selection');
    expect(diagnostics.text).not.toContain('nope');
    assertAscii(diagnostics.text);
  });

  it(`fails operationally after ${DEFAULT_PROMPT_ATTEMPTS} invalid answers`, async () => {
    const reader = new ScriptedReader(['x', 'y', 'z']);
    const error = await rejection(promptForScope(deps(reader)));

    expect(error).toBeInstanceOf(OperationalError);
    expect(error).not.toBeInstanceOf(UsageError);
    expect((error as OperationalError).exitCode).toBe(EXIT_FAILURE);
    expect((error as Error).message).toContain(`after ${DEFAULT_PROMPT_ATTEMPTS} attempts`);
    expect(reader.closed).toBe(true);
  });

  it('honors a custom attempt budget', async () => {
    const reader = new ScriptedReader(['x', 'y', 'z']);
    const error = await rejection(promptForScope(deps(reader, { maxAttempts: 2 })));

    expect((error as Error).message).toContain('after 2 attempts');
    expect(reader.queries).toHaveLength(2);
  });

  it('rejects a non-positive attempt budget instead of guessing', async () => {
    const error = await rejection(promptForScope(deps(new ScriptedReader([]), { maxAttempts: 0 })));

    expect(error).toBeInstanceOf(OperationalError);
    expect((error as Error).message).toContain('positive integer');
  });

  it.each(['c', 'C', 'cancel', 'CANCEL'])('treats %s as cancel and fails with exit 1', async (answer) => {
    const reader = new ScriptedReader([answer]);
    const error = await rejection(promptForScope(deps(reader)));

    expect(error).toBeInstanceOf(PromptCancelledError);
    expect(error).toBeInstanceOf(OperationalError);
    expect((error as OperationalError).exitCode).toBe(EXIT_FAILURE);
    expect((error as Error).message).toContain('cancelled');
    expect((error as Error).message).toContain('--global');
    expect(reader.closed).toBe(true);
  });

  it('maps a closed reader to an operational failure with its cause', async () => {
    const reader = new ThrowingReader();
    const error = await rejection(promptForScope(deps(reader)));

    expect(error).toBeInstanceOf(OperationalError);
    expect((error as Error).message).toContain('closed before a selection');
    expect((error as Error).cause).toBeInstanceOf(Error);
    expect((error as Error).cause).toMatchObject({ message: 'terminal closed' });
    expect(reader.closed).toBe(true);
  });

  it('maps a reader startup failure to an operational error', async () => {
    const error = await rejection(
      promptForScope({
        inputIsTTY: true,
        outputIsTTY: true,
        createReader: async () => {
          throw new Error('readline unavailable');
        },
      })
    );

    expect(error).toBeInstanceOf(OperationalError);
    expect((error as Error).message).toContain('cannot start the interactive scope prompt');
    expect((error as Error).cause).toMatchObject({ message: 'readline unavailable' });
  });

  it.each([
    { name: 'stdin is not a TTY', inputIsTTY: false, outputIsTTY: true },
    { name: 'stdout is not a TTY', inputIsTTY: true, outputIsTTY: false },
  ])('fails with a usage error when $name and no scope was supplied', async ({ inputIsTTY, outputIsTTY }) => {
    let created = false;
    const error = await rejection(
      promptForScope({
        inputIsTTY,
        outputIsTTY,
        createReader: async () => {
          created = true;
          return new ScriptedReader([]);
        },
      })
    );

    expect(error).toBeInstanceOf(UsageError);
    expect(error).not.toBeInstanceOf(OperationalError);
    expect((error as UsageError).exitCode).toBe(EXIT_USAGE);
    expect((error as Error).message).toBe(SCOPE_REQUIRED_MESSAGE);
    expect(created).toBe(false);
  });

  it('writes diagnostics with trailing newlines', async () => {
    const reader = new ScriptedReader(['bad', 'p']);
    const diagnostics = new StringWriter();
    await promptForScope(deps(reader, { diagnostics }));

    expect(diagnostics.text.endsWith('\n')).toBe(true);
  });
});
