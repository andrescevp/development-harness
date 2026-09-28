#!/usr/bin/env node
/**
 * audit.mjs — validate every extracted artifact (agents + skills, per the
 * user-mandated SCOPED manifest — NO commands/prompts) against the R2 audit
 * dimensions (plan.md Sub-Task 2).
 *
 * Usage:
 *   node scripts/audit.mjs               # summary; writes reports/audit.json + tasks/audit-report.md; exit 0/1
 *   node scripts/audit.mjs --json        # also prints the full JSON report to stdout
 *   node scripts/audit.mjs --report <p>  # override the markdown report destination
 *
 * Exit: 0 = no FAIL findings (warn-only deviations OK); 1 = FAIL (secrets/junk/parse/loop).
 * Expectations live in scripts/manifest.json (single source, reused by extract.mjs and ST5).
 * Parser + markdown rendering live in scripts/lib/ for reuse by ST5/ST6.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, splitFrontmatter } from './lib/frontmatter.mjs';
import { renderMarkdown } from './lib/report.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'manifest.json'), 'utf8'));
const MD_TARGET = path.join(REPO_ROOT, 'docs', 'plans', 'dev-harness-v2-plugin', 'tasks', 'audit-report.md');
const JSON_TARGET = path.join(REPO_ROOT, 'reports', 'audit.json');
const raw = (a) => fs.readFileSync(a, 'utf8');
const jp = (...p) => path.join(REPO_ROOT, ...p);
const failCount = { n: 0 };

// ---------- inventory ----------
function walkFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
function inventory() {
  const rel = (d) =>
    walkFiles(jp(d))
      .map((p) => path.relative(REPO_ROOT, p))
      .sort();
  const skillDirs = fs
    .readdirSync(jp('skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return {
    agents: rel('agents').filter((f) => f.endsWith('.md')),
    skillDirs,
  };
}
function kindOf(rel) {
  if (rel === 'skills/index.md') return 'index';
  if (rel.startsWith('skills/') && rel.endsWith('/SKILL.md')) return 'skill';
  if (rel.startsWith('agents/')) return 'agent';
  return 'other';
}

// ---------- per-file audit ----------
function add(rec, dim, sev, note) {
  rec.findings.push({ dimension: dim, severity: sev, note });
  if (sev === 'fail') failCount.n++;
}
function auditFile(rel) {
  const kind = kindOf(rel);
  let text;
  try {
    text = raw(jp(rel));
  } catch {
    // Crash-safety: a missing file on the audit surface becomes a FAIL finding,
    // not an unhandled ENOENT (P3-3 fix).
    return {
      file: rel,
      kind,
      lines: 0,
      frontmatter: { status: 'missing' },
      findings: [{ dimension: 'inventory', severity: 'fail', note: `file missing on audit surface: ${rel}` }],
    };
  }
  const rec = { file: rel, kind, lines: text.split('\n').length, frontmatter: null, findings: [] };
  const split = splitFrontmatter(text);
  if (!split) {
    rec.frontmatter = { status: kind === 'index' ? 'none-expected' : 'missing' };
    if (rec.frontmatter.status === 'missing') add(rec, 'frontmatter', 'fail', 'missing leading --- frontmatter');
  } else if (split.error) {
    rec.frontmatter = { status: 'parse-error' };
    add(rec, 'frontmatter', 'fail', split.error);
  } else {
    const { fields, errors } = parseFrontmatter(split.fm);
    rec.frontmatter = { status: errors.length ? 'parse-errors' : 'ok', errors, fields };
    for (const e of errors) add(rec, 'frontmatter', 'fail', `frontmatter: ${e}`);
    if (kind === 'agent' || kind === 'skill') {
      for (const f of ['name', 'description'])
        if (fields[f] === undefined) add(rec, 'frontmatter', 'fail', `missing required field '${f}'`);
      if (kind === 'agent')
        for (const f of ['mode', 'model'])
          if (fields[f] === undefined)
            add(rec, 'frontmatter', 'warn', `agent missing '${f}' (plugin registration impact)`);
      // M3 mandate: bundled agents must NOT carry the `permission` frontmatter key.
      if (kind === 'agent' && fields['permission'] !== undefined)
        add(rec, 'frontmatter', 'fail', 'permission key present (M3: strip from bundled agents)');
    }
    if ((kind === 'skill' || kind === 'agent') && fields.name !== undefined) {
      if (!new RegExp(MANIFEST.skillNameRegex).test(fields.name))
        add(rec, 'name', 'fail', `'${fields.name}' violates ${MANIFEST.skillNameRegex}`);
      if (kind === 'skill' && fields.name !== rel.split('/')[1])
        add(rec, 'name', 'warn', `frontmatter name '${fields.name}' != dir '${rel.split('/')[1]}'`);
    }
  }
  const limit = MANIFEST.lineLimits[kind === 'agent' ? 'agent' : 'skill'];
  if (limit && rec.lines > limit)
    add(
      rec,
      'size',
      'warn',
      `${rec.lines} lines > ${limit} (extracted verbatim; splitting source content is out of scope — recorded as deviation)`
    );
  return rec;
}

// ---------- cross-references ----------
function scanMentions(records) {
  const agents = new Set(
    records.filter((r) => r.kind === 'agent' && r.frontmatter?.fields?.name).map((r) => r.frontmatter.fields.name)
  );
  const skills = new Set(
    records.filter((r) => r.kind === 'skill' && r.frontmatter?.fields?.name).map((r) => r.frontmatter.fields.name)
  );
  for (const d of MANIFEST.loop.skills)
    if (d !== 'coding' && !skills.has(d) && fs.existsSync(jp('skills', d, 'SKILL.md'))) skills.add(d);
  const aliases = MANIFEST.agentAliases ?? {};
  const atAllow = new Set(MANIFEST.crossReference.allowedAtMentions);
  const kebabAllow = new Set(MANIFEST.crossReference.allowedKebabProse);
  const atFindings = [];
  const kebabFindings = new Map();
  const resolved = { agent: 0, skill: 0, alias: 0, code: 0, allow: 0 };
  for (const rec of records) {
    if (rec.kind === 'index') continue;
    if (rec.frontmatter?.status === 'missing') continue; // crash-safety: file absent → skip mention scan
    const text = splitFrontmatter(raw(jp(rec.file)))?.body ?? raw(jp(rec.file));
    let inCode = false;
    let lineNo = 0;
    for (const line of text.split('\n')) {
      lineNo++;
      if (/^\s*```/.test(line)) {
        inCode = !inCode;
        continue;
      }
      for (const m of line.matchAll(/\B@([a-z][a-z0-9-]*)/gi)) {
        const tok = m[1].toLowerCase();
        if (aliases[tok]) {
          resolved.alias++;
          continue;
        }
        if (agents.has(tok)) {
          resolved.agent++;
          continue;
        }
        if (skills.has(tok)) {
          resolved.skill++;
          continue;
        }
        if (inCode) {
          resolved.code++;
          continue;
        }
        if (atAllow.has(tok)) {
          resolved.allow++;
          continue;
        }
        atFindings.push({
          file: rec.file,
          line: lineNo,
          mention: `@${tok}`,
          severity: 'warn',
          note: 'unresolved @mention (external role/product or prose) — warn-only per plan',
        });
      }
      for (const m of line.matchAll(/\b([a-z][a-z0-9]+(?:-[a-z0-9]+)+)\b/g)) {
        const tok = m[1];
        if (agents.has(tok) || skills.has(tok) || aliases[tok]) {
          resolved.skill++;
          continue;
        }
        if (kebabAllow.has(tok)) continue;
        if (!kebabFindings.has(tok)) kebabFindings.set(tok, { count: 0, files: new Set() });
        const e = kebabFindings.get(tok);
        e.count++;
        e.files.add(rec.file);
      }
    }
  }
  const kebabList = [...kebabFindings.entries()]
    .map(([tok, e]) => ({ token: tok, count: e.count, files: [...e.files].slice(0, 6) }))
    .sort((a, b) => b.count - a.count);
  return { atFindings, kebabList, resolved };
}

// ---------- secrets & junk ----------
function scanSecrets(records) {
  const low = new RegExp(MANIFEST.secrets.lowSignaturePattern, 'gi');
  const highs = MANIFEST.secrets.highSignaturePatterns.map((p) => new RegExp(p));
  const allow = MANIFEST.secrets.proseAllowlist;
  const hits = [];
  let lowHits = 0;
  for (const rec of records) {
    let n = 0;
    if (rec.frontmatter?.status === 'missing') continue; // crash-safety: file absent → skip secret scan
    for (const line of raw(jp(rec.file)).split('\n')) {
      n++;
      lowHits += (line.match(low) || []).length;
      for (const h of highs) {
        if (h.test(line)) {
          const isProse = allow.some((a) => line.includes(a));
          hits.push({
            file: rec.file,
            line: n,
            pattern: h.source,
            severity: isProse ? 'info' : 'fail',
            snippet: line.trim().slice(0, 90),
          });
        }
      }
    }
  }
  const fails = hits.filter((h) => h.severity === 'fail');
  failCount.n += fails.length;
  return { lowHits, highSignature: hits, fails };
}
function junkReason(rel, base, isDir) {
  const seg = rel.split('/');
  for (const d of MANIFEST.junk.anySegmentDirNames) if (seg.includes(d)) return `junk dir (${d})`;
  for (const s of MANIFEST.junk.secretsFileNames) if (base === s || base.startsWith(s)) return 'secrets (.env*)';
  if (isDir) return null;
  for (const f of MANIFEST.junk.filePatterns) if (new RegExp(f.pattern).test(base)) return f.reason;
  return null;
}
function scanJunk() {
  const hits = [];
  const symlinks = [];
  for (const d of ['agents', 'skills']) {
    const walk = (dir, rel) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        const reason = junkReason(r, e.name, e.isDirectory());
        if (reason) hits.push(`${d}/${r} (${reason})`);
        if (e.isSymbolicLink()) symlinks.push(`${d}/${r}`);
        if (e.isDirectory()) walk(path.join(dir, e.name), r);
      }
    };
    walk(jp(d), '');
  }
  failCount.n += hits.length + symlinks.length;
  return { junk: hits, symlinks };
}

// ---------- loop, inventory checks, aggregation ----------
function checkLoop(records) {
  const skillSet = new Set(
    records
      .filter((r) => r.kind === 'skill')
      .map((r) => r.frontmatter?.fields?.name)
      .concat(MANIFEST.loop.skills.filter((s) => s !== 'dh-coding' && fs.existsSync(jp('skills', s, 'SKILL.md'))))
  );
  const agentSet = new Set(
    records
      .filter((r) => r.kind === 'agent')
      .map((r) => r.frontmatter?.fields?.name)
      .concat(MANIFEST.loop.agents.filter((a) => fs.existsSync(jp('agents', `${a}.md`))))
  );
  return {
    skills: MANIFEST.loop.skills.map((s) => ({
      name: s,
      status: skillSet.has(s)
        ? 'present'
        : (MANIFEST.loop.expectedPendingSkills ?? []).includes(s)
          ? 'expected-pending (ST3)'
          : 'missing',
    })),
    agents: MANIFEST.loop.agents.map((a) => ({ name: a, status: agentSet.has(a) ? 'present' : 'missing' })),
  };
}
function checkInventory(inv) {
  const exp = MANIFEST.sections;
  const problems = [];
  if (inv.agents.length !== exp.agents.expectedItems)
    problems.push(`agents ${inv.agents.length} != ${exp.agents.expectedItems}`);
  // Bundled skill count = manifest expectation (repo-authored tree)
  // bundled skills are repo-authored) — fallback to the legacy probe pair.
  const expectedSkills =
    MANIFEST.sections.skills.expectedItems ||
    0 ||
    (fs.existsSync(jp('skills', 'dh-coding', 'SKILL.md'))
      ? MANIFEST.bundledSkillMdCount.afterSt3
      : MANIFEST.bundledSkillMdCount.now);
  if (inv.skillDirs.length !== expectedSkills) problems.push(`skill dirs ${inv.skillDirs.length} != ${expectedSkills}`);
  if (!fs.existsSync(jp('skills', 'index.md'))) problems.push('skills/index.md missing');
  for (const out of ['commands', 'prompts']) {
    if (fs.existsSync(jp(out))) problems.push(`out-of-scope directory present: ${out}/`);
  }
  failCount.n += problems.length;
  return {
    problems,
    counts: {
      agents: inv.agents.length,
      skillDirs: inv.skillDirs.length,
      indexMd: fs.existsSync(jp('skills', 'index.md')),
    },
  };
}
function summarize(records, mentions, secrets, junk, loop, inv) {
  const dims = (name, count, sev, note) => ({ name, count, sev, note });
  const fails = records.flatMap((r) => r.findings.filter((f) => f.severity === 'fail'));
  const devs = records.flatMap((r) => r.findings.filter((f) => f.severity === 'warn'));
  const limit = (r) => MANIFEST.lineLimits[r.kind === 'agent' ? 'agent' : 'skill'];
  return {
    summary: {
      verdict: failCount.n === 0 ? 'PASS' : 'FAIL',
      dimensions: [
        dims(
          'Inventory & structure',
          inv.counts.agents + inv.counts.skillDirs,
          inv.problems.length ? 'FAIL' : 'PASS',
          inv.problems.join('; ') ||
            'counts match manifest (6 agents, 11 skill dirs + index.md; no commands/, no prompts/)'
        ),
        dims(
          'Frontmatter parse',
          records.filter((r) => r.frontmatter?.status === 'ok' || r.frontmatter?.status === 'none-expected').length,
          records.some((r) => r.frontmatter?.status === 'parse-error' || r.frontmatter?.status === 'missing')
            ? 'FAIL'
            : 'PASS',
          `${records.length} files on audit surface`
        ),
        dims(
          'Name regex',
          records.filter((r) => (r.kind === 'skill' || r.kind === 'agent') && r.frontmatter?.fields?.name).length,
          fails.some((f) => f.dimension === 'name') ? 'FAIL' : 'PASS',
          MANIFEST.skillNameRegex
        ),
        dims(
          'Size limits',
          records.filter((r) => r.lines > limit(r)).length,
          devs.some((d) => d.dimension === 'size') ? 'WARN' : 'PASS',
          'SKILL.md < 250, agents < 300; warn-only'
        ),
        dims(
          'Cross-references',
          mentions.atFindings.length,
          mentions.atFindings.length || mentions.kebabList.length ? 'WARN' : 'PASS',
          `${mentions.resolved.agent + mentions.resolved.skill + mentions.resolved.alias} resolved; ${mentions.resolved.code} code-context; ${mentions.resolved.allow} allowlisted; ${mentions.kebabList.length} prose tokens (warn); out-of-bundle mentions warn-only (external harness refs documented)`
        ),
        dims(
          'Loop membership',
          loop.skills.length + loop.agents.length,
          loop.skills.some((s) => s.status === 'missing') || loop.agents.some((a) => a.status === 'missing')
            ? 'FAIL'
            : 'PASS',
          `${loop.skills.filter((s) => s.status === 'present').length}/12 skills present + coding expected-pending (ST3); ${loop.agents.filter((a) => a.status === 'present').length}/6 agents present`
        ),
        dims(
          'Secret scan',
          secrets.lowHits + secrets.fails.length,
          secrets.fails.length ? 'FAIL' : 'PASS',
          `${secrets.lowHits} low-signature prose hits (instructional), ${secrets.fails.length} high-signature`
        ),
        dims(
          'Junk scan',
          junk.junk.length + junk.symlinks.length,
          junk.junk.length + junk.symlinks.length ? 'FAIL' : 'PASS',
          `${junk.junk.length} junk files, ${junk.symlinks.length} symlinks`
        ),
      ],
    },
    schemaDevs: records.flatMap((r) =>
      r.findings
        .filter((f) => f.dimension === 'schema-deviation')
        .map((f) => ({ file: r.file, dimension: f.dimension, severity: f.severity, note: f.note }))
    ),
    deviations: devs,
    fails,
  };
}

// ---------- main ----------
function main() {
  const args = process.argv.slice(2);
  const mdTarget = args.includes('--report') ? path.resolve(args[args.indexOf('--report') + 1]) : MD_TARGET;
  const inv = inventory();
  const surface = [...inv.agents, ...inv.skillDirs.map((d) => `skills/${d}/SKILL.md`), 'skills/index.md'];
  const records = surface.map(auditFile);
  const mentions = scanMentions(records);
  const secrets = scanSecrets(records);
  const junk = scanJunk();
  const loop = checkLoop(records);
  const invCheck = checkInventory(inv);
  const report = {
    meta: {
      generated: new Date().toISOString(),
      repo: REPO_ROOT,
      script: 'scripts/audit.mjs',
      reRun: 'node scripts/audit.mjs',
    },
    exitCode: failCount.n === 0 ? 0 : 1,
    ...summarize(records, mentions, secrets, junk, loop, invCheck),
    atMentions: mentions.atFindings,
    kebabList: mentions.kebabList,
    secretLow: secrets.lowHits,
    secretHigh: secrets.highSignature,
    junkList: junk.junk,
    symlinkCount: junk.symlinks.length,
    loop,
    records,
  };
  fs.mkdirSync(path.dirname(JSON_TARGET), { recursive: true });
  fs.writeFileSync(JSON_TARGET, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdTarget, renderMarkdown(report));
  const j = {
    verdict: report.summary.verdict,
    dimensions: report.summary.dimensions.map((d) => ({ name: d.name, status: d.sev })),
    failFindings: report.fails.length,
    warnDeviations: report.deviations.length,
    schemaDeviations: report.schemaDevs.length,
    loop: { skills: loop.skills, agents: loop.agents },
    unresolvedAtMentions: mentions.atFindings.length,
    unresolvedKebabTokens: mentions.kebabList.length,
    secretFailures: secrets.fails.length,
    junkFiles: junk.junk.length,
    symlinks: junk.symlinks.length,
    exitCode: failCount.n === 0 ? 0 : 1,
  };
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  console.log(JSON.stringify(j, null, 2));
  console.log(`\nMarkdown report: ${mdTarget}\nJSON report:     ${JSON_TARGET}`);
  process.exitCode = failCount.n === 0 ? 0 : 1;
}

main();
