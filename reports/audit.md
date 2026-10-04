# Audit Report — dev-harness-skills plugin

Generated 2026-10-04T19:10:30.545Z by `scripts/audit.mjs`.

## Verdict

**PASS** — FAIL findings: **0** (exit code 0). Warn deviations: 139. Documented schema deviations: 0.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
| Inventory & structure | 23 | PASS | 7 agents, 16 skill dirs + index.md; no commands/, no prompts/ |
| Frontmatter parse | 24 | PASS | 24 files on audit surface |
| Name regex | 23 | PASS | /^[a-z0-9]+(-[a-z0-9]+)*$/ |
| Size limits | 0 | PASS | SKILL.md < 250, agents < 300; warn-only |
| Cross-references | 1 | WARN | 414 resolved; 1 code-context; 0 allowlisted; 131 prose tokens (warn) |
| Loop membership | 23 | PASS | 16/16 skills present; 7/7 agents present |
| Secret scan | 26 | PASS | 26 low-signature prose hits (instructional), 0 high-signature |
| Junk scan | 0 | PASS | 0 junk files, 0 symlinks |

## Deviations (warn, per file)

| File | Dimension | Severity | Note |
|---|---|---|---|
| agents/dh-documentor.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-executor.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-explorer.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-final-reviewer.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-reviewer.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-software-architect.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-software-engineer.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |

## Schema deviations (known content deviations)

_None._

## Loop membership

| Kind | Name | Status |
|---|---|---|
| skill | dh-artifact-check | present |
| skill | dh-code-review | present |
| skill | dh-code-ruler | present |
| skill | dh-coding | present |
| skill | dh-contingency | present |
| skill | dh-create-documentation | present |
| skill | dh-domain-check | present |
| skill | dh-execute-plan | present |
| skill | dh-execute-plan-task | present |
| skill | dh-final-review | present |
| skill | dh-grill-sdd | present |
| skill | dh-planning | present |
| skill | dh-preflight | present |
| skill | dh-review | present |
| skill | dh-setup | present |
| skill | dh-simplify | present |
| agent | dh-documentor | present |
| agent | dh-executor | present |
| agent | dh-explorer | present |
| agent | dh-final-reviewer | present |
| agent | dh-reviewer | present |
| agent | dh-software-architect | present |
| agent | dh-software-engineer | present |

## Cross-reference failures

| File | Line | Mention | Note |
|---|---|---|---|
| skills/dh-setup/SKILL.md | 90 | @graphify | unresolved @mention (external role/product or prose) — warn-only per plan |

Unresolved prose tokens (kebab-case, non-bundled, warn-level — top 25 shown; full list in reports/audit.json):

- `project-name` × 22
- `osv-scanner` × 7
- `phased-plan-template` × 5
- `bounded-context` × 4
- `mobile-mcp` × 4
- `state-sync` × 3
- `non-blocking` × 3
- `implementation-agnostic` × 3
- `chrome-devtools-mcp` × 3
- `opencode-rules` × 3
- `pre-commit` × 3
- `dependency-cruiser` × 2
- `language-standard` × 2
- `system-wide` × 2
- `project-level` × 2
- `knip-style` × 2
- `per-item` × 2
- `best-effort` × 2
- `domain-check` × 2
- `anti-corruption` × 2
- `re-running` × 2
- `code-level` × 2
- `re-review` × 2
- `user-level` × 2
- `cross-references` × 1

## Secret scan

- Low-signature prose hits (instructional): **26** (env-var names, max_tokens, "never expose" rules).
- High-signature matches: **0** _none_.

## Junk scan

- Junk files: **0** _(none)_.
- Symlinks: **0**.

## Re-run

```bash
node scripts/audit.mjs            # full run (regenerates reports/audit.json + this file)
node scripts/audit.mjs --json     # also dump full JSON report to stdout
node scripts/audit.mjs --report <path>   # redirect the markdown report
```
