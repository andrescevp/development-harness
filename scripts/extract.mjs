#!/usr/bin/env node
/**
 * extract.mjs — reproducible extraction of the opencode-only dev harness
 * from ~/.agents into this repo — SCOPED manifest only:
 * agents (6, incl. 2 alias renames) + skills (11 dirs + index.md).
 * NO commands, NO prompts (user-mandated scope): those directories are
 * removed from the repo if present and never extracted.
 *
 * Usage:
 *   node scripts/extract.mjs            # copy (idempotent, mirrors source inventory)
 *   node scripts/extract.mjs --check    # verify counts, junk-free, alias body integrity
 *   AGENTS_HOME=/path node scripts/extract.mjs   # override the source root
 *
 * Node built-ins only: fs, path, os, url. The source (~/.agents) is READ-ONLY.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const M = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'manifest.json'), 'utf8'))
const HOME = os.homedir()
const SOURCE_ROOT = process.env.AGENTS_HOME || path.join(HOME, '.agents')

/**
 * Expectations + include/exclude rules live in scripts/manifest.json
 * (single source shared with scripts/audit.mjs and the ST5 asset builder).
 * The scoped source holds 11 skill dirs (all real, no symlinks) + index.md —
 * commands/ and prompts/ are out of scope by user mandate.
 */

/** Agent alias decision (plugin manifest names): file rename + frontmatter `name` only. */
const AGENT_RENAMES = M.agentRenames
/** Explicit scoped include lists (user-mandated manifest) — everything else in the source is out of scope. */
const INCLUDE = M.include

/** @returns {string|null} junk reason for a relative path, or null if it is kept. */
function junkReason(relPath, base, isDir) {
  const segments = relPath.split('/')
  for (const d of M.junk.anySegmentDirNames) if (segments.includes(d)) return `dependency junk (${d})`
  for (const s of M.junk.secretsFileNames) if (base === s || base.startsWith(s)) return 'secrets (.env*)'
  if (isDir) return null
  for (const f of M.junk.filePatterns) if (new RegExp(f.pattern).test(base)) return f.reason
  return null
}

const stats = {
  copied: { agents: 0, skills: 0 },
  renamed: [],
  dereferenced: [],
  patched: [],
  skipped: [],
}

/** Strip the leading `---`-delimited frontmatter block; returns {fm, body}. */
function splitFrontmatter(text, file) {
  if (!text.startsWith('---\n')) throw new Error(`no leading frontmatter in ${file}`)
  const end = text.indexOf('\n---', 4)
  if (end === -1) throw new Error(`unterminated frontmatter in ${file}`)
  const fm = text.slice(0, end + 4)     // includes the closing `---`
  const body = text.slice(end + 4)      // starts at the newline after the closing `---`
  return { fm, body }
}

/** Copy an agent file: apply alias rename + sanctioned pipeline patches. */
function copyAgent(srcFile, destFile, rename) {
  let text = fs.readFileSync(srcFile, 'utf8')
  const { body } = splitFrontmatter(text, srcFile)
  if (rename) {
    const oldName = path.basename(srcFile, '.md') // source frontmatter name == source filename
    const re = new RegExp(`^name:\\s*${oldName}\\s*$`, 'm')
    const fm = splitFrontmatter(text, srcFile).fm
    const fm2 = fm.replace(re, `name: ${rename.newName}`)
    if (fm2 === fm) throw new Error(`frontmatter 'name' not found in ${srcFile}`)
    text = fm2 + body
    stats.renamed.push({ from: path.basename(srcFile), to: rename.to })
  }
  const { contents, patched } = applyPatches(text, path.basename(destFile))
  fs.writeFileSync(destFile, contents, 'utf8')
  if (patched) stats.patched.push({ file: path.basename(destFile), patch: patched })
  return body
}

/** Apply declarative PATCHES from manifest.json (post-copy, idempotent). */
function applyPatches(contents, fileName) {
  let out = contents
  const applied = []
  for (const p of M.patches ?? []) {
    if (p.scope === 'agents' && fileName.endsWith('.md') && p.action === 'strip-frontmatter-key' && p.key) {
      const r = stripFrontmatterKey(out, p.key)
      if (r.stripped) { out = r.contents; applied.push(`strip:${p.key}`) }
    } else if (p.action === 'replace-body-text' && (p.files ?? []).includes(fileName) && p.from) {
      if (out.includes(p.from)) { out = out.split(p.from).join(p.to ?? ''); applied.push('replace:' + p.from.split('/').pop()) }
    } else if (p.action === 'append-body-note' && (p.files ?? []).includes(fileName) && p.note) {
      if (!out.includes(p.marker ?? p.note)) {
        const { fm, body } = splitFrontmatter(out, fileName)
        out = fm + body + '\n' + p.note + '\n'
        applied.push('append:plan-tools-note')
      }
    }
  }
  return { contents: out, patched: applied.join(', ') || undefined }
}

