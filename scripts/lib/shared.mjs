/**
 * shared.mjs — helpers shared by the pipeline scripts (extract.mjs,
 * copy-assets.mjs). Manifest-driven junk classification, repo-root
 * bootstrap, and the junk-filtered directory listing, so both scripts stay
 * in lockstep (jscpd no-duplication).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {object} M scripts/manifest.json (junk section) */
export function createJunkReason(M) {
  /**
   * @returns {string|null} junk reason for a relative path, or null if kept.
   */
  return (relPath, base, isDir) => {
    const segments = relPath.split('/');
    for (const d of M.junk.anySegmentDirNames) if (segments.includes(d)) return `dependency junk (${d})`;
    for (const s of M.junk.secretsFileNames) if (base === s || base.startsWith(s)) return 'secrets (.env*)';
    if (isDir) return null;
    for (const f of M.junk.filePatterns) if (new RegExp(f.pattern).test(base)) return f.reason;
    return null;
  };
}

/** Repo root derived from a script's import.meta.url (scripts live in <root>/scripts). */
export function projectRoot(importMetaUrl) {
  return path.dirname(path.dirname(fileURLToPath(importMetaUrl)));
}

/** Load scripts/manifest.json from the repo root. */
export function loadManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'manifest.json'), 'utf8'));
}

/**
 * List directory entries with junk filtering (shared walk head for the
 * recursive copy functions). Kept entries are { entry, rel, reason: null };
 * junk entries are { skipped: true, rel, reason }.
 */
export function listEntries(fs_, junkReason_, srcAbs, relPrefix) {
  const out = [];
  for (const entry of fs_.readdirSync(srcAbs, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const reason = junkReason_(rel, entry.name, entry.isDirectory());
    out.push(reason ? { skipped: true, rel, reason } : { entry, rel, reason: null });
  }
  return out;
}
