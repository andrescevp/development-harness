/**
 * adapter-guard.test.ts — unexpected helper throws map to `isError`.
 *
 * The logged-command helper is mocked: the real helper reports command
 * failures in its payload, and the guard exists for UNEXPECTED throws only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeHarness, connectHarness, textOf } from '../../__tests__/helpers/mcp.js';

vi.mock('../../tools/logged-command.js', () => ({
  runLoggedCommand: () => Promise.reject(new Error('command boom')),
}));

afterEach(closeHarness);

describe('unexpected helper throws (async guard)', () => {
  it('maps a thrown command helper error to isError with the message', async () => {
    const h = await connectHarness();
    const res = await h.callTool('logged_command', { command: 'true' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('command boom');
  });
});
