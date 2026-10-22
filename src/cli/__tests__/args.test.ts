/**
 * args.test.ts — table-driven coverage of the CLI argument surface (1.1).
 *
 * Locks the command/option contract, aliases, validation errors, and the
 * stable usage exit code. The parser is pure: no filesystem or process state.
 */
import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  type CommandInvocation,
  type CommandName,
  type CommandOptions,
  type Invocation,
  type ParseResult,
  parseArgs,
  UsageError,
} from '../args.js';

const DEFAULT_OPTIONS: CommandOptions = {
  yes: false,
  dryRun: false,
  force: false,
  noMcp: false,
  mcpOnly: false,
  json: false,
};

function withOptions(overrides: Partial<CommandOptions> = {}): CommandOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

function parsed(result: ParseResult): Invocation {
  if (!result.ok) throw new Error(`expected an invocation, got usage error: ${result.error.message}`);
  return result.invocation;
}

function command(result: ParseResult): CommandInvocation {
  const invocation = parsed(result);
  if (invocation.kind !== 'command') throw new Error(`expected a command, got ${invocation.kind}`);
  return invocation;
}

function usageError(result: ParseResult): UsageError {
  if (result.ok) throw new Error(`expected a usage error, got ${result.invocation.kind}`);
  return result.error;
}

const VALID_CASES = [
  {
    name: 'install --global',
    argv: ['install', '--global'],
    command: 'install',
    options: withOptions({ scope: 'global' }),
  },
  {
    name: 'install --project with inline path',
    argv: ['install', '--project', '--path=./demo'],
    command: 'install',
    options: withOptions({ scope: 'project', path: './demo' }),
  },
  { name: 'status --json', argv: ['status', '--json'], command: 'status', options: withOptions({ json: true }) },
  {
    name: 'status project path',
    argv: ['status', '--project', '--path', '/tmp/project', '--json'],
    command: 'status',
    options: withOptions({ scope: 'project', path: '/tmp/project', json: true }),
  },
  {
    name: 'uninstall project dry-run',
    argv: ['uninstall', '--project', '--path', '.', '--dry-run', '--yes'],
    command: 'uninstall',
    options: withOptions({ scope: 'project', path: '.', dryRun: true, yes: true }),
  },
  {
    name: 'install with every non-conflicting option',
    argv: [
      'install',
      '--global',
      '--yes',
      '--dry-run',
      '--force',
      '--json',
      '--mcp-package=github:andrescevp/development-harness',
    ],
    command: 'install',
    options: withOptions({
      scope: 'global',
      yes: true,
      dryRun: true,
      force: true,
      json: true,
      mcpPackage: 'github:andrescevp/development-harness',
    }),
  },
  {
    name: 'status with mcp source',
    argv: ['status', '--global', '--mcp-source', 'github', '--json'],
    command: 'status',
    options: withOptions({ scope: 'global', json: true, mcpSource: 'github' }),
  },
  {
    name: 'install --no-mcp',
    argv: ['install', '--global', '--no-mcp', '--json'],
    command: 'install',
    options: withOptions({ scope: 'global', noMcp: true, json: true }),
  },
  {
    name: 'mcp-only install',
    argv: ['install', '--project', '--mcp-only', '--mcp-source=npm'],
    command: 'install',
    options: withOptions({ scope: 'project', mcpOnly: true, mcpSource: 'npm' }),
  },
  {
    name: 'mcp-only uninstall',
    argv: ['uninstall', '--global', '--mcp-only', '--mcp-package', 'dev-harness-skills'],
    command: 'uninstall',
    options: withOptions({ scope: 'global', mcpOnly: true, mcpPackage: 'dev-harness-skills' }),
  },
  {
    name: 'flags before the command',
    argv: ['--project', 'install', '--path', '.'],
    command: 'install',
    options: withOptions({ scope: 'project', path: '.' }),
  },
  {
    name: 'trailing separator',
    argv: ['install', '--global', '--'],
    command: 'install',
    options: withOptions({ scope: 'global' }),
  },
  {
    name: 'leading separator forwarded by npx',
    argv: ['--', 'install', '--global'],
    command: 'install',
    options: withOptions({ scope: 'global' }),
  },
] satisfies ReadonlyArray<{ name: string; argv: string[]; command: CommandName; options: CommandOptions }>;

const HELP_CASES = [
  { name: 'no arguments', argv: [] },
  { name: '--help', argv: ['--help'] },
  { name: '-h', argv: ['-h'] },
  { name: 'install --help', argv: ['install', '--help'], command: 'install' },
  { name: 'status -h', argv: ['status', '-h'], command: 'status' },
  { name: 'uninstall --help', argv: ['uninstall', '--help'], command: 'uninstall' },
  {
    name: 'help short-circuits invalid flags',
    argv: ['install', '--help', '--global', '--project'],
    command: 'install',
  },
] satisfies ReadonlyArray<{ name: string; argv: string[]; command?: CommandName }>;

const VERSION_CASES = [
  { name: '--version', argv: ['--version'] },
  { name: '-v', argv: ['-v'] },
  { name: 'after a command', argv: ['install', '--version'] },
] satisfies ReadonlyArray<{ name: string; argv: string[] }>;

