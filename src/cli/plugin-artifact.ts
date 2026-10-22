/**
 * plugin-artifact.ts — materialize the self-contained managed plugin layout.
 *
 * `buildStagedPlugin` resolves the running package root, verifies the built
 * `dist/plugin.js` + `dist/assets`, copies only what the plugin needs into a
 * staging sibling of the final target, and writes the `index.ts` / package.json
 * shims plus the install manifest. The staged bundle is imported before it is
 * accepted, so a broken artifact can never be swapped into place. Any failure
 * removes the staging directory; committing the swap belongs to the caller.
 */
import crypto from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileAtomic } from '../lib/atomic-write.js';
import { findPackageRoot, PACKAGE_NAME } from '../lib/package-meta.js';
import { scanBareSpecifiers } from './bundle-scan.js';
import { OperationalError } from './errors.js';
import { copyTree, removePath, stageDirectory } from './fs-utils.js';
import {
  createManifest,
  type InstallManifest,
  MANIFEST_FILE_NAME,
  manifestPathFor,
  renderManifest,
} from './manifest.js';
import type { Scope } from './scope.js';

export { scanBareSpecifiers } from './bundle-scan.js';

/** Harness corpus guaranteed by the managed layout. */
export const EXPECTED_AGENT_COUNT = 7;
export const EXPECTED_SKILL_COUNT = 17;

const BUNDLE_FILE = 'plugin.js';
const ASSETS_DIR = 'assets';
const INDEX_FILE = 'index.ts';
const PACKAGE_FILE = 'package.json';
const INDEX_SHIM =
  "// Managed by dev-harness-skills; regenerated on install.\nexport { default } from './dist/plugin.js';\n";

/** Inputs for {@link buildStagedPlugin}; `packageRoot` is a test seam only. */
export interface BuildStagedPluginInput {
  /** Final absolute managed plugin directory (not yet created). */
  readonly targetDir: string;
  readonly version: string;
  /** npm or GitHub spec the install came from. */
  readonly source: string;
  readonly scope: Scope;
  readonly config: { readonly path: string; readonly fingerprint?: unknown };
  /** Override the running package root (fixtures/tests). */
  readonly packageRoot?: string;
}

/** A verified staging directory plus the manifest for the final target. */
export interface StagedPlugin {
  readonly stagingDir: string;
  readonly targetDir: string;
  readonly manifest: InstallManifest;
  /** Managed files as sorted POSIX paths relative to `stagingDir`. */
  readonly files: readonly string[];
}

/** Agent/skill counts found under one assets root. */
interface AssetCounts {
  readonly agents: number;
  readonly skills: number;
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : String(error);
}

function requireAbsoluteTarget(targetDir: string): string {
  if (targetDir.trim() === '') {
    throw new OperationalError('cannot materialize the plugin: target directory must not be blank');
  }
  if (!path.isAbsolute(targetDir)) {
    throw new OperationalError(`cannot materialize the plugin: target directory must be absolute: ${targetDir}`);
  }
  return path.resolve(targetDir);
}

/** Fail early when running from a source checkout without a build. */
function requireBuiltLayout(packageRoot: string): { bundle: string; assets: string } {
  const bundle = path.join(packageRoot, 'dist', BUNDLE_FILE);
  const assets = path.join(packageRoot, 'dist', ASSETS_DIR);
  if (!isFile(bundle)) {
    throw new OperationalError(
      `cannot materialize the plugin: ${bundle} is missing; build the package first (pnpm build) or install from the published package`
    );
  }
  if (!isDirectory(assets)) {
    throw new OperationalError(
      `cannot materialize the plugin: ${assets} is missing; build the package assets first (pnpm build)`
    );
  }
  return { bundle, assets };
}

function readEntries(directory: string): Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Count agent markdown files and skill directories with a SKILL.md. */
function countAssets(assetsRoot: string): AssetCounts {
  const agentsDir = path.join(assetsRoot, 'agents');
  const skillsDir = path.join(assetsRoot, 'skills');
  const agents = readEntries(agentsDir).filter((entry) => entry.isFile() && entry.name.endsWith('.md')).length;
  const skills = readEntries(skillsDir).filter(
    (entry) => entry.isDirectory() && isFile(path.join(skillsDir, entry.name, 'SKILL.md'))
  ).length;
  return { agents, skills };
}

/**
 * Require the fixed harness corpus. `source` is supplied when checking the
 * staged copy so the error reports both source and target counts.
 */
function assertAssetCounts(assetsRoot: string, source?: AssetCounts): AssetCounts {
  const counts = countAssets(assetsRoot);
  if (counts.agents === EXPECTED_AGENT_COUNT && counts.skills === EXPECTED_SKILL_COUNT) return counts;

  const expected = `expected ${EXPECTED_AGENT_COUNT} agent files and ${EXPECTED_SKILL_COUNT} skill directories`;
  const found = `found ${counts.agents} agents and ${counts.skills} skills in ${assetsRoot}`;
  const origin = source === undefined ? '' : ` (source: ${source.agents} agents, ${source.skills} skills)`;
  throw new OperationalError(`cannot materialize the plugin: ${expected}, ${found}${origin}`);
}

