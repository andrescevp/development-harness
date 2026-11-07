# Audit Report — dev-harness-skills plugin

Generated 2026-11-07T06:18:30.476Z by `scripts/audit.mjs`.

## Verdict

**PASS** — FAIL findings: **0** (exit code 0). Warn deviations: 174. Documented schema deviations: 0.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
| Inventory & structure | 26 | PASS | 7 agents, 19 skill dirs + index.md; no commands/, no prompts/ |
| Frontmatter parse | 27 | PASS | 27 files on audit surface |
| Name regex | 26 | PASS | /^[a-z0-9]+(-[a-z0-9]+)*$/ |
| Size limits | 0 | PASS | SKILL.md < 250, agents < 300; warn-only |
| Cross-references | 2 | WARN | 492 resolved; 0 code-context; 0 allowlisted; 165 prose tokens (warn) |
| Loop membership | 26 | PASS | 19/19 skills present; 7/7 agents present |
| Secret scan | 38 | PASS | 38 low-signature prose hits (instructional), 0 high-signature |
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
| skill | dh-pause-plan | present |
| skill | dh-planning | present |
| skill | dh-preflight | present |
| skill | dh-resume-plan | present |
| skill | dh-review | present |
| skill | dh-semver | present |
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
| skills/dh-setup/SKILL.md | 64 | @playwright | unresolved @mention (external role/product or prose) — warn-only per plan |
| skills/dh-setup/SKILL.md | 81 | @graphify | unresolved @mention (external role/product or prose) — warn-only per plan |

Unresolved prose tokens (kebab-case, non-bundled, warn-level — top 25 shown; full list in reports/audit.json):

- `project-name` × 25
- `project-scope` × 11
- `osv-scanner` × 7
- `handoff-template` × 6
- `re-pause` × 5
- `phased-plan-template` × 5
- `bounded-context` × 4
- `status-based` × 4
- `read-only` × 4
- `mobile-mcp` × 4
- `cross-cutting` × 3
- `state-sync` × 3
- `non-blocking` × 3
- `best-effort` × 3
- `one-line` × 3
- `implementation-agnostic` × 3
- `auto-pick` × 3
- `in-flight` × 3
- `pre-write` × 3
- `re-pausing` × 3
- `chrome-devtools-mcp` × 3
- `opencode-rules` × 3
- `pre-commit` × 3
- `development-harness` × 3
- `dependency-cruiser` × 2

## Secret scan

- Low-signature prose hits (instructional): **38** (env-var names, max_tokens, "never expose" rules).
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
