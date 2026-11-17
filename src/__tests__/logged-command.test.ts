/**
 * logged-command.test.ts — logged command strategy helpers (dh-execute-cli
 * directive). Tests temp-log naming and the real streaming handler, including
 * buffered/background output and stderr.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEAD_LINES, runLoggedCommand, TAIL_LINES, tempLogPath } from '../tools/logged-command.js';

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

describe('runLoggedCommand (real handler)', () => {
  it('logs every stdout line and returns the head/tail window', async () => {
    const result = await runLoggedCommand({ command: "printf 'line %s\\n' $(seq 1 60)" });
    try {
      expect(result.ok).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(path.dirname(result.logPath)).toBe(os.tmpdir());
      expect(result.truncated).toBe(true); // 60 lines > 20 + 30
      expect(result.head).toContain('line 1');
      expect(result.tail).toContain('line 60');
      const log = fs.readFileSync(result.logPath, 'utf8');
      expect(log).toContain('line 1');
      expect(log).toContain('line 60');
      expect(log.split('\n').filter((line) => line.startsWith('line '))).toHaveLength(60);
    } finally {
      fs.rmSync(result.logPath, { force: true });
    }
  });

  it('waits for background-child writes and captures them in the log', async () => {
    if (process.platform === 'win32') return; // POSIX detached-child behavior
    const command = "(sleep 0.12; printf 'late\\n') & printf 'early\\n'";
    const result = await runLoggedCommand({ command });
    try {
      expect(result.ok).toBe(true);
      const log = fs.readFileSync(result.logPath, 'utf8');
      expect(log).toContain('early');
      expect(log).toContain('late');
      expect(result.tail).toContain('late');
    } finally {
      fs.rmSync(result.logPath, { force: true });
    }
  });

  it('captures stderr without leaking it to the caller', async () => {
    const result = await runLoggedCommand({ command: 'node -e "console.error(\'err-line\'); process.exit(1)"' });
    try {
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(fs.readFileSync(result.logPath, 'utf8')).toContain('err-line');
    } finally {
      fs.rmSync(result.logPath, { force: true });
    }
  });

  it('reports non-zero exit codes without throwing', async () => {
    const result = await runLoggedCommand({ command: 'echo boom && exit 3' });
    try {
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(3);
    } finally {
      fs.rmSync(result.logPath, { force: true });
    }
  });

  it('times out with a 124 exit code instead of hanging', async () => {
    const command = process.platform === 'win32' ? 'powershell -Command "Start-Sleep -Seconds 5"' : 'sleep 5';
    const result = await runLoggedCommand({ command, timeoutMs: 80 });
    try {
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(124);
      expect(result.error).toMatch(/timed out/);
    } finally {
      fs.rmSync(result.logPath, { force: true });
    }
  });

  it('keeps the constants exported for log-window consumers', () => {
    expect(HEAD_LINES).toBe(20);
    expect(TAIL_LINES).toBe(30);
  });
});
