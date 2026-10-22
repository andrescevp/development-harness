/**
 * command-scope.ts — shared scope selection and path resolution for commands.
 *
 * Flags always win over the prompt; prompting requires both TTYs and caller
 * permission (`--json` forbids it); non-interactive runs get the standard
 * usage error. Commands share this one contract instead of duplicating the
 * prompt/path-resolution flow.
 */
import type { CommandOptions } from './args.js';
import { promptForScope, type ScopePromptDependencies } from './prompt.js';
import { type InstallScope, resolveInstallScope, type Scope } from './scope.js';

/** Process/environment inputs shared by scope-aware commands. */
export interface ScopeResolutionDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  readonly home?: string;
  readonly isDirectory?: (candidate: string) => boolean;
  readonly inputIsTTY?: boolean;
  readonly outputIsTTY?: boolean;
  readonly createReader?: ScopePromptDependencies['createReader'];
}

async function resolveScopeName(options: CommandOptions, deps: ScopeResolutionDeps): Promise<Scope> {
  if (options.scope !== undefined) return options.scope;
  return promptForScope({
    promptAllowed: !options.json,
    inputIsTTY: deps.inputIsTTY ?? process.stdin.isTTY === true,
    outputIsTTY: deps.outputIsTTY ?? process.stdout.isTTY === true,
    ...(deps.createReader === undefined ? {} : { createReader: deps.createReader }),
  });
}

/** Resolve the scope from flags/prompt and turn it into absolute command paths. */
export async function resolveCommandScope(options: CommandOptions, deps: ScopeResolutionDeps): Promise<InstallScope> {
  const scope = await resolveScopeName(options, deps);
  return resolveInstallScope({
    scope,
    ...(options.path === undefined ? {} : { path: options.path }),
    ...(deps.env === undefined ? {} : { env: deps.env }),
    ...(deps.cwd === undefined ? {} : { cwd: deps.cwd }),
    ...(deps.home === undefined ? {} : { home: deps.home }),
    ...(deps.isDirectory === undefined ? {} : { isDirectory: deps.isDirectory }),
  });
}