const INVALID_CASES = [
  { name: 'unknown command', argv: ['frobnicate'], message: /unknown command: frobnicate/ },
  { name: 'unknown long flag', argv: ['install', '--bogus'], message: /unknown option: --bogus/ },
  { name: 'unknown long flag with value', argv: ['install', '--bogus=1'], message: /unknown option: --bogus/ },
  { name: 'unknown short flag', argv: ['install', '-x'], message: /unknown option: -x/ },
  { name: 'boolean flag with a value', argv: ['install', '--global=true'], message: /--global does not take a value/ },
  { name: 'missing path value', argv: ['install', '--project', '--path'], message: /--path requires a value/ },
  {
    name: 'path followed by a flag',
    argv: ['install', '--project', '--path', '--json'],
    message: /--path requires a value/,
  },
  { name: 'empty inline path', argv: ['install', '--project', '--path='], message: /--path requires a value/ },
  { name: 'missing mcp package', argv: ['install', '--mcp-package'], message: /--mcp-package requires a value/ },
  { name: 'missing mcp source', argv: ['install', '--mcp-source'], message: /--mcp-source requires a value/ },
  {
    name: 'invalid mcp source',
    argv: ['install', '--mcp-source=git'],
    message: /invalid value for --mcp-source: "git" \(expected "npm" or "github"\)/,
  },
  {
    name: 'conflicting scopes',
    argv: ['install', '--global', '--project'],
    message: /--global and --project are mutually exclusive/,
  },
  { name: 'path without project', argv: ['install', '--path', '.'], message: /--path requires --project/ },
  { name: 'path with global', argv: ['install', '--global', '--path', '.'], message: /--path requires --project/ },
  {
    name: 'duplicate path',
    argv: ['install', '--project', '--path', 'a', '--path', 'b'],
    message: /--path specified more than once/,
  },
  {
    name: 'duplicate mcp package',
    argv: ['install', '--mcp-package', 'a', '--mcp-package', 'b'],
    message: /--mcp-package specified more than once/,
  },
  {
    name: 'no-mcp with mcp-only',
    argv: ['install', '--no-mcp', '--mcp-only'],
    message: /--no-mcp and --mcp-only are mutually exclusive/,
  },
  {
    name: 'mcp package and source conflict',
    argv: ['install', '--mcp-package', 'dev-harness-skills', '--mcp-source', 'npm'],
    message: /--mcp-package and --mcp-source are mutually exclusive/,
  },
  {
    name: 'no-mcp with mcp package',
    argv: ['install', '--no-mcp', '--mcp-package', 'dev-harness-skills'],
    message: /--no-mcp cannot be combined with --mcp-package/,
  },
  {
    name: 'no-mcp with mcp source',
    argv: ['install', '--no-mcp', '--mcp-source', 'github'],
    message: /--no-mcp cannot be combined with --mcp-source/,
  },
  { name: 'status rejects dry-run', argv: ['status', '--dry-run'], message: /--dry-run is not supported by "status"/ },
  { name: 'status rejects yes', argv: ['status', '--yes'], message: /--yes is not supported by "status"/ },
  { name: 'status rejects force', argv: ['status', '--force'], message: /--force is not supported by "status"/ },
  {
    name: 'status rejects mcp-only',
    argv: ['status', '--mcp-only'],
    message: /--mcp-only is not supported by "status"/,
  },
  {
    name: 'uninstall rejects no-mcp',
    argv: ['uninstall', '--no-mcp'],
    message: /--no-mcp is not supported by "uninstall"/,
  },
  {
    name: 'unsupported flag before the command',
    argv: ['--dry-run', 'status'],
    message: /--dry-run is not supported by "status"/,
  },
  { name: 'options without a command', argv: ['--global'], message: /missing command/ },
  { name: 'json without a command', argv: ['--json'], message: /missing command/ },
  { name: 'positional after the command', argv: ['install', 'extra'], message: /unexpected argument: extra/ },
  { name: 'positional after the separator', argv: ['install', '--', 'extra'], message: /unexpected argument: extra/ },
] satisfies ReadonlyArray<{ name: string; argv: string[]; message: RegExp }>;

describe('commands', () => {
  it('exposes exactly install, status, and uninstall', () => {
    expect(COMMANDS).toEqual(['install', 'status', 'uninstall']);
  });

  it('defaults every boolean to false and leaves scope/path unset', () => {
    expect(command(parseArgs(['install'])).options).toEqual(DEFAULT_OPTIONS);
  });

  it('does not infer a scope from --yes', () => {
    expect(command(parseArgs(['install', '--yes'])).options.scope).toBeUndefined();
  });

  it('does not mutate argv', () => {
    const argv = ['install', '--global'];
    const copy = [...argv];
    parseArgs(argv);
    expect(argv).toEqual(copy);
  });

  it('escapes control and non-ASCII argv tokens in usage errors', () => {
    const error = usageError(parseArgs(['\u001b[31mfake']));
    expect(error.message).toBe('unknown command: \\u001b[31mfake');
    expect(error.message).not.toContain('\u001b');
  });
});

describe.each(VALID_CASES)('$name', ({ argv, command: expectedCommand, options }) => {
  it('parses the command and options', () => {
    const result = command(parseArgs(argv));
    expect(result.command).toBe(expectedCommand);
    expect(result.options).toEqual(options);
  });
});

describe.each(HELP_CASES)('help: $name', ({ argv, command: expectedCommand }) => {
  it('returns a help invocation', () => {
    expect(parsed(parseArgs(argv))).toEqual(
      expectedCommand === undefined ? { kind: 'help' } : { kind: 'help', command: expectedCommand }
    );
  });
});

describe.each(VERSION_CASES)('version: $name', ({ argv }) => {
  it('returns a version invocation', () => {
    expect(parsed(parseArgs(argv))).toEqual({ kind: 'version' });
  });
});

describe.each(INVALID_CASES)('usage error: $name', ({ argv, message }) => {
  it('returns a typed usage error with exit code 2', () => {
    const error = usageError(parseArgs(argv));
    expect(error).toBeInstanceOf(UsageError);
    expect(error.exitCode).toBe(2);
    expect(error.message).toMatch(message);
  });
});
