/**
 * scope.ts — deterministic OpenCode install-scope and path resolution.
 *
 * Resolves the global or project OpenCode config directory and the managed
 * plugin target without writing anything. Paths are absolute, normalized, and
 * kept lexical: symlinks are followed only by the injected directory check, so
 * ownership comparisons never silently change a user's project path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OperationalError } from './errors.js';

/** Install target scope; shared with the argument model. */
export type Scope = 'global' | 'project';

/** Directory name of the managed plugin copy inside `plugins/`. */
export const PLUGIN_DIR_NAME = 'dev-harness-skills';
/** Preferred config file name for both scopes. */
export const CONFIG_FILE_NAME = 'opencode.jsonc';
/** Dotted key of the MCP entry owned by the installer. */
export const MCP_CONFIG_KEY = 'mcp.servers.dh';

/**
 * Everything a command needs to locate installer-owned artifacts. `configDir`
 * is the OpenCode config directory for the scope; a project's actual config
 * file lives at the project root, not inside `.opencode`.
 */
export interface InstallScope {
  readonly scope: Scope;
  readonly configDir: string;
  readonly targetDir: string;
  readonly configPath: string;
  readonly configKey: typeof MCP_CONFIG_KEY;
  /** Lexical absolute project root; present for the project scope only. */
  readonly projectRoot?: string;
}

export interface GlobalConfigDirInput {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly platform?: NodeJS.Platform;
  readonly cwd?: string;
  readonly home?: string;
}

export interface ResolveScopeInput extends GlobalConfigDirInput {
  readonly scope: Scope;
  readonly path?: string;
  /** Directory check injection point; defaults to `fs.statSync`. */
  readonly isDirectory?: (candidate: string) => boolean;
}

type PathApi = typeof path.posix;

/** Platform-specific path semantics keep resolution deterministic under test. */
function pathApi(platform: NodeJS.Platform): PathApi {
  return platform === 'win32' ? path.win32 : path.posix;
}

function nonBlank(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

function defaultIsDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the global OpenCode config directory:
 * `OPENCODE_CONFIG_DIR` -> `XDG_CONFIG_HOME/opencode` -> platform home default.
 * `OPENCODE_CONFIG_DIR` names the config directory itself, matching
 * `scripts/link-dh-global.sh`.
 */
export function resolveGlobalConfigDir(input: GlobalConfigDirInput = {}): string {
  const env = input.env ?? process.env;
  const platform = input.platform ?? process.platform;
  const cwd = input.cwd ?? process.cwd();
  const home = input.home ?? os.homedir();
  const p = pathApi(platform);

  const explicit = nonBlank(env.OPENCODE_CONFIG_DIR);
  if (explicit !== undefined) return p.resolve(cwd, explicit);

  const xdg = nonBlank(env.XDG_CONFIG_HOME);
  if (xdg !== undefined) return p.join(p.resolve(cwd, xdg), 'opencode');

  if (platform === 'win32') {
    const appData = nonBlank(env.APPDATA);
    if (appData !== undefined) return p.join(p.resolve(cwd, appData), 'opencode');
    throw new OperationalError('cannot resolve the global OpenCode config directory: APPDATA is not set');
  }

  const homeDir = nonBlank(home);
  if (homeDir === undefined) {
    throw new OperationalError('cannot resolve the global OpenCode config directory: home directory is unknown');
  }
  return p.join(p.resolve(cwd, homeDir), '.config', 'opencode');
}

/**
 * True when `candidate` is `root` or a descendant of it. Uses `path.relative`
 * so prefix collisions (`/root-other`) and `..` escapes compare correctly;
 * equality counts as contained.
 */
export function isPathWithin(root: string, candidate: string, platform: NodeJS.Platform = process.platform): boolean {
  const p = pathApi(platform);
  const relative = p.relative(p.resolve(root), p.resolve(candidate));
  if (relative === '') return true;
  if (p.isAbsolute(relative)) return false;
  return relative !== '..' && !relative.startsWith(`..${p.sep}`);
}

/** Confinement violation: an installer path resolved outside its scope root. */
export class PathConfinementError extends OperationalError {
  constructor(root: string, candidate: string) {
    super(`path escapes its install root: ${candidate} (root: ${root})`);
  }
}

/** Throw `PathConfinementError` unless `candidate` is confined to `root`. */
export function assertPathWithin(root: string, candidate: string, platform: NodeJS.Platform = process.platform): void {
  if (!isPathWithin(root, candidate, platform)) throw new PathConfinementError(root, candidate);
}

function resolveProjectScope(input: ResolveScopeInput, p: PathApi, platform: NodeJS.Platform): InstallScope {
  const cwd = input.cwd ?? process.cwd();
  const requested = input.path;
  if (requested !== undefined && nonBlank(requested) === undefined) {
    throw new OperationalError('project path must not be empty');
  }

  // `~` expansion is the shell's job; resolve only against cwd and keep the
  // lexical result so a symlinked project is not silently rewritten.
  const projectRoot = p.resolve(cwd, requested ?? '.');
  const isDirectory = input.isDirectory ?? defaultIsDirectory;
  if (!isDirectory(projectRoot)) {
    throw new OperationalError(`project path must be an existing directory: ${projectRoot}`);
  }

  const configDir = p.join(projectRoot, '.opencode');
  const targetDir = p.join(configDir, 'plugins', PLUGIN_DIR_NAME);
  const configPath = p.join(projectRoot, CONFIG_FILE_NAME);
  assertPathWithin(projectRoot, targetDir, platform);
  assertPathWithin(projectRoot, configPath, platform);

  return { scope: 'project', configDir, targetDir, configPath, configKey: MCP_CONFIG_KEY, projectRoot };
}

/**
 * Resolve the managed install paths for a scope. The global branch needs no
 * filesystem access; the project branch stats only the requested project root.
 */
export function resolveInstallScope(input: ResolveScopeInput): InstallScope {
  const platform = input.platform ?? process.platform;
  const p = pathApi(platform);

  if (input.scope === 'global') {
    const configDir = resolveGlobalConfigDir(input);
    const targetDir = p.join(configDir, 'plugins', PLUGIN_DIR_NAME);
    assertPathWithin(configDir, targetDir, platform);
    return {
      scope: 'global',
      configDir,
      targetDir,
      configPath: p.join(configDir, CONFIG_FILE_NAME),
      configKey: MCP_CONFIG_KEY,
    };
  }

  return resolveProjectScope(input, p, platform);
}