/** Remove the sanctioned appended note block (M2) so alias-body comparisons stay honest. */
function stripBodyNote(body, marker) {
  if (!marker) return body
  const idx = body.indexOf(marker)
  return idx === -1 ? body : body.slice(0, idx).replace(/\n+\s*$/, '\n')
}

/** Remove a top-level frontmatter key block (key line through next top-level key). */
function stripFrontmatterKey(contents, key) {
  if (!contents.startsWith('---\n')) return { contents, stripped: false }
  const lines = contents.split('\n')
  let close = -1
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { close = i; break }
  if (close === -1) return { contents, stripped: false }
  const out = []
  let inBlock = false
  let stripped = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (i === 0 || i === close) { out.push(l); continue }
    if (i > close) { out.push(l); continue } // body: never stripped
    if (!inBlock && l.trimStart() === `${key}:`) { inBlock = true; stripped = true; continue }
    if (inBlock) {
      // A non-indented top-level key ends the block; blank lines inside it are dropped.
      if (/^[A-Za-z0-9_-]+:\s*$/.test(l) && !l.startsWith(' ') && !l.startsWith('\t')) { inBlock = false; out.push(l) }
      continue
    }
    out.push(l)
  }
  return { contents: out.join('\n'), stripped }
}

/** Recursive copy skipping junk; dereferences symlinks so the repo is self-contained. */
function walkCopy(srcAbs, destAbs, relPrefix) {
  for (const entry of fs.readdirSync(srcAbs, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name
    const reason = junkReason(rel, entry.name, entry.isDirectory())
    if (reason) { stats.skipped.push({ rel, reason }); continue }
    const srcPath = path.join(srcAbs, entry.name)
    const destPath = path.join(destAbs, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      walkCopy(srcPath, destPath, rel)
    } else if (entry.isSymbolicLink()) {
      let real
      try { real = fs.realpathSync(srcPath) } catch { stats.skipped.push({ rel, reason: 'broken symlink' }); continue }
      // Hardening: never dereference a symlink whose target resolves outside SOURCE_ROOT.
      const rootReal = fs.realpathSync(SOURCE_ROOT)
      if (!real.startsWith(rootReal + path.sep)) {
        stats.skipped.push({ rel, reason: `symlink target outside source root: ${real}` })
        continue
      }
      const st = fs.statSync(real)
      stats.dereferenced.push({ link: rel, real })
      if (st.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true })
        walkCopy(real, destPath, rel)
      } else {
        fs.copyFileSync(real, destPath)
      }
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/** Clear-and-copy one section. Repo-authored skill dirs are preserved. */
function extractSection(src, dest, kind) {
  const destAbs = path.join(REPO_ROOT, dest)
  if (kind === 'skills') {
    // Merge-preserve: never wipe; remove only stale/out-of-scope entries, keep
    // repo-authored dirs, adapted index.md, and dest-only files (references/).
    fs.mkdirSync(destAbs, { recursive: true })
    const destNames = (M.include.skills ?? []).map((n) => M.skillRenames?.[n] ?? n)
    const protectedNames = new Set([...destNames, ...(M.repoAuthored?.skills ?? []), 'index.md'])
    for (const e of fs.readdirSync(destAbs, { withFileTypes: true })) {
      if (!protectedNames.has(e.name)) {
        fs.rmSync(path.join(destAbs, e.name), { recursive: true, force: true })
        stats.skipped.push({ rel: `${dest}/${e.name}`, reason: 'stale/out-of-scope removed' })
      }
    }
  } else {
    fs.rmSync(destAbs, { recursive: true, force: true })
    fs.mkdirSync(destAbs, { recursive: true })
  }
  const srcAbs = path.join(SOURCE_ROOT, src)
  if (!fs.existsSync(srcAbs)) throw new Error(`source missing: ${srcAbs}`)
  const items = fs.readdirSync(srcAbs, { withFileTypes: true })
  const allowed = kind === 'agents' ? INCLUDE.agents : INCLUDE.skills
  let indexCopied = false
  for (const entry of items) {
    const junk = junkReason(entry.name, entry.name, entry.isDirectory())
    if (junk) { stats.skipped.push({ rel: `${dest}/${entry.name}`, reason: junk }); continue }
    if (kind === 'skills' && entry.name === 'index.md') { /* index always in scope (when not junk) */ }
    else if (!allowed.includes(entry.name)) {
      stats.skipped.push({ rel: `${dest}/${entry.name}`, reason: 'out of scope (user-mandated manifest)' })
      continue
    }
    if (kind === 'agents' && AGENT_RENAMES[entry.name]) {
      const r = AGENT_RENAMES[entry.name]
      copyAgent(path.join(srcAbs, entry.name), path.join(destAbs, r.to), r)
      stats.copied.agents += 1
    } else if (kind === 'agents' && entry.isFile()) {
      // Route through copyAgent so M3 patches (permission strip) apply to all agents.
      copyAgent(path.join(srcAbs, entry.name), path.join(destAbs, entry.name))
      stats.copied.agents += 1
    } else if (kind === 'skills') {
      const destName = M.skillRenames?.[entry.name] ?? entry.name
      if (entry.name === 'index.md') {
        // Repo keeps the adapted index; copy source only when none exists.
        if (!fs.existsSync(path.join(destAbs, 'index.md'))) {
          fs.copyFileSync(path.join(srcAbs, entry.name), path.join(destAbs, entry.name))
        }
        indexCopied = true
      } else if ((M.repoAuthored?.skills ?? []).includes(destName)) {
        stats.skipped.push({ rel: `${dest}/${entry.name}`, reason: 'repo-authored preserved (not re-copied)' })
      } else {
        const srcDir = path.join(srcAbs, entry.name)
        const st = fs.lstatSync(srcDir)
        let realSrc = srcDir
        if (st.isSymbolicLink()) {
          realSrc = fs.realpathSync(srcDir)
          stats.dereferenced.push({ link: entry.name, real: realSrc })
        }
        fs.mkdirSync(path.join(destAbs, entry.name), { recursive: true })
        walkCopy(realSrc, path.join(destAbs, entry.name), entry.name)
        stats.copied.skills += 1
      }
    }
  }
  if (kind === 'skills' && !indexCopied) stats.skipped.push({ rel: 'skills/index.md', reason: 'missing in source' })
}

function countItems() {
  const agents = fs.readdirSync(path.join(REPO_ROOT, 'agents')).filter((f) => f.endsWith('.md')).length
  const skillDirs = fs.readdirSync(path.join(REPO_ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).length
  const hasIndex = fs.existsSync(path.join(REPO_ROOT, 'skills', 'index.md'))
  return { agents, skillDirs, hasIndex }
}

function collectJunk(root) {
  const hits = []
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name
      if (junkReason(r, e.name, e.isDirectory())) hits.push(`${r} (${junkReason(r, e.name, e.isDirectory())})`)
      if (e.isDirectory()) walk(path.join(dir, e.name), r)
    }
  }
  walk(root, '')
  return hits
}

function verifyAliasBodyIntegrity() {
  const problems = []
  // Sanctioned body-patch markers are stripped/normalized before comparison:
  // plan-tools note (M2) and the task.md -> sdd.md contract-path rename (SMD).
  const bodyNorm = (b) => b.split('sdd.md').join('task.md')
  const noteMarkers = (M.patches ?? []).filter((p) => p.action === 'append-body-note').map((p) => p.marker).filter(Boolean)
  for (const [from, r] of Object.entries(AGENT_RENAMES)) {
    const srcText = fs.readFileSync(path.join(SOURCE_ROOT, 'agents', from), 'utf8')
    const destText = fs.readFileSync(path.join(REPO_ROOT, 'agents', r.to), 'utf8')
    let srcBody = splitFrontmatter(srcText, from).body
    let destBody = splitFrontmatter(destText, r.to).body
    srcBody = bodyNorm(srcBody)
    destBody = bodyNorm(destBody)
    for (const m of noteMarkers) {
      srcBody = stripBodyNote(srcBody, m)
      destBody = stripBodyNote(destBody, m)
    }
    // Normalize trailing newlines: sanctioned appends and EOF differences
    // must not count as body drift (only real content changes do).
    const norm = (b) => b.replace(/\n+\s*$/, '\n')
    if (norm(srcBody) !== norm(destBody)) problems.push(`${from} body differs from ${r.to}`)
    const destFm = splitFrontmatter(destText, r.to).fm
    if (!destFm.includes(`name: ${r.newName}`)) problems.push(`${r.to} frontmatter name missing`)
  }
  return problems
}

function extract() {
  if (SOURCE_ROOT === REPO_ROOT || SOURCE_ROOT.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`AGENTS_HOME (${SOURCE_ROOT}) must not point inside the repo`)
  }
  if (!fs.existsSync(SOURCE_ROOT)) throw new Error(`source root not found: ${SOURCE_ROOT}`)
  extractSection('agents', 'agents', 'agents')
  extractSection('skills', 'skills', 'skills')
  // commands/ and prompts/ are out of scope (user-mandated manifest): keep them
  // absent from the repo on every run so stale directories cannot reappear.
  for (const out of ['commands', 'prompts']) {
    fs.rmSync(path.join(REPO_ROOT, out), { recursive: true, force: true })
  }
  const { agents, skillDirs, hasIndex } = countItems()
  console.log(`Extracted from ${SOURCE_ROOT} -> ${REPO_ROOT}`)
  console.log(`  agents: ${agents} files  | skills: ${skillDirs} dirs + index.md ${hasIndex ? 'yes' : 'NO'} | commands/prompts: out of scope (removed)`)
  console.log(`  renames: ${stats.renamed.map((r) => `${r.from} -> ${r.to}`).join(', ') || 'none'}`)
  console.log(`  patches: ${stats.patched.map((p) => `${p.file} [${p.patch}]`).join('; ') || 'none'}`)
  console.log(`  symlinks dereferenced: ${stats.dereferenced.map((d) => `${d.link} -> ${d.real}`).join('; ') || 'none'}`)
  if (stats.skipped.length) {
    console.log(`  skipped (${stats.skipped.length}):`)
    for (const s of stats.skipped) console.log(`    - ${s.rel}  [${s.reason}]`)
  }
  console.log('Re-run: node scripts/extract.mjs   |   Verify: node scripts/extract.mjs --check')
}

