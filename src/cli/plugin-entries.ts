/**
 * plugin-entries.ts — pure detection of `opencode plugin add` entries.
 *
 * OpenCode owns the config `plugins` array, so this module only reads it: it
 * returns the specifiers that resolve to this package through either channel
 * (npm name with optional tag, GitHub shorthand, or a GitHub Git URL). Invalid
 * JSONC or a non-array `plugins` value yields no matches; callers validate the
 * config before writing. Nothing here touches disk or mutates the text.
 */
import { getAtPath } from './jsonc.js';

/** OpenCode config key listing plugin specifiers. */
const PLUGINS_CONFIG_KEY = 'plugins';
/** npm package name shipped by this repository. */
const PACKAGE_NAME = 'dev-harness-skills';
/** GitHub repository (owner/name) used by the Git channel. */
const GITHUB_REPOSITORY = 'andrescevp/development-harness';

const NPM_PROTOCOL_PREFIX = 'npm:';
const GITHUB_PROTOCOL_PREFIX = 'github:';
const GIT_PROTOCOL_PREFIX = 'git+';
const GIT_SCP_PREFIX = 'git@github.com:';
const GITHUB_HOSTS: ReadonlySet<string> = new Set(['github.com', 'www.github.com']);
const GIT_SUFFIX = /\.git$/i;

/** Repository path without protocol, ref, trailing slash, or `.git`, lowercased. */
function normalizeRepositoryPath(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '').replace(GIT_SUFFIX, '').toLowerCase();
}

/** True for the npm spec in any tagged form this repository can be installed under. */
function isNpmSpecifier(specifier: string): boolean {
  const name = specifier.startsWith(NPM_PROTOCOL_PREFIX) ? specifier.slice(NPM_PROTOCOL_PREFIX.length) : specifier;
  return name === PACKAGE_NAME || name.startsWith(`${PACKAGE_NAME}@`);
}

/**
 * Repository path for a GitHub shorthand, scp-style Git address, Git URL, or
 * bare `owner/name`; `undefined` when the specifier is not Git-based.
 */
function gitRepositoryPath(specifier: string): string | undefined {
  const lower = specifier.toLowerCase();
  if (lower.startsWith(GITHUB_PROTOCOL_PREFIX)) {
    const target = specifier.slice(GITHUB_PROTOCOL_PREFIX.length).split('#')[0] ?? '';
    return normalizeRepositoryPath(target) || undefined;
  }
  if (lower.startsWith(GIT_SCP_PREFIX)) {
    return normalizeRepositoryPath(specifier.slice(GIT_SCP_PREFIX.length)) || undefined;
  }

  const withoutGitPrefix = lower.startsWith(GIT_PROTOCOL_PREFIX)
    ? specifier.slice(GIT_PROTOCOL_PREFIX.length)
    : specifier;
  let url: URL;
  try {
    url = new URL(withoutGitPrefix);
  } catch {
    // A bare `owner/name` has no protocol; anything else is not a Git spec.
    return lower.includes('://') ? undefined : normalizeRepositoryPath(specifier) || undefined;
  }
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return undefined;
  return normalizeRepositoryPath(url.pathname) || undefined;
}

/** True when a specifier loads this package through npm or GitHub. */
export function isThisPackageSpecifier(specifier: string): boolean {
  const trimmed = specifier.trim();
  if (trimmed === '') return false;
  return isNpmSpecifier(trimmed) || gitRepositoryPath(trimmed) === GITHUB_REPOSITORY;
}

/**
 * Matching specifiers from the config `plugins` array, in config order and
 * verbatim (duplicates included). A missing/invalid document or a non-array
 * value returns an empty list instead of throwing.
 */
export function findPluginEntries(text: string): readonly string[] {
  const result = getAtPath(text, [PLUGINS_CONFIG_KEY]);
  if (!result.ok || !Array.isArray(result.value)) return [];
  return result.value.filter((entry): entry is string => typeof entry === 'string' && isThisPackageSpecifier(entry));
}

/** One-line duplicate-load diagnostic; safe for stderr and JSON issues. */
export function describeDuplicateLoad(entries: readonly string[]): string {
  const list = entries.length === 0 ? 'this package' : entries.join(', ');
  return (
    `the config ${JSON.stringify(PLUGINS_CONFIG_KEY)} array already loads this plugin (${list}); ` +
    'an opencode plugin add entry and a managed copy would load it twice; use --mcp-only or remove one channel'
  );
}