async function assertSelfContained(bundle: string): Promise<void> {
  let source: string;
  try {
    source = await fs.promises.readFile(bundle, 'utf8');
  } catch (err) {
    throw new OperationalError(`cannot read the plugin bundle ${bundle}`, { cause: err });
  }
  const bare = scanBareSpecifiers(source);
  if (bare.length > 0) {
    const list = bare.map((specifier) => `"${specifier}"`).join(', ');
    throw new OperationalError(
      `plugin bundle ${bundle} is not self-contained: bare import(s) ${list}; only Node builtins and relative/absolute paths are allowed`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Import the staged bundle exactly like OpenCode would and assert its shape. */
async function importStagedBundle(bundle: string): Promise<void> {
  const url = `${pathToFileURL(bundle).href}?staging=${crypto.randomUUID()}`;
  let module: unknown;
  try {
    module = await import(url);
  } catch (err) {
    throw new OperationalError(`cannot import the staged plugin bundle ${bundle}: ${describeError(err)}`, {
      cause: err,
    });
  }

  const plugin = isRecord(module) ? module.default : undefined;
  const id = isRecord(plugin) ? plugin.id : undefined;
  const setup = isRecord(plugin) ? plugin.setup : undefined;
  if (typeof id !== 'string' || id.trim() === '' || typeof setup !== 'function') {
    throw new OperationalError(
      `the staged plugin bundle ${bundle} must export a default plugin definition with a non-empty id and a setup function`
    );
  }
}

/** Sorted managed files as POSIX-relative paths (the manifest is not managed). */
async function listManagedFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = `${prefix}${entry.name}`;
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new OperationalError(`refusing to manage a symbolic link: ${absolute}`);
    if (entry.isDirectory()) {
      files.push(...(await listManagedFiles(absolute, `${relative}/`)));
      continue;
    }
    if (entry.isFile() && relative !== MANIFEST_FILE_NAME) files.push(relative);
  }
  return files;
}

function renderPackageJson(version: string): string {
  const metadata = {
    name: PACKAGE_NAME,
    version,
    private: true,
    type: 'module',
    main: `./dist/${BUNDLE_FILE}`,
    exports: { '.': `./dist/${BUNDLE_FILE}` },
  };
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

async function cleanupStaging(stagingDir: string): Promise<void> {
  try {
    await removePath(stagingDir);
  } catch {
    // Best effort: the original failure is the actionable error.
  }
}

/**
 * Build and verify a staged managed plugin directory. The final `targetDir` is
 * never created or modified; the caller owns the atomic swap after review.
 * Throws `OperationalError` for a missing/partial build, bad asset counts, a
 * non-self-contained or unimportable bundle, or an invalid manifest; staging
 * is removed on every failure.
 */
export async function buildStagedPlugin(input: BuildStagedPluginInput): Promise<StagedPlugin> {
  const targetDir = requireAbsoluteTarget(input.targetDir);
  const packageRoot =
    input.packageRoot === undefined ? findPackageRoot(import.meta.url) : path.resolve(input.packageRoot);
  const { bundle, assets } = requireBuiltLayout(packageRoot);

  const sourceCounts = assertAssetCounts(assets);
  await assertSelfContained(bundle);

  let stagingDir: string | undefined;
  try {
    stagingDir = await stageDirectory(targetDir);
    const stagedBundle = path.join(stagingDir, 'dist', BUNDLE_FILE);
    const stagedAssets = path.join(stagingDir, 'dist', ASSETS_DIR);

    await copyTree(bundle, stagedBundle);
    await copyTree(assets, stagedAssets);
    writeFileAtomic(path.join(stagingDir, INDEX_FILE), INDEX_SHIM);
    writeFileAtomic(path.join(stagingDir, PACKAGE_FILE), renderPackageJson(input.version));

    assertAssetCounts(stagedAssets, sourceCounts);
    await importStagedBundle(stagedBundle);

    const files = (await listManagedFiles(stagingDir)).sort();
    const manifest = createManifest({
      package: PACKAGE_NAME,
      version: input.version,
      source: input.source,
      scope: input.scope,
      target: targetDir,
      config: input.config,
      files,
    });
    writeFileAtomic(manifestPathFor(stagingDir), renderManifest(manifest));

    return { stagingDir, targetDir, manifest, files };
  } catch (err) {
    if (stagingDir !== undefined) await cleanupStaging(stagingDir);
    if (err instanceof OperationalError) throw err;
    throw new OperationalError(`cannot materialize the plugin: ${describeError(err)}`, { cause: err });
  }
}
