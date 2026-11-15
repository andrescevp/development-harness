/**
 * activity-adapter.test.ts — allowlisted field picking and privacy redaction
 * for host events (progress-contract §8.2, §10).
 */
import { describe, expect, it } from 'vitest';
import { ACTIVITY_EVENT_TYPES, toActivityPayload } from '../activity-adapter.js';

const AT = 1_763_000_000_000; // 2025-11-11T…Z, stable fixture timestamp
const AT_ISO = new Date(AT).toISOString();

function raw(type: string, data: unknown, extra: Record<string, unknown> = {}) {
  return { type, created: AT, data, ...extra };
}

describe('toActivityPayload — session status', () => {
  it('maps busy/idle and drops the provider message', () => {
    const busy = toActivityPayload(
      raw('session.status', {
        sessionID: 'ses_1',
        status: { type: 'busy', message: 'provider secret', error: { message: 'nope' } },
      })
    );
    expect(busy).toEqual({
      event: { type: 'session.status', sessionID: 'ses_1', status: 'busy', at: AT_ISO },
      directory: null,
    });

    const idle = toActivityPayload(raw('session.status', { sessionID: 'ses_1', status: { type: 'idle' } }));
    expect(idle?.event).toEqual({ type: 'session.status', sessionID: 'ses_1', status: 'idle', at: AT_ISO });
  });

  it('keeps only the retry attempt', () => {
    const payload = toActivityPayload(
      raw('session.status', {
        sessionID: 'ses_1',
        status: { type: 'retry', attempt: 3, message: 'rate limited', next: 'later' },
      })
    );
    expect(payload?.event).toEqual({
      type: 'session.status',
      sessionID: 'ses_1',
      status: 'retry',
      attempt: 3,
      at: AT_ISO,
    });
    expect(JSON.stringify(payload)).not.toContain('rate limited');
  });

  it('ignores unknown status kinds', () => {
    expect(toActivityPayload(raw('session.status', { sessionID: 'ses_1', status: { type: 'weird' } }))).toBeNull();
  });
});

describe('toActivityPayload — lifecycle and agent events', () => {
  it('maps idle, retry.scheduled and execution events', () => {
    expect(toActivityPayload(raw('session.idle', { sessionID: 'ses_1' }))?.event).toEqual({
      type: 'session.idle',
      sessionID: 'ses_1',
      at: AT_ISO,
    });
    expect(
      toActivityPayload(raw('session.retry.scheduled', { sessionID: 'ses_1', attempt: 2, error: 'x' }))?.event
    ).toEqual({
      type: 'session.retry.scheduled',
      sessionID: 'ses_1',
      attempt: 2,
      at: AT_ISO,
    });
    expect(toActivityPayload(raw('session.execution.started', { sessionID: 'ses_1' }))?.event.type).toBe(
      'session.execution.started'
    );
    for (const type of ['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted']) {
      expect(toActivityPayload(raw(type, { sessionID: 'ses_1' }))?.event.type).toBe(type);
    }
  });

  it('maps the selected agent by id only', () => {
    const payload = toActivityPayload(
      raw('session.agent.selected', { sessionID: 'ses_1', agent: 'dh-software-engineer' })
    );
    expect(payload?.event).toEqual({
      type: 'session.agent.selected',
      sessionID: 'ses_1',
      agent: 'dh-software-engineer',
      at: AT_ISO,
    });
  });
});

describe('toActivityPayload — tool events', () => {
  it('keeps the tool name and drops input payloads', () => {
    const payload = toActivityPayload(
      raw('session.tool.input.started', {
        sessionID: 'ses_1',
        assistantMessageID: 'msg_1',
        id: 'tool_1',
        name: 'edit',
        input: { file: '/secret/path', content: 'token=abc' },
      })
    );
    expect(payload?.event).toEqual({
      type: 'session.tool.input.started',
      sessionID: 'ses_1',
      id: 'tool_1',
      name: 'edit',
      at: AT_ISO,
    });
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('keeps only the id for tool completion events', () => {
    for (const type of ['session.tool.success', 'session.tool.failed']) {
      const payload = toActivityPayload(
        raw(type, { sessionID: 'ses_1', id: 'tool_1', content: 'output', error: 'boom', metadata: { secret: true } })
      );
      expect(payload?.event).toEqual({ type, sessionID: 'ses_1', id: 'tool_1', at: AT_ISO });
      expect(JSON.stringify(payload)).not.toContain('output');
    }
  });
});

describe('toActivityPayload — guards', () => {
  it('ignores message/progress/permission events', () => {
    for (const type of [
      'session.text.delta',
      'session.message.content.updated',
      'session.tool.called',
      'session.tool.progress',
      'session.skill.activated',
      'permission.asked',
      'form.created',
    ]) {
      expect(toActivityPayload(raw(type, { sessionID: 'ses_1' }))).toBeNull();
    }
  });

  it('requires a session id and the event-specific fields', () => {
    expect(toActivityPayload(raw('session.idle', {}))).toBeNull();
    expect(toActivityPayload(raw('session.agent.selected', { sessionID: 'ses_1' }))).toBeNull();
    expect(toActivityPayload(raw('session.tool.input.started', { sessionID: 'ses_1', id: 'tool_1' }))).toBeNull();
    expect(toActivityPayload(raw('session.tool.success', { sessionID: 'ses_1' }))).toBeNull();
    expect(toActivityPayload(raw('session.retry.scheduled', { sessionID: 'ses_1' }))).toBeNull();
  });

  it('propagates the event location directory', () => {
    const payload = toActivityPayload(
      raw('session.idle', { sessionID: 'ses_1' }, { location: { directory: '/repo' } })
    );
    expect(payload?.directory).toBe('/repo');
  });

  it('omits `at` when the host did not publish a created timestamp', () => {
    const payload = toActivityPayload({ type: 'session.idle', data: { sessionID: 'ses_1' } });
    expect(payload?.event.at).toBeUndefined();
  });

  it('subscribes to exactly the allowlisted types', () => {
    expect(ACTIVITY_EVENT_TYPES).toHaveLength(11);
    expect(ACTIVITY_EVENT_TYPES).not.toContain('session.text.delta');
    expect(ACTIVITY_EVENT_TYPES).not.toContain('session.tool.called');
  });
});
