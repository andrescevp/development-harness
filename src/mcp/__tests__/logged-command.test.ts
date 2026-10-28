/**
 * logged-command.test.ts — MCP parity suite for the logged_command adapter.
 *
 * Non-zero exits stay in the normal payload (`ok: false`), never `isError`;
 * only unexpected helper throws become `isError` (pinned in
 * adapter-guard.test.ts).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeHarness, connectHarness, textOf } from '../../__tests__/helpers/mcp.js';
import type { LoggedCommandResult } from '../../tools/logged-command.js';

/** Temp logs created by logged_command calls, drained after each test. */
const logPaths: string[] = [];

afterEach(async () => {
  await closeHarness();
  for (const logPath of logPaths.splice(0)) fs.rmSync(logPath, { force: true });
});

describe('logged_command', () => {
  it('captures a successful command in a real temp log', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<LoggedCommandResult>('logged_command', {
      command: 'node -e "console.log(\'x\')"',
    });
    expect(Object.keys(payload).sort()).toEqual(['exitCode', 'head', 'logPath', 'ok', 'tail', 'truncated']);
    expect(payload.ok).toBe(true);
    expect(payload.exitCode).toBe(0);
    expect(payload.head).toContain('x');
    expect(payload.truncated).toBe(false);
    expect(path.dirname(payload.logPath)).toBe(os.tmpdir());
    expect(fs.existsSync(payload.logPath)).toBe(true);
    logPaths.push(payload.logPath);
  });

  it('reports a failing command in the payload (never isError)', async () => {
    const h = await connectHarness();
    // Shell-level `exit`: a child's non-zero exit is masked by the wrapper's trailing echo.
    // Plan suggested `node -e "process.exit(3)"` — that reports exit 0 (same masking).
    const res = await h.callTool('logged_command', { command: 'echo boom && exit 3' });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(textOf(res)) as LoggedCommandResult;
    expect(payload.ok).toBe(false);
    expect(payload.exitCode).toBe(3);
    expect(payload.logPath).toBeTruthy();
    expect(fs.existsSync(payload.logPath)).toBe(true);
    expect(payload).toHaveProperty('head');
    expect(payload).toHaveProperty('tail');
    expect(payload).toHaveProperty('truncated');
    logPaths.push(payload.logPath);
  });
});
