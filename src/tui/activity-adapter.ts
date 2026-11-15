/**
 * activity-adapter.ts — allowlisted field-picking from host events (§8.2).
 *
 * The host payloads carry message bodies, tool input/output, retry provider
 * strings and permission/form data. This adapter is the ONLY place that sees a
 * raw event: it copies the allowlisted fields into `ActivityEvent` and drops
 * everything else, so the mapper can never leak content (R6, §10).
 */
import type { ActivityEvent } from './plan-render-model.js';

/** Structural subset of `OpenCodeEvent` the adapter is allowed to inspect. */
export interface RawActivityEvent {
  readonly type: string;
  readonly created?: unknown;
  readonly location?: { readonly directory?: string } | undefined;
  readonly data?: unknown;
}

export interface ActivityPayload {
  event: ActivityEvent;
  /** Event location directory, when the host published one. */
  directory: string | null;
}

/** Every event type the TUI subscribes to (no message/tool-content events). */
export const ACTIVITY_EVENT_TYPES = [
  'session.status',
  'session.idle',
  'session.retry.scheduled',
  'session.execution.started',
  'session.execution.succeeded',
  'session.execution.failed',
  'session.execution.interrupted',
  'session.agent.selected',
  'session.tool.input.started',
  'session.tool.success',
  'session.tool.failed',
] as const satisfies readonly ActivityEvent['type'][];

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function stringOf(source: Record<string, unknown> | null, key: string): string | null {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOf(source: Record<string, unknown> | null, key: string): number | null {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function atOf(event: RawActivityEvent): string | undefined {
  return typeof event.created === 'number' && Number.isFinite(event.created)
    ? new Date(event.created).toISOString()
    : undefined;
}

/**
 * Project one host event onto the allowlisted activity event, or `null` when it
 * is not an activity signal (unknown type, missing ids, non-string fields).
 */
export function toActivityPayload(event: RawActivityEvent): ActivityPayload | null {
  const data = recordOf(event.data);
  const sessionID = stringOf(data, 'sessionID');
  if (sessionID === null) return null;
  const at = atOf(event);
  const directory = event.location?.directory ?? null;

  switch (event.type) {
    case 'session.status': {
      const status = recordOf(data?.status);
      const kind = stringOf(status, 'type');
      if (kind === 'idle') return { event: { type: 'session.status', sessionID, status: 'idle', at }, directory };
      if (kind === 'busy') return { event: { type: 'session.status', sessionID, status: 'busy', at }, directory };
      if (kind === 'retry') {
        const attempt = numberOf(status, 'attempt');
        return {
          event: { type: 'session.status', sessionID, status: 'retry', ...(attempt === null ? {} : { attempt }), at },
          directory,
        };
      }
      return null;
    }
    case 'session.idle':
      return { event: { type: 'session.idle', sessionID, at }, directory };
    case 'session.retry.scheduled': {
      const attempt = numberOf(data, 'attempt');
      if (attempt === null) return null;
      return { event: { type: 'session.retry.scheduled', sessionID, attempt, at }, directory };
    }
    case 'session.execution.started':
      return { event: { type: 'session.execution.started', sessionID, at }, directory };
    case 'session.execution.succeeded':
    case 'session.execution.failed':
    case 'session.execution.interrupted':
      return { event: { type: event.type, sessionID, at }, directory };
    case 'session.agent.selected': {
      const agent = stringOf(data, 'agent');
      if (agent === null) return null;
      return { event: { type: 'session.agent.selected', sessionID, agent, at }, directory };
    }
    case 'session.tool.input.started': {
      const id = stringOf(data, 'id');
      const name = stringOf(data, 'name');
      if (id === null || name === null) return null;
      return { event: { type: 'session.tool.input.started', sessionID, id, name, at }, directory };
    }
    case 'session.tool.success':
    case 'session.tool.failed': {
      const id = stringOf(data, 'id');
      if (id === null) return null;
      return { event: { type: event.type, sessionID, id, at }, directory };
    }
    default:
      return null;
  }
}