/** Walk a directory tree and return absolute paths of symbolic links. */
function collectSymlinks(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isSymbolicLink()) out.push(p)
      else if (e.isDirectory()) walk(p)
    }
  }
  walk(dir)
  return out
}

function check() {
  if (!fs.existsSync(SOURCE_ROOT)) throw new Error(`source root not found: ${SOURCE_ROOT}`)
  const problems = []
  const { agents, skillDirs, hasIndex } = countItems()
  // Bundled skill count derives from the manifest's repoAuthored list (all
  // bundled skills are repo-authored; grows with new bundled skills like
  // dh-grill-sdd) — fallback to the legacy coding-probe pair.
  const expectedSkills = (M.repoAuthored?.skills?.length || 0) ||
    (fs.existsSync(path.join(REPO_ROOT, 'skills', 'dh-coding', 'SKILL.md')) ? M.bundledSkillMdCount.afterSt3 : M.bundledSkillMdCount.now)
  const expectations = {
    agents: M.sections.agents.expectedItems,
    skillDirs: expectedSkills,
    hasIndex: M.sections.skillsIndex.expectedItems === 1,
  }
  if (agents !== expectations.agents) problems.push(`agents: ${agents} != ${expectations.agents}`)
  if (skillDirs !== expectations.skillDirs) problems.push(`skill dirs: ${skillDirs} != ${expectations.skillDirs}`)
  if (hasIndex !== expectations.hasIndex) problems.push(`skills/index.md missing`)
  for (const out of ['commands', 'prompts']) {
    if (fs.existsSync(path.join(REPO_ROOT, out))) problems.push(`out-of-scope directory present: ${out}/`)
  }
  if (!fs.existsSync(path.join(REPO_ROOT, 'agents', 'dh-software-architect.md')) ||
      !fs.existsSync(path.join(REPO_ROOT, 'agents', 'dh-software-engineer.md'))) {
    problems.push('alias files dh-software-architect.md / dh-software-engineer.md missing')
  }
  // M3: `permission` must be stripped from every bundled agent frontmatter.
  for (const f of fs.readdirSync(path.join(REPO_ROOT, 'agents'))) {
    if (!f.endsWith('.md')) continue
    const t = fs.readFileSync(path.join(REPO_ROOT, 'agents', f), 'utf8')
    if (t.split('\n').some((l) => /^permission:/.test(l))) problems.push(`agent ${f} still has permission key (M3 strip)`)
  }
  problems.push(...verifyAliasBodyIntegrity())
  for (const dir of ['agents', 'skills']) {
    for (const hit of collectJunk(path.join(REPO_ROOT, dir))) problems.push(`junk in ${dir}/: ${hit}`)
    for (const s of collectSymlinks(path.join(REPO_ROOT, dir))) problems.push(`symlink in ${dir}/: ${s}`)
  }
  if (problems.length) {
    console.log('CHECK FAIL')
    for (const p of problems) console.log(`  - ${p}`)
    process.exitCode = 1
  } else {
    console.log(`CHECK PASS — agents ${agents}, skills ${skillDirs} dirs + index.md, no commands/, no prompts/; no junk; alias bodies identical to source`)
  }
}

const arg = process.argv[2]
try {
  if (arg === '--check') check()
  else if (arg === undefined) extract()
  else { console.error(`unknown arg: ${arg} (use --check or nothing)`); process.exit(2) }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}