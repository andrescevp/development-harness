/**
 * tool-results.ts — shared MCP result/guard helpers.
 *
 * Handlers stay thin adapters: helpers serialize payloads and map thrown
 * values onto the MCP error-result contract. stdout is the protocol channel
 * over stdio, so nothing here logs.
 */
import type { CallToolResult } from '@modelcontextprotocol/server';

/** Serialize a tool payload into the MCP text-content result contract. */
export function textResult(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

/** MCP error-result contract (parity error messages survive verbatim). */
function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Map a thrown value onto the MCP error-result contract. */
function toErrorResult(err: unknown): CallToolResult {
  return errorResult(err instanceof Error ? err.message : String(err));
}

/**
 * Run a synchronous tool body, mapping thrown helper errors to `isError`.
 * Synchronous on purpose: read-modify-write bodies keep no `await` between
 * their read and atomic write. The SDK also maps handler throws to this shape;
 * the guard keeps the parity contract explicit and SDK-independent.
 */
export function guarded(body: () => CallToolResult): CallToolResult {
  try {
    return body();
  } catch (err) {
    return toErrorResult(err);
  }
}

/** Async-safe variant of `guarded` for handlers delegating to async helpers. */
export async function guardedAsync(body: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body();
  } catch (err) {
    return toErrorResult(err);
  }
}
