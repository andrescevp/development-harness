#!/usr/bin/env node
/**
 * copy-assets.mjs — sync the harness corpus (agents/ + skills/) into
 * dist/assets/ so dist/plugin.js can resolve them at runtime via
 * `import.meta.dirname` (independent of CWD).
 *
 * Rules:
 *   - Only agents/ and skills/ are copied (no commands/, no prompts/).
 *   - Junk classification comes from scripts/lib/shared.mjs (dependency
 *     dirs, `.env*` secrets, `.bak`/swap/`.DS_Store` patterns). references/,
 *     scripts, and data files inside skill dirs ARE part of the skill and
 *     are kept.
 *   - dist/assets is cleaned first so stale content can never hide missing
 *     files (stale-dist guard).
 *   - Verifies the copied inventory against the source tree (agents count,
 *     skill dirs with SKILL.md, skills/index.md); exits 1 on mismatch so a
 *     broken build fails loudly.
 *
 * Usage:
 *   node scripts/copy-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJunkReason, listEntries, projectRoot } from './lib/shared.mjs';

const REPO_ROOT = projectRoot(import.meta.url);
const ASSETS_ROOT = path.join(REPO_ROOT, 'dist', 'assets');
const COPY_SECTIONS = ['agents', 'skills'];

const junkReason = createJunkReason();

/** Recursive copy preserving relative layout; returns [{ rel, reason }] for skipped junk. */
function walkCopy(srcAbs, destAbs, relPrefix, skipped) {
  for (const { entry, rel, skipped: hit, reason } of listEntries(fs, junkReason, srcAbs, relPrefix)) {
    if (hit) {
      skipped.push({ rel, reason });
      continue;
    }
    if (entry.isSymbolicLink()) {
      skipped.push({ rel, reason: 'symlink (not copied)' });
      continue;
    }
    const src = path.join(srcAbs, entry.name);
    const dest = path.join(destAbs, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      walkCopy(src, dest, rel, skipped);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

function srcAgentCount() {
  return fs.readdirSync(path.join(REPO_ROOT, 'agents')).filter((f) => f.endsWith('.md')).length;
}

function srcSkillDirs() {
  return fs
    .readdirSync(path.join(REPO_ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((d) => fs.existsSync(path.join(REPO_ROOT, 'skills', d.name, 'SKILL.md'))).length;
}

function verifyInventory() {
  const problems = [];
  const agentFiles = fs.readdirSync(path.join(ASSETS_ROOT, 'agents')).filter((f) => f.endsWith('.md'));
  const skillMd = fs
    .readdirSync(path.join(ASSETS_ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((d) => fs.existsSync(path.join(ASSETS_ROOT, 'skills', d.name, 'SKILL.md')));
  const hasIndex = fs.existsSync(path.join(ASSETS_ROOT, 'skills', 'index.md'));
  const expectedAgents = srcAgentCount();
  const expectedSkills = srcSkillDirs();
  if (agentFiles.length !== expectedAgents) {
    problems.push(`agents: ${agentFiles.length} copied != ${expectedAgents} source`);
  }
  if (skillMd.length !== expectedSkills) {
    problems.push(`skills SKILL.md: ${skillMd.length} copied != ${expectedSkills} source`);
  }
  if (!hasIndex) problems.push('skills/index.md missing');
  return { problems, counts: { agents: agentFiles.length, skills: skillMd.length, index: hasIndex } };
}

function main() {
  if (!fs.existsSync(path.join(REPO_ROOT, 'agents')) || !fs.existsSync(path.join(REPO_ROOT, 'skills'))) {
    console.error('[copy-assets] repo assets missing (agents/ or skills/ not found)');
    process.exit(1);
  }
  fs.rmSync(ASSETS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(ASSETS_ROOT, { recursive: true });
  const skipped = [];
  for (const section of COPY_SECTIONS) {
    walkCopy(path.join(REPO_ROOT, section), path.join(ASSETS_ROOT, section), '', skipped);
  }
  const { problems, counts } = verifyInventory();
  console.log(
    `[copy-assets] agents ${counts.agents} | skills ${counts.skills} SKILL.md + index.md ${counts.index ? 'yes' : 'no'}`
  );
  if (skipped.length) {
    console.log(`[copy-assets] skipped junk (${skipped.length}):`);
    for (const s of skipped) console.log(`  - ${s.rel}  [${s.reason}]`);
  }
  if (problems.length) {
    console.error(`[copy-assets] INVENTORY MISMATCH:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('[copy-assets] OK — assets synced to dist/assets');
}

main();
