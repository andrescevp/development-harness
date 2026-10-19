/**
 * workspace.ts — workspace-root resolution for the MCP server (R4).
 *
 * Lexical only: never touches the filesystem and never returns an empty root
 * (a blank cwd throws); `resolvePlanPath` keeps its own guard for direct
 * callers such as `plugin.ts`.
 */
import path from 'node:path';

/** Absolute path to the workspace a server instance is anchored on. */
export type WorkspaceRoot = string;

export interface ResolveWorkspaceRootOptions {
  /** Environment map (default: `process.env`, read at call time). */
  env?: Record<string, string | undefined>;
  /** Resolution base (default: `process.cwd()`, read at call time). */
  cwd?: string;
}

/**
 * Resolve the workspace root: `DH_WORKSPACE_ROOT` wins over `cwd`; the
 * override is whitespace-trimmed (human-supplied tolerance; blank → unset)
 * while the cwd is taken verbatim (machine-supplied), and a relative override
 * resolves against that cwd. Defaults (`process.env` / `process.cwd()`) are
 * read at CALL time, never at module load, so tests can inject explicit values.
 */
export function resolveWorkspaceRoot(options: ResolveWorkspaceRootOptions = {}): WorkspaceRoot {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  // Intentional ordering: a blank cwd throws even with an absolute override
  // (no production impact — process.cwd() is never blank).
  if (!cwd.trim()) throw new Error('no workspace root available: cwd is empty (pass a non-empty cwd)');
  const rawOverride = env.DH_WORKSPACE_ROOT;
  const override = rawOverride?.trim() || undefined;
  return override ? path.resolve(cwd, override) : path.resolve(cwd);
}
