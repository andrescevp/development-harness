/**
 * extract.mjs — REPO-AUTHORED integrity check (2026-09-29).
 *
 * The dev-harness plugin is fully repo-authored: `agents/` and `skills/` are
 * owned by this repository and nothing is extracted from `~/.agents` anymore.
 * This script therefore no longer copies anything — it verifies the repo
 * tree against the manifest expectations (counts, no stale/out-of-scope
 * dirs, no junk, no symlinks, no secret-bearing frontmatter keys).
 *
 * Usage:   node scripts/extract.mjs          (same as --check; no copy step)
 *          node scripts/extract.mjs --check
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJunkReason, listEntries, loadManifest, projectRoot } from './lib/shared.mjs';

const REPO_ROOT = projectRoot(import.meta.url);
const M = loadManifest(REPO_ROOT);
const junkReason = createJunkReason(M);

function countItems() {
  const agents = fs.readdirSync(path.join(REPO_ROOT, 'agents')).filter((f) => f.endsWith('.md')).length;
  const skillDirs = fs
    .readdirSync(path.join(REPO_ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).length;
  const hasIndex = fs.existsSync(path.join(REPO_ROOT, 'skills', 'index.md'));
  return { agents, skillDirs, hasIndex };
}

function collectJunk(root) {
  const hits = [];
  const walk = (dir, rel) => {
    for (const entry of listEntries(fs, junkReason, dir, rel)) {
      if (entry.skipped) hits.push(`${entry.rel} (${entry.reason})`);
      else if (entry.entry.isDirectory()) walk(path.join(dir, entry.entry.name), entry.rel);
    }
  };
  walk(root, '');
  return hits;
}

function collectSymlinks(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) out.push(p);
      else if (e.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return out;
}

function check() {
  const problems = [];
  const { agents, skillDirs, hasIndex } = countItems();
  if (agents !== M.sections.agents.expectedItems)
    problems.push(`agents: ${agents} != ${M.sections.agents.expectedItems}`);
  if (skillDirs !== M.sections.skills.expectedItems)
    problems.push(`skills dirs: ${skillDirs} != ${M.sections.skills.expectedItems}`);
  if (hasIndex !== (M.sections.skillsIndex.expectedItems === 1)) problems.push('skills/index.md mismatch');
  for (const out of ['commands', 'prompts']) {
    if (fs.existsSync(path.join(REPO_ROOT, out))) problems.push(`out-of-scope directory present: ${out}/`);
  }
  for (const dir of ['agents', 'skills']) {
    for (const hit of collectJunk(path.join(REPO_ROOT, dir))) problems.push(`junk in ${dir}/: ${hit}`);
    for (const s of collectSymlinks(path.join(REPO_ROOT, dir))) problems.push(`symlink in ${dir}/: ${s}`);
  }
  // Repo-authored agents ship without `permission` and `tools` frontmatter keys.
  for (const f of fs.readdirSync(path.join(REPO_ROOT, 'agents'))) {
    if (!f.endsWith('.md')) continue;
    const t = fs.readFileSync(path.join(REPO_ROOT, 'agents', f), 'utf8');
    for (const key of ['permission', 'tools']) {
      if (t.split('\n').some((l) => new RegExp(`^${key}:`).test(l)))
        problems.push(`agent ${f} still has '${key}' key (repo-authored mandate)`);
    }
  }
  if (problems.length) {
    console.log('CHECK FAIL');
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  } else {
    console.log(
      `CHECK PASS — repo-authored tree matches manifest (agents ${agents}, skills ${skillDirs} dirs + index.md); no out-of-scope dirs, no junk, no symlinks, no permission/tools keys`
    );
  }
}

const arg = process.argv[2];
try {
  if (arg === '--check' || arg === undefined) check();
  else {
    console.error(`unknown arg: ${arg} (use --check or nothing)`);
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
