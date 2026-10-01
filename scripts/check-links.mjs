#!/usr/bin/env node
/**
 * check-links.mjs — dead-reference audit for the repo's markdown.
 *
 * Checks, across active *.md files (agents/, skills/, docs/, src/, root):
 *   1. Markdown links `[text](path)` with relative targets → file exists?
 *   2. Backticked file-like paths (e.g. `skills/dh-planning/...`, `src/...`)
 *      → file exists? (glob patterns like `scripts/deploy*.sh` and paths
 *      inside ``` code fences are ignored, as are ~/ personal paths and
 *      remote URLs.)
 *
 * Exit: 1 when real breaks are found (marks only), 0 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);
const ARCHIVE_PREFIXES = ['docs/evolve', 'docs/plans/dev-']; // historical records
const KNOWN_ROOTS = /^\/(?:skills|agents|src|scripts|docs|test)\//;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function isArchive(rel) {
  return ARCHIVE_PREFIXES.some((pre) => rel.startsWith(pre));
}

function markdownLinks(text) {
  const out = [];
  let inFence = false;
  let buf = '';
  const flush = () => {
    if (buf) out.push(...[...buf.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]));
    buf = '';
  };
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (!inFence) buf += line + '\n';
  }
  flush();
  return out;
}

/** Backticked paths that look like repo file paths, outside code fences. */
function backtickPaths(text) {
  const out = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const ref = m[1].trim();
      if (!KNOWN_ROOTS.test(ref)) continue;
      if (/\*|\?|\[.*\]/.test(ref)) continue; // glob
      out.push(ref);
    }
  }
  return out;
}

const issues = [];
let checked = 0;

for (const file of walk(REPO_ROOT)) {
  const rel = path.relative(REPO_ROOT, file);
  if (isArchive(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);

  for (const ref of markdownLinks(text)) {
    const clean = ref.replace(/#.*$/, '').trim();
    if (!clean || /^(https?:|mailto:|file:)/.test(clean) || clean.startsWith('//')) continue;
    if (/\*|\?/.test(clean)) continue; // glob links (rare but possible)
    checked++;
    const target = path.isAbsolute(clean) ? path.join(REPO_ROOT, clean.slice(1)) : path.resolve(dir, clean);
    if (!fs.existsSync(target)) issues.push(`${rel}  →  ${ref}  [link target missing]`);
  }

  for (const ref of backtickPaths(text)) {
    checked++;
    const target = path.join(REPO_ROOT, ref);
    if (!fs.existsSync(target)) issues.push(`${rel}  →  \`${ref}\`  [path missing]`);
  }
}

console.log(`[check-links] scanned markdown; ${checked} references checked`);
if (issues.length) {
  console.error(`[check-links] ${issues.length} DEAD REFERENCE(S):`);
  for (const i of issues) console.error(`  ${i}`);
  process.exit(1);
}
console.log('[check-links] OK — no dead references in the active surface');
