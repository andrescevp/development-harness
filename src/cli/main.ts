/**
 * main.ts — CLI entry: parse, route to a command dispatcher, and map typed
 * failures to stable exit codes.
 *
 * Importing this module is side-effect free; the entry runs only as the
 * process main. Command implementations land in later sub-tasks and are
 * injected through `runCli`, so this skeleton owns output and exit policy only.
 */
import { isMainEntry } from '../lib/main-entry.js';
import {
  CliError,
  type CommandName,
  type CommandOptions,
  EXIT_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  type ExitCode,
  parseArgs,
} from './args.js';
import { runInstall } from './commands/install.js';
import { runStatus } from './commands/status.js';
import { runUninstall } from './commands/uninstall.js';
import { resolveCliVersion } from './version.js';

/** Minimal stdout/stderr contract; tests inject string collectors. */
export interface CliWriter {
  write(chunk: string): unknown;
}

/**
 * Executes a parsed command. A returned exit code overrides the default
 * success mapping (status uses this for absence/drift); `undefined` means
 * success.
 */
type CommandDispatcher = (
  command: CommandName,
  options: CommandOptions
) => ExitCode | undefined | Promise<ExitCode | undefined>;

export interface CliDependencies {
  readonly dispatch?: CommandDispatcher;
  readonly stdout?: CliWriter;
  readonly stderr?: CliWriter;
  /** Version override for tests; defaults to the package.json lookup. */
  readonly version?: string;
}

const USAGE_HINT = "Run 'dev-harness --help' for usage.";

const GENERAL_HELP = `dev-harness - install and manage the Dev Harness OpenCode plugin

Usage:
  dev-harness <command> [options]
  dev-harness --help
  dev-harness --version

Commands:
  install     Install the plugin and wire the dh MCP server
  status      Report install and config state
  uninstall   Remove installer-owned files and config

Scope options:
  --global              Use the global OpenCode config
  --project             Use a project (default: the current directory)
  --path <dir>          Project directory (requires --project)

Command options:
  --yes                 Skip confirmation prompts (never selects a scope)
  --dry-run             Report intended changes without writing
  --force               Overwrite conflicting or unmanaged targets
  --no-mcp              Do not wire the dh MCP entry (install only)
  --mcp-only            Only wire or remove the dh MCP entry
  --json                Print machine-readable JSON
  --mcp-package <spec>  Package spec for the dh MCP command
  --mcp-source <src>    MCP source: npm or github

Other:
  -h, --help            Show help (with a command for command help)
  -v, --version         Print the package version

Exit codes:
  0  success
  1  operational failure
  2  usage error

Examples:
  npx -y dev-harness-skills install --global
  npx -y dev-harness-skills install --project --path .
  npx -y dev-harness-skills status --global --json
  npx -y dev-harness-skills uninstall --project --dry-run

Run 'dev-harness <command> --help' for command-specific options.
`;

const INSTALL_HELP = `dev-harness install - install the plugin

Usage:
  dev-harness install [--global | --project [--path <dir>]] [options]

Options:
  --global              Install into the global OpenCode config
  --project             Install into a project (default: current directory)
  --path <dir>          Project directory (requires --project)
  --yes                 Skip confirmation prompts
  --dry-run             Print intended changes without writing
  --force               Overwrite conflicting or unmanaged targets
  --no-mcp              Skip the dh MCP server entry
  --mcp-only            Only wire the dh MCP entry (no plugin copy)
  --json                Print machine-readable JSON
  --mcp-package <spec>  Package spec for the dh MCP command
  --mcp-source <src>    MCP source: npm or github
  -h, --help            Show this help

Exit codes:
  0  success
  1  operational failure
  2  usage error

Examples:
  dev-harness install --global
  dev-harness install --project --path .
  dev-harness install --global --mcp-only --mcp-source github
`;

