/**
 * logged-command.test.ts — logged command strategy helpers (M: executor
 * directive). Tests the pure string builder (POSIX/Windows), temp-log naming,
 * and the real execution handler with trivial commands (no network, no
 * destructive operations).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLoggedCommand,
  HEAD_LINES,
  runLoggedCommand,
  TAIL_LINES,
  TRUNCATED_MARKER,
  tempLogPath,
} from '../tools/logged-command.js';

describe('tempLogPath', () => {
  it('places logs in the system temp dir with a unique name', () => {
    const p = tempLogPath();
    expect(path.dirname(p)).toBe(os.tmpdir());
    expect(p.endsWith('.log')).toBe(true);
  });

  it('honors a safe custom base name and rejects unsafe ones', () => {
    expect(path.basename(tempLogPath('my-run.log'))).toBe('my-run.log');
    expect(path.dirname(tempLogPath('../evil'))).toBe(os.tmpdir()); // unsafe → generated name
  });
});

describe('buildLoggedCommand (POSIX)', () => {
  const log = '/tmp/exec-abc.log';

  it('wraps the command with redirection, head, TRUNCATED marker, tail and log path', () => {
    const cmd = buildLoggedCommand('./script.sh', log);
    expect(cmd).toContain('./script.sh > "/tmp/exec-abc.log" 2>&1'); // log path quoted for safety
    expect(cmd).toContain(`head -n ${HEAD_LINES}`);
    expect(cmd).toContain(`tail -n ${TAIL_LINES}`);
    expect(cmd).toContain('...[TRUNCATED]...');
    expect(cmd).toContain('log=');
  });
});

describe('runLoggedCommand (real handler)', () => {
  it('returns head/tail + log path for a successful command', async () => {
    const result = await runLoggedCommand({ command: "printf 'line %s\\n' $(seq 1 60)" });
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(path.dirname(result.logPath)).toBe(os.tmpdir());
    expect(fs.existsSync(result.logPath)).toBe(true);
    expect(result.truncated).toBe(true); // 60 lines > 20 + 30
    expect(result.head).toContain('line 1');
    expect(result.tail).toContain('line 60');
    fs.rmSync(result.logPath, { force: true });
  });

  it('reports non-zero exit codes without throwing', async () => {
    const result = await runLoggedCommand({ command: 'echo boom && exit 3' });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(3);
    fs.rmSync(result.logPath, { force: true });
  });

  it('runLoggedCommand is a function and TRUNCATED_MARKER is exported', () => {
    expect(typeof runLoggedCommand).toBe('function');
    expect(TRUNCATED_MARKER).toContain('TRUNCATED');
  });
});
