/**
 * args.ts — pure argument parsing and the CLI command/option model.
 *
 * The parser owns the CLI surface only: it validates command/option
 * combinations and returns a typed invocation or a typed usage error. It never
 * touches the filesystem, the environment, or process exit state; main.ts maps
 * results and errors to exit codes.
 */
import { UsageError } from './errors.js';
import type { Scope } from './scope.js';

export {
  CliError,
  EXIT_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  type ExitCode,
  OperationalError,
  UsageError,
} from './errors.js';

/** Source channel for the `dh` MCP package spec. */
type McpSource = 'npm' | 'github';

/** Supported subcommands, in help order. */
export const COMMANDS = ['install', 'status', 'uninstall'] as const;
export type CommandName = (typeof COMMANDS)[number];

/** Validated options for a command invocation. Unsupported flags never land here. */
export interface CommandOptions {
  readonly scope?: Scope;
  readonly path?: string;
  readonly yes: boolean;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly noMcp: boolean;
  readonly mcpOnly: boolean;
  readonly json: boolean;
  readonly mcpPackage?: string;
  readonly mcpSource?: McpSource;
}

export interface CommandInvocation {
  readonly kind: 'command';
  readonly command: CommandName;
  readonly options: CommandOptions;
}

interface HelpInvocation {
  readonly kind: 'help';
  readonly command?: CommandName;
}

interface VersionInvocation {
  readonly kind: 'version';
}

export type Invocation = CommandInvocation | HelpInvocation | VersionInvocation;

export type ParseResult =
  | { readonly ok: true; readonly invocation: Invocation }
  | { readonly ok: false; readonly error: UsageError };

type BooleanKey = 'global' | 'project' | 'yes' | 'dryRun' | 'force' | 'noMcp' | 'mcpOnly' | 'json';
type ValueKey = 'path' | 'mcpPackage' | 'mcpSource';

interface BooleanOptionSpec {
  readonly flags: readonly [string, ...string[]];
  readonly key: BooleanKey;
  readonly kind: 'boolean';
  readonly commands: readonly CommandName[];
}

interface ValueOptionSpec {
  readonly flags: readonly [string, ...string[]];
  readonly key: ValueKey;
  readonly kind: 'value';
  readonly commands: readonly CommandName[];
}

type OptionSpec = BooleanOptionSpec | ValueOptionSpec;

/**
 * The option table is the single source of truth for parsing and per-command
 * validation. Help/version short-circuit before the command check.
 */
const OPTIONS: readonly OptionSpec[] = [
  { flags: ['--global'], key: 'global', kind: 'boolean', commands: COMMANDS },
  { flags: ['--project'], key: 'project', kind: 'boolean', commands: COMMANDS },
  { flags: ['--path'], key: 'path', kind: 'value', commands: COMMANDS },
  { flags: ['--yes'], key: 'yes', kind: 'boolean', commands: ['install', 'uninstall'] },
  { flags: ['--dry-run'], key: 'dryRun', kind: 'boolean', commands: ['install', 'uninstall'] },
  { flags: ['--force'], key: 'force', kind: 'boolean', commands: ['install', 'uninstall'] },
  { flags: ['--no-mcp'], key: 'noMcp', kind: 'boolean', commands: ['install'] },
  { flags: ['--mcp-only'], key: 'mcpOnly', kind: 'boolean', commands: ['install', 'uninstall'] },
  { flags: ['--json'], key: 'json', kind: 'boolean', commands: COMMANDS },
  { flags: ['--mcp-package'], key: 'mcpPackage', kind: 'value', commands: COMMANDS },
  { flags: ['--mcp-source'], key: 'mcpSource', kind: 'value', commands: COMMANDS },
];

const OPTION_BY_FLAG = new Map<string, OptionSpec>(
  OPTIONS.flatMap((spec) => spec.flags.map((flag) => [flag, spec] as const))
);

interface InternalOptions {
  global: boolean;
  project: boolean;
  path?: string;
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  noMcp: boolean;
  mcpOnly: boolean;
  json: boolean;
  mcpPackage?: string;
  mcpSource?: McpSource;
}

interface ParseState {
  command?: CommandName;
  options: InternalOptions;
  provided: OptionSpec[];
}

function initialOptions(): InternalOptions {
  return {
    global: false,
    project: false,
    yes: false,
    dryRun: false,
    force: false,
    noMcp: false,
    mcpOnly: false,
    json: false,
  };
}

/**
 * Escape control and non-ASCII argv text for deterministic ASCII diagnostics.
 * Printable ASCII is returned unchanged; everything else becomes a visible
 * `\uXXXX` escape so terminal sequences or forged log lines cannot pass through.
 */
export function sanitizeToken(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return `\\u${code.toString(16).padStart(4, '0')}`;
  });
}

function isCommand(token: string): token is CommandName {
  return (COMMANDS as readonly string[]).includes(token);
}

/**
 * npx forwards a leading `--` unchanged, but it is a separator, not a
 * subcommand. Drop leading separators so `dev-harness -- install --global`
 * behaves like the direct form; later separators still end option parsing.
 */