const STATUS_HELP = `dev-harness status - report install and config state

Usage:
  dev-harness status [--global | --project [--path <dir>]] [--json]

Options:
  --global        Inspect the global OpenCode config
  --project       Inspect a project (default: current directory)
  --path <dir>    Project directory (requires --project)
  --json          Print machine-readable JSON
  --mcp-package <spec>  Package spec to compare against
  --mcp-source <src>    MCP source to compare against: npm or github
  -h, --help      Show this help

Exit codes:
  0  success
  1  operational failure
  2  usage error

Examples:
  dev-harness status --global
  dev-harness status --project --path . --json
`;

const UNINSTALL_HELP = `dev-harness uninstall - remove installer-owned files and config

Usage:
  dev-harness uninstall [--global | --project [--path <dir>]] [options]

Options:
  --global              Use the global OpenCode config
  --project             Use a project (default: current directory)
  --path <dir>          Project directory (requires --project)
  --yes                 Skip confirmation prompts
  --dry-run             Report intended removals without deleting
  --force               Remove a corrupt manifest or differing dh entry
  --mcp-only            Only remove the dh MCP entry
  --json                Print machine-readable JSON
  --mcp-package <spec>  Package spec for the dh MCP command
  --mcp-source <src>    MCP source: npm or github
  -h, --help            Show this help

Exit codes:
  0  success
  1  operational failure
  2  usage error

Examples:
  dev-harness uninstall --global
  dev-harness uninstall --project --path . --dry-run
  dev-harness uninstall --global --mcp-only
`;

const COMMAND_HELP: Record<CommandName, string> = {
  install: INSTALL_HELP,
  status: STATUS_HELP,
  uninstall: UNINSTALL_HELP,
};

function renderHelp(command?: CommandName): string {
  return command === undefined ? GENERAL_HELP : COMMAND_HELP[command];
}

function writeLine(writer: CliWriter, text: string): void {
  writer.write(`${text}\n`);
}

function reportError(stderr: CliWriter, err: unknown): ExitCode {
  writeLine(stderr, `error: ${err instanceof Error ? err.message : String(err)}`);
  return err instanceof CliError ? err.exitCode : EXIT_FAILURE;
}

/** Production dispatcher: every parsed command has an implementation. */
async function dispatchDefault(
  command: CommandName,
  options: CommandOptions,
  version?: string
): Promise<ExitCode | undefined> {
  const deps = version === undefined ? {} : { version };
  switch (command) {
    case 'install':
      await runInstall(options, deps);
      return;
    case 'status':
      return runStatus(options, deps);
    case 'uninstall':
      await runUninstall(options, deps);
      return;
  }
}

/**
 * Run the CLI with injected I/O and dispatcher. Returns the process exit code
 * instead of exiting, so tests and embedders stay in control.
 */
export async function runCli(argv: readonly string[], deps: CliDependencies = {}): Promise<ExitCode> {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const parsed = parseArgs(argv);

  if (!parsed.ok) {
    writeLine(stderr, `error: ${parsed.error.message}`);
    writeLine(stderr, USAGE_HINT);
    return EXIT_USAGE;
  }

  const invocation = parsed.invocation;
  if (invocation.kind === 'help') {
    stdout.write(renderHelp(invocation.command));
    return EXIT_SUCCESS;
  }
  if (invocation.kind === 'version') {
    try {
      writeLine(stdout, deps.version ?? resolveCliVersion());
      return EXIT_SUCCESS;
    } catch (err) {
      return reportError(stderr, err);
    }
  }

  try {
    const dispatch = deps.dispatch ?? ((command, options) => dispatchDefault(command, options, deps.version));
    const code = await dispatch(invocation.command, invocation.options);
    return code ?? EXIT_SUCCESS;
  } catch (err) {
    return reportError(stderr, err);
  }
}

if (isMainEntry(import.meta.url)) {
  void runCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.exitCode = reportError(process.stderr, err);
    }
  );
}
