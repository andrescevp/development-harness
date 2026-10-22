/**
 * main.test.ts — entry-level behavior for sub-task 1.1: help/version output,
 * command routing through an injected dispatcher, and exit-code mapping.
 */
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMMANDS,
  type CommandName,
  type CommandOptions,
  EXIT_FAILURE,
  EXIT_SUCCESS,
  EXIT_USAGE,
  OperationalError,
} from '../args.js';
import { type CliWriter, runCli } from '../main.js';

class StringWriter implements CliWriter {
  text = '';

  write(chunk: string): boolean {
    this.text += chunk;
    return true;
  }
}

interface DispatchCall {
  command: CommandName;
  options: CommandOptions;
}

function recordingDispatcher(calls: DispatchCall[]): (command: CommandName, options: CommandOptions) => undefined {
  return (command, options) => {
    calls.push({ command, options });
    return undefined;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('help', () => {
  it('prints general help with ASCII-only examples for every command', async () => {
    const stdout = new StringWriter();
    const code = await runCli(['--help'], { stdout, stderr: new StringWriter() });

    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.text).toContain('Usage:');
    expect(stdout.text).toContain('Exit codes:');
    for (const command of COMMANDS) expect(stdout.text).toContain(`npx -y dev-harness-skills ${command}`);
    expect([...stdout.text].every((ch) => ch.charCodeAt(0) < 0x7f)).toBe(true);
  });

  it('prints command-specific help', async () => {
    const stdout = new StringWriter();
    const code = await runCli(['install', '--help'], { stdout, stderr: new StringWriter() });

    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.text).toContain('dev-harness install');
    expect(stdout.text).toContain('--no-mcp');
    expect(stdout.text).toContain('dev-harness install --global');
    expect(stdout.text).not.toContain('dev-harness uninstall');
  });
});

describe('version', () => {
  it('prints an injected version', async () => {
    const stdout = new StringWriter();
    const code = await runCli(['--version'], { stdout, stderr: new StringWriter(), version: '9.9.9' });

    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.text).toBe('9.9.9\n');
  });

  it('reads the package version by default', async () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    const stdout = new StringWriter();
    const code = await runCli(['--version'], { stdout, stderr: new StringWriter() });

    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.text).toBe(`${pkg.version}\n`);
  });

  it('maps an unreadable package.json to an operational failure', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('missing');
    });
    const stderr = new StringWriter();
    const code = await runCli(['--version'], { stdout: new StringWriter(), stderr });

    expect(code).toBe(EXIT_FAILURE);
    expect(stderr.text).toBe('error: cannot read the package version from package.json\n');
  });
});

describe('routing', () => {
  it('routes each command to the dispatcher with parsed options', async () => {
    const calls: DispatchCall[] = [];
    const deps = {
      dispatch: recordingDispatcher(calls),
      stdout: new StringWriter(),
      stderr: new StringWriter(),
    };

    expect(await runCli(['install', '--global'], deps)).toBe(EXIT_SUCCESS);
    expect(await runCli(['status', '--project', '--path', '.', '--json'], deps)).toBe(EXIT_SUCCESS);
    expect(await runCli(['uninstall', '--global', '--dry-run'], deps)).toBe(EXIT_SUCCESS);

    expect(calls.map((call) => call.command)).toEqual(['install', 'status', 'uninstall']);
    expect(calls[0]?.options).toMatchObject({ scope: 'global' });
    expect(calls[1]?.options).toMatchObject({ scope: 'project', path: '.', json: true });
    expect(calls[2]?.options).toMatchObject({ scope: 'global', dryRun: true });
  });

  it('does not dispatch for help, version, or usage errors', async () => {
    let calls = 0;
    const dispatch = (): undefined => {
      calls += 1;
      return undefined;
    };
    const deps = { dispatch, stdout: new StringWriter(), stderr: new StringWriter(), version: '1.0.0' };

    await runCli(['--help'], deps);
    await runCli(['--version'], deps);
    await runCli(['frobnicate'], deps);

    expect(calls).toBe(0);
  });

  it.each(['install', 'status', 'uninstall'] as const)('routes %s to its command by default', async (command) => {
    const stderr = new StringWriter();
    const code = await runCli([command, '--json'], { stdout: new StringWriter(), stderr });

    // Non-interactive JSON mode cannot pick a scope; reaching the command
    // (instead of "not implemented") is the routing contract.
    expect(code).toBe(EXIT_USAGE);
    expect(stderr.text).toContain('no scope selected');
    expect(stderr.text).not.toContain('not implemented');
  });
});

describe('exit codes', () => {
  it('maps usage errors to exit 2 with a help hint on stderr', async () => {
    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const code = await runCli(['frobnicate'], { stdout, stderr });

    expect(code).toBe(EXIT_USAGE);
    expect(stdout.text).toBe('');
    expect(stderr.text).toBe("error: unknown command: frobnicate\nRun 'dev-harness --help' for usage.\n");
  });

  it('maps typed dispatcher failures to exit 1', async () => {
    const stderr = new StringWriter();
    const code = await runCli(['install'], {
      dispatch: () => {
        throw new OperationalError('boom');
      },
      stdout: new StringWriter(),
      stderr,
    });

    expect(code).toBe(EXIT_FAILURE);
    expect(stderr.text).toBe('error: boom\n');
  });

  it('uses a dispatcher exit code when one is returned', async () => {
    const stderr = new StringWriter();
    const code = await runCli(['status'], {
      dispatch: () => EXIT_FAILURE,
      stdout: new StringWriter(),
      stderr,
    });

    expect(code).toBe(EXIT_FAILURE);
    expect(stderr.text).toBe('');
  });

  it('maps untyped dispatcher failures to exit 1', async () => {
    const stderr = new StringWriter();
    const code = await runCli(['install'], {
      dispatch: () => {
        throw new Error('kaboom');
      },
      stdout: new StringWriter(),
      stderr,
    });

    expect(code).toBe(EXIT_FAILURE);
    expect(stderr.text).toBe('error: kaboom\n');
  });
});
