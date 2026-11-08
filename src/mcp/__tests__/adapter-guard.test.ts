/**
 * adapter-guard.test.ts — unexpected helper throws map to `isError`.
 *
 * The helpers are mocked: the real sheet helpers convert every failure to an
 * `ok: false` payload, and the guard exists for UNEXPECTED throws only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeHarness, connectHarness, textOf } from '../../__tests__/helpers/mcp.js';

vi.mock('../../tools/sheet-tools.js', () => ({
  readSheet: () => Promise.reject(new Error('sheet boom')),
  updateSheet: () => Promise.reject(new Error('sheet boom')),
  sheetSchema: () => Promise.reject(new Error('sheet boom')),
}));

vi.mock('../../tools/logged-command.js', () => ({
  runLoggedCommand: () => Promise.reject(new Error('command boom')),
}));

afterEach(closeHarness);

describe('unexpected helper throws (async guard)', () => {
  it('maps a thrown sheet helper error to isError with the message', async () => {
    const h = await connectHarness();
    const res = await h.callTool('read_sheet', { path: '/tmp/whatever.csv' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('sheet boom');
  });

  it('maps a thrown command helper error to isError with the message', async () => {
    const h = await connectHarness();
    const res = await h.callTool('logged_command', { command: 'true' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('command boom');
  });
});
