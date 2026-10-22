/**
 * output.test.ts — human and JSON output conventions for every command.
 *
 * Human steps are command-prefixed, ASCII-sanitized, and go to stdout;
 * diagnostics go to stderr. JSON mode emits exactly one parseable envelope on
 * stdout with the stable `{ ok, command, ...payload }` shape.
 */
import { describe, expect, it } from 'vitest';
import { EXIT_FAILURE, OperationalError } from '../args.js';
import {
  type CommandOutput,
  createOutput,
  formatErrorLine,
  formatHumanLine,
  formatWarningLine,
  jsonEnvelope,
} from '../output.js';

class StringWriter {
  text = '';

  write(chunk: string): boolean {
    this.text += chunk;
    return true;
  }
}

function collector(): CommandOutput & { readonly stdout: StringWriter; readonly stderr: StringWriter } {
  const stdout = new StringWriter();
  const stderr = new StringWriter();
  return Object.assign(createOutput({ command: 'install', json: false, stdout, stderr }), { stdout, stderr });
}

function jsonCollector(): CommandOutput & { readonly stdout: StringWriter; readonly stderr: StringWriter } {
  const stdout = new StringWriter();
  const stderr = new StringWriter();
  return Object.assign(createOutput({ command: 'install', json: true, stdout, stderr }), { stdout, stderr });
}

describe('jsonEnvelope', () => {
  it('emits the stable ok/command/payload shape in order', () => {
    const envelope = jsonEnvelope('install', true, { target: '/home/me/.config/opencode/plugins/dev-harness-skills' });

    expect(envelope).toEqual({
      ok: true,
      command: 'install',
      target: '/home/me/.config/opencode/plugins/dev-harness-skills',
    });
    expect(Object.keys(envelope)).toEqual(['ok', 'command', 'target']);
  });

  it('does not let payload keys override the canonical fields', () => {
    const envelope = jsonEnvelope('status', false, { ok: true, command: 'install', version: '1.0.0' });

    expect(envelope.ok).toBe(false);
    expect(envelope.command).toBe('status');
    expect(envelope.version).toBe('1.0.0');
    expect(Object.keys(envelope)).toEqual(['ok', 'command', 'version']);
  });

  it('does not mutate the payload', () => {
    const payload = { ok: true, target: '/tmp/x' };
    jsonEnvelope('uninstall', true, payload);

    expect(payload).toEqual({ ok: true, target: '/tmp/x' });
  });

  it('supports an empty payload', () => {
    expect(jsonEnvelope('status', true)).toEqual({ ok: true, command: 'status' });
  });
});

describe('human line formatting', () => {
  it('prefixes steps with the command', () => {
    expect(formatHumanLine('install', 'plugin installed')).toBe('install: plugin installed\n');
    expect(formatHumanLine('status', 'installed')).toBe('status: installed\n');
    expect(formatHumanLine('uninstall', 'nothing to do')).toBe('uninstall: nothing to do\n');
  });

  it('escapes control and non-ASCII text so output stays ASCII', () => {
    const line = formatHumanLine('install', 'bad\u001b[31m \u00e9\nnext');

    expect(line).toBe('install: bad\\u001b[31m \\u00e9\\u000anext\n');
    expect(line).not.toContain('\u001b');
    expect([...line].every((char) => char.charCodeAt(0) < 0x7f)).toBe(true);
  });

  it('prefixes warnings with the command and error diagnostics with error:', () => {
    expect(formatWarningLine('status', 'config missing')).toBe('status: warning: config missing\n');
    expect(formatErrorLine('config unreadable')).toBe('error: config unreadable\n');
  });
});

describe('human mode', () => {
  it('writes steps to stdout and nothing to stderr', () => {
    const output = collector();
    output.step('resolved project scope');
    output.step('plugin installed');

    expect(output.stdout.text).toBe('install: resolved project scope\ninstall: plugin installed\n');
    expect(output.stderr.text).toBe('');
  });

  it('escapes untrusted values before writing a step', () => {
    const output = collector();
    output.step('target \u001b[2J/../\u00e9');

    expect(output.stdout.text).toBe('install: target \\u001b[2J/../\\u00e9\n');
    expect([...output.stdout.text].every((char) => char.charCodeAt(0) < 0x7f)).toBe(true);
  });

  it('sends warnings and errors to stderr only', () => {
    const output = collector();
    output.warn('existing dh entry differs; kept');
    output.error('could not write config');

    expect(output.stdout.text).toBe('');
    expect(output.stderr.text).toBe(
      'install: warning: existing dh entry differs; kept\nerror: could not write config\n'
    );
  });

  it('refuses to emit a JSON envelope in human mode', () => {
    const output = collector();

    expect(() => output.emitJson({ target: '/tmp/x' })).toThrow(OperationalError);
    expect(output.stdout.text).toBe('');
  });
});

describe('json mode', () => {
  it('suppresses human step lines and keeps stdout machine-readable', () => {
    const output = jsonCollector();
    output.step('resolved project scope');
    output.emitJson({ target: '/tmp/project' });

    const lines = output.stdout.text.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('');
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      ok: true,
      command: 'install',
      target: '/tmp/project',
    });
  });

  it('emits a failure envelope when ok is false', () => {
    const output = jsonCollector();
    output.emitJson({ reason: 'config conflict' }, { ok: false });

    expect(JSON.parse(output.stdout.text)).toEqual({
      ok: false,
      command: 'install',
      reason: 'config conflict',
    });
  });

  it('writes diagnostics to stderr without touching stdout', () => {
    const output = jsonCollector();
    output.warn('duplicate plugin registration detected');
    output.error('unexpected failure');

    expect(output.stdout.text).toBe('');
    expect(output.stderr.text).toBe(
      'install: warning: duplicate plugin registration detected\nerror: unexpected failure\n'
    );
  });

  it('allows exactly one envelope per output instance', () => {
    const output = jsonCollector();
    output.emitJson({ target: '/tmp/x' });

    expect(() => output.emitJson({ target: '/tmp/y' })).toThrow(/already emitted/);
    expect(output.stdout.text.split('\n').filter((line) => line !== '')).toHaveLength(1);
  });

  it('maps serialization failures to an operational error and keeps stdout empty', () => {
    const output = jsonCollector();

    expect(() => output.emitJson({ value: 1n })).toThrow(OperationalError);
    expect(output.stdout.text).toBe('');
  });

  it('recovers after a serialization failure', () => {
    const output = jsonCollector();
    expect(() => output.emitJson({ value: 1n })).toThrow(OperationalError);
    output.emitJson({ target: '/tmp/x' });

    expect(JSON.parse(output.stdout.text)).toEqual({ ok: true, command: 'install', target: '/tmp/x' });
  });

  it('uses exit-failure typing for contract violations', () => {
    const human = collector();
    const json = jsonCollector();
    json.emitJson({});

    try {
      human.emitJson({});
      throw new Error('expected a failure');
    } catch (err) {
      expect(err).toBeInstanceOf(OperationalError);
      expect((err as OperationalError).exitCode).toBe(EXIT_FAILURE);
    }
  });
});

describe('determinism', () => {
  it('produces identical output for identical input', () => {
    const first = jsonCollector();
    const second = jsonCollector();
    first.emitJson({ target: '/tmp/x', actions: ['plugin', 'config'] });
    second.emitJson({ target: '/tmp/x', actions: ['plugin', 'config'] });

    expect(first.stdout.text).toBe(second.stdout.text);
  });
});
