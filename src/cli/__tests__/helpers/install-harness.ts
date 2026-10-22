/**
 * install-harness.ts — isolated fixture for install-command tests (4.1).
 *
 * Builds a temp root with a fixture package (`dist/plugin.js`, 7 agents, 17
 * skills), an isolated HOME/XDG/OPENCODE config dir, and a project directory.
 * Every path is under the temp root and removed by `withTempDir` in `finally`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { withTempDir } from '../../../__tests__/helpers/temp-dir.js';
import type { CommandOptions } from '../../args.js';
import type { InstallDeps } from '../../commands/install.js';
import { parseJsonc } from '../../jsonc.js';

export const FIXTURE_VERSION = '1.2.3';
const FIXTURE_BUNDLE = "export default { id: 'dev-harness-skills', setup() {} };\n";
const EXPECTED_AGENTS = 7;
const EXPECTED_SKILLS = 17;

class StringWriter {
  text = '';

  write(chunk: string): boolean {
    this.text += chunk;
    return true;
  }
}

export interface InstallHarness {
  readonly root: string;
  readonly home: string;
  readonly globalDir: string;
  readonly projectDir: string;
  readonly packageRoot: string;
  readonly stdout: StringWriter;
  readonly stderr: StringWriter;
  readonly env: Readonly<Record<string, string>>;
  options(overrides?: Partial<CommandOptions>): CommandOptions;
  deps(overrides?: Partial<InstallDeps>): InstallDeps;
}

export interface ManifestLike {
  readonly package: string;
  readonly version: string;
  readonly source: string;
  readonly scope: string;
  readonly target: string;
  readonly config: { readonly path: string; readonly key: string; readonly fingerprint?: unknown };
  readonly files: readonly string[];
}

export interface ConfigLike {
  readonly mcp?: { readonly servers?: { readonly dh?: unknown } };
  readonly [key: string]: unknown;
}

export function writeFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

export function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Parse a config file that may contain comments/trailing commas. */
export function readJsonc(file: string): unknown {
  const result = parseJsonc(fs.readFileSync(file, 'utf8'));
  if (!result.ok) throw new Error(`fixture config is not valid JSONC: ${result.error.message}`);
  return result.value;
}

/** Fixture package root the materializer copies from. */
function createPackageRoot(root: string): string {
  writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'dev-harness-skills', version: FIXTURE_VERSION }));
  writeFile(path.join(root, 'dist', 'plugin.js'), FIXTURE_BUNDLE);
  for (let index = 0; index < EXPECTED_AGENTS; index += 1) {
    writeFile(path.join(root, 'dist', 'assets', 'agents', `agent-${index}.md`), `# agent ${index}\n`);
  }
  for (let index = 0; index < EXPECTED_SKILLS; index += 1) {
    writeFile(path.join(root, 'dist', 'assets', 'skills', `skill-${index}`, 'SKILL.md'), `# skill ${index}\n`);
  }
  return root;
}

export const globalTarget = (harness: InstallHarness): string =>
  path.join(harness.globalDir, 'plugins', 'dev-harness-skills');
export const globalConfig = (harness: InstallHarness): string => path.join(harness.globalDir, 'opencode.jsonc');
export const projectTarget = (harness: InstallHarness): string =>
  path.join(harness.projectDir, '.opencode', 'plugins', 'dev-harness-skills');
export const projectConfig = (harness: InstallHarness): string => path.join(harness.projectDir, 'opencode.jsonc');

export async function withInstallHarness(run: (harness: InstallHarness) => Promise<void> | void): Promise<void> {
  await withTempDir(async (root) => {
    const home = path.join(root, 'home');
    const globalDir = path.join(root, 'global-opencode');
    const projectDir = path.join(root, 'project');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    const packageRoot = createPackageRoot(path.join(root, 'package'));
    const stdout = new StringWriter();
    const stderr = new StringWriter();
    const env = {
      HOME: home,
      XDG_CONFIG_HOME: path.join(root, 'xdg'),
      OPENCODE_CONFIG_DIR: globalDir,
    };

    const harness: InstallHarness = {
      root,
      home,
      globalDir,
      projectDir,
      packageRoot,
      stdout,
      stderr,
      env,
      options: (overrides = {}) => ({
        yes: true,
        dryRun: false,
        force: false,
        noMcp: false,
        mcpOnly: false,
        json: false,
        ...overrides,
      }),
      deps: (overrides = {}) => ({
        version: FIXTURE_VERSION,
        packageRoot,
        env,
        cwd: projectDir,
        home,
        inputIsTTY: false,
        outputIsTTY: false,
        stdout,
        stderr,
        ...overrides,
      }),
    };

    await run(harness);
  });
}