function stripLeadingSeparators(argv: readonly string[]): readonly string[] {
  let start = 0;
  while (argv[start] === '--') start += 1;
  return start === 0 ? argv : argv.slice(start);
}

function assignValue(options: InternalOptions, spec: ValueOptionSpec, value: string, flag: string): void {
  if (options[spec.key] !== undefined) throw new UsageError(`option ${flag} specified more than once`);
  if (spec.key === 'path') {
    options.path = value;
    return;
  }
  if (spec.key === 'mcpPackage') {
    options.mcpPackage = value;
    return;
  }
  if (value !== 'npm' && value !== 'github') {
    throw new UsageError(`invalid value for ${flag}: ${JSON.stringify(value)} (expected "npm" or "github")`);
  }
  options.mcpSource = value;
}

/** Consume one option at `index` and return the next unread index. */
function parseOption(args: readonly string[], index: number, state: ParseState): number {
  const token = args[index] ?? '';
  const separator = token.indexOf('=');
  const flag = separator === -1 ? token : token.slice(0, separator);
  const spec = OPTION_BY_FLAG.get(flag);
  if (spec === undefined) throw new UsageError(`unknown option: ${sanitizeToken(flag)}`);
  if (spec.kind === 'boolean') {
    if (separator !== -1) throw new UsageError(`option ${flag} does not take a value`);
    state.options[spec.key] = true;
    state.provided.push(spec);
    return index + 1;
  }
  const inline = separator === -1 ? undefined : token.slice(separator + 1);
  const value = inline ?? args[index + 1];
  if (value === undefined || value === '' || (inline === undefined && value.startsWith('-'))) {
    throw new UsageError(`option ${flag} requires a value`);
  }
  assignValue(state.options, spec, value, flag);
  state.provided.push(spec);
  return inline === undefined ? index + 2 : index + 1;
}

function toCommandOptions(options: InternalOptions): CommandOptions {
  return {
    ...(options.project ? { scope: 'project' as const } : options.global ? { scope: 'global' as const } : {}),
    ...(options.path === undefined ? {} : { path: options.path }),
    ...(options.mcpPackage === undefined ? {} : { mcpPackage: options.mcpPackage }),
    ...(options.mcpSource === undefined ? {} : { mcpSource: options.mcpSource }),
    yes: options.yes,
    dryRun: options.dryRun,
    force: options.force,
    noMcp: options.noMcp,
    mcpOnly: options.mcpOnly,
    json: options.json,
  };
}

function finish(state: ParseState): Invocation {
  const { command, options } = state;
  if (command === undefined) {
    if (state.provided.length > 0) throw new UsageError('missing command (expected: install, status, uninstall)');
    return { kind: 'help' };
  }
  for (const spec of state.provided) {
    if (!spec.commands.includes(command)) {
      throw new UsageError(`option ${spec.flags[0]} is not supported by "${command}"`);
    }
  }
  if (options.global && options.project) throw new UsageError('--global and --project are mutually exclusive');
  if (options.path !== undefined && !options.project) throw new UsageError('--path requires --project');
  if (options.noMcp && options.mcpOnly) throw new UsageError('--no-mcp and --mcp-only are mutually exclusive');
  if (options.mcpPackage !== undefined && options.mcpSource !== undefined) {
    throw new UsageError('--mcp-package and --mcp-source are mutually exclusive');
  }
  if (options.noMcp && options.mcpPackage !== undefined) {
    throw new UsageError('--no-mcp cannot be combined with --mcp-package');
  }
  if (options.noMcp && options.mcpSource !== undefined) {
    throw new UsageError('--no-mcp cannot be combined with --mcp-source');
  }
  return { kind: 'command', command, options: toCommandOptions(options) };
}

function parse(argv: readonly string[]): Invocation {
  const args = stripLeadingSeparators(argv);
  const state: ParseState = { options: initialOptions(), provided: [] };
  let index = 0;
  let endOfOptions = false;

  while (index < args.length) {
    const token = args[index];
    if (token === undefined) break;
    if (!endOfOptions && token === '--') {
      endOfOptions = true;
      index += 1;
      continue;
    }
    if (!endOfOptions && (token === '--help' || token === '-h')) {
      return state.command === undefined ? { kind: 'help' } : { kind: 'help', command: state.command };
    }
    if (!endOfOptions && (token === '--version' || token === '-v')) return { kind: 'version' };
    if (!endOfOptions && token.startsWith('-') && token !== '-') {
      index = parseOption(args, index, state);
      continue;
    }
    if (state.command === undefined) {
      if (!isCommand(token)) throw new UsageError(`unknown command: ${sanitizeToken(token)}`);
      state.command = token;
      index += 1;
      continue;
    }
    throw new UsageError(`unexpected argument: ${sanitizeToken(token)}`);
  }

  return finish(state);
}

/**
 * Parse argv without the node/script entries. Usage problems never throw:
 * they come back as `{ ok: false, error }` with exit code 2.
 */
export function parseArgs(argv: readonly string[]): ParseResult {
  try {
    return { ok: true, invocation: parse(argv) };
  } catch (err) {
    if (err instanceof UsageError) return { ok: false, error: err };
    throw err;
  }
}
