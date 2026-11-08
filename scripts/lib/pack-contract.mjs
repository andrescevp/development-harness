/**
 * pack-contract.mjs — pure tarball inventory rules for scripts/smoke-pack.mjs.
 *
 * `npm pack --json` reports the published file list; source `agents/` and
 * `skills/` define the expected inventory. No I/O beyond reading the source
 * directories, no process state, no output.
 */
import fs from 'node:fs';
import path from 'node:path';

export const REQUIRED_ARTIFACTS = [
  'package.json',
  'README.md',
  'dist/plugin.js',
  'dist/plugin.d.ts',
  'dist/cli.js',
  'dist/mcp/stdio.js',
  'dist/assets/skills/index.md',
];

/** Return why a packed path is forbidden, or null when it is acceptable. */
function forbiddenReason(entry) {
  const segments = entry.split('/');
  if (segments[0] === 'src') return 'source tree';
  if (segments[0] === 'docs') return 'docs/plans';
  if (segments.includes('test')) return 'tests';
  if (segments.some((segment) => segment === '.env' || segment.startsWith('.env.'))) return '.env';
  if (segments.includes('plans') || segments.at(-1) === 'plan.md') return 'plan file';
  if (segments[0] === 'node_modules') return 'node_modules';
  if (segments[0] === '.git') return '.git';
  return null;
}

/** Source inventory is the contract: 7 agents and 17 skill directories. */
export function sourceInventory(repoRoot) {
  const agents = fs
    .readdirSync(path.join(repoRoot, 'agents'))
    .filter((name) => name.endsWith('.md'))
    .sort();
  const skills = fs
    .readdirSync(path.join(repoRoot, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(repoRoot, 'skills', entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
  return { agents, skills };
}

/** Compare the packed file set against the source inventory. */
export function auditTarball(files, source) {
  const entries = [...files];
  return {
    agentCount: entries.filter((entry) => /^dist\/assets\/agents\/[^/]+\.md$/.test(entry)).length,
    skillCount: entries.filter((entry) => /^dist\/assets\/skills\/[^/]+\/SKILL\.md$/.test(entry)).length,
    missingArtifacts: REQUIRED_ARTIFACTS.filter((entry) => !files.has(entry)),
    missingAgents: source.agents.map((name) => `dist/assets/agents/${name}`).filter((entry) => !files.has(entry)),
    missingSkills: source.skills
      .map((name) => `dist/assets/skills/${name}/SKILL.md`)
      .filter((entry) => !files.has(entry)),
    violations: entries.flatMap((entry) => {
      const reason = forbiddenReason(entry);
      return reason === null ? [] : [`${entry} (${reason})`];
    }),
  };
}
