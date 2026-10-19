/**
 * In-memory MCP test harness.
 *
 * Builds the harness server against a fresh temp workspace and connects a real
 * SDK client over a linked transport pair. Setup and teardown are
 * failure-safe: a broken setup never leaks the temp workspace, and `close()` is
 * idempotent (a second call is a no-op).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CallToolResult, ListToolsResult } from '@modelcontextprotocol/client';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { buildServer } from '../../mcp/server.js';

export interface McpTestHarnessOptions {
  /** Seed files/dirs into the temp workspace before the server is built. */
  setup?: (workspaceRoot: string) => void;
}

export interface McpTestHarness {
  /** Temp workspace root the server was built against. */
  workspaceRoot: string;
  /** Raw SDK client, for assertions beyond the convenience wrappers. */
  client: Client;
  listTools: () => Promise<ListToolsResult>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>;
  /** Call a tool and JSON-parse its first text content block. */
  callToolJson: <T = Record<string, unknown>>(name: string, args?: Record<string, unknown>) => Promise<T>;
  /** Close client + server and remove the temp workspace (idempotent). */
  close: () => Promise<void>;
}

const CLIENT_INFO = { name: 'dh-mcp-test-client', version: '0.0.0' } as const;
const SERVER_VERSION = '0.0.0';

/** Start a connected client/server pair anchored on a fresh temp workspace. */
export async function createMcpTestHarness(options: McpTestHarnessOptions = {}): Promise<McpTestHarness> {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-mcp-'));
  let server: ReturnType<typeof buildServer> | undefined;
  let client: Client | undefined;
  let closed = false;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await client?.close();
    } finally {
      try {
        await server?.close();
      } finally {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
      }
    }
  };

  try {
    options.setup?.(workspaceRoot);
    const serverInstance = buildServer({ workspaceRoot, version: SERVER_VERSION });
    server = serverInstance;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    // Server first: the client's initialize request needs the server attached.
    await serverInstance.connect(serverTransport);
    const clientInstance = new Client(CLIENT_INFO);
    client = clientInstance;
    await clientInstance.connect(clientTransport);

    return {
      workspaceRoot,
      client: clientInstance,
      listTools: () => clientInstance.listTools(),
      callTool: (name, args) => clientInstance.callTool({ name, arguments: args }),
      callToolJson: async <T = Record<string, unknown>>(name: string, args?: Record<string, unknown>): Promise<T> => {
        const result = await clientInstance.callTool({ name, arguments: args });
        const block = result.content[0];
        if (block?.type !== 'text') throw new Error(`tool ${name}: expected a text content block`);
        return JSON.parse(block.text) as T;
      },
      close,
    };
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }
}
