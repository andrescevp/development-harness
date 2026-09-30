/**
 * lib/report.mjs — renders the human-readable markdown audit report from the
 * audit result object (kept separate from scripts/audit.mjs to hold files under
 * the 300-line rule and to be independently reviewable).
 */

export function renderMarkdown(r) {
  const allFindings = r.records.flatMap((rec) =>
    rec.findings.map((f) => ({ file: rec.file, dimension: f.dimension, severity: f.severity, note: f.note }))
  );
  const warns = allFindings.filter((f) => f.severity === 'warn' && f.dimension !== 'schema-deviation');
  // Cross-reference warns (@mentions + prose kebab tokens) are listed in their own
  // sections below; include them in the header count so "Warn deviations" is not misleading.
  const headerWarns = warns.length + (r.atMentions?.length ?? 0) + (r.kebabList?.length ?? 0);
  const atTop = r.atMentions.slice(0, 20);
  const kebabTop = r.kebabList.slice(0, 25);
  const hiSec = r.secretHigh;
  const junkList = r.junkList;
  return `# Audit Report — dev-harness-skills plugin

Generated ${r.meta.generated} by \`${r.meta.script}\`.

## Verdict

**${r.summary.verdict}** — FAIL findings: **${r.fails.length}** (exit code ${r.exitCode}). Warn deviations: ${headerWarns}. Documented schema deviations: ${r.schemaDevs.length}.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
${r.summary.dimensions.map((d) => `| ${d.name} | ${d.count} | ${d.sev} | ${d.note} |`).join('\n')}

## Deviations (warn, per file)

${warns.length ? '| File | Dimension | Severity | Note |\n|---|---|---|---|\n' + warns.map(rowMd).join('\n') : '_None._'}

## Schema deviations (known content deviations)

${r.schemaDevs.length ? '| File | Severity | Note |\n|---|---|---|---|\n' + r.schemaDevs.map((d) => `| ${d.file} | ${d.severity} | ${d.note} |`).join('\n') : '_None._'}

## Loop membership

| Kind | Name | Status |
|---|---|---|
${r.loop.skills.map((s) => `| skill | ${s.name} | ${s.status} |`).join('\n')}
${r.loop.agents.map((a) => `| agent | ${a.name} | ${a.status} |`).join('\n')}

## Cross-reference failures

${atTop.length ? '| File | Line | Mention | Note |\n|---|---|---|---|\n' + atTop.map((m) => `| ${m.file} | ${m.line} | ${m.mention} | ${m.note} |`).join('\n') : '_None (all @mentions resolve to bundled agents/skills, aliases, code context, or the curated allowlist)._'}

Unresolved prose tokens (kebab-case, non-bundled, warn-level — top 25 shown; full list in reports/audit.json):

${kebabTop.length ? kebabTop.map((k) => `- \`${k.token}\` × ${k.count}`).join('\n') : '_None._'}

## Secret scan

- Low-signature prose hits (instructional): **${r.secretLow}** (env-var names, max_tokens, "never expose" rules).
- High-signature matches: **${hiSec.length}** ${
    hiSec.length
      ? '(top: ' +
        hiSec
          .slice(0, 5)
          .map((h) => `\`${h.pattern}\` @ ${h.file}:${h.line}`)
          .join('; ') +
        ')'
      : '_none_'
  }.

## Junk scan

- Junk files: **${junkList.length}** ${junkList.length ? '— ' + junkList.join('; ') : '_(none)_'}.
- Symlinks: **${r.symlinkCount}**.

## Re-run

\`\`\`bash
node scripts/audit.mjs            # full run (regenerates reports/audit.json + this file)
node scripts/audit.mjs --json     # also dump full JSON report to stdout
node scripts/audit.mjs --report <path>   # redirect the markdown report
\`\`\`
`;
}

function rowMd(f) {
  return `| ${f.file} | ${f.dimension} | ${f.severity} | ${f.note} |`;
}
