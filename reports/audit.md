# Audit Report — dev-harness-skills plugin

Generated 2026-11-08T16:03:12.201Z by `scripts/audit.mjs`.

## Verdict

**PASS** — FAIL findings: **0** (exit code 0). Warn deviations: 240. Documented schema deviations: 0.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
| Inventory & structure | 29 | PASS | 5 agents, 24 skill dirs + index.md; no commands/, no prompts/ |
| Frontmatter parse | 30 | PASS | 30 files on audit surface |
| Name regex | 29 | PASS | /^[a-z0-9]+(-[a-z0-9]+)*$/ |
| Size limits | 0 | PASS | SKILL.md < 250, agents < 300; warn-only |
| Cross-references | 2 | WARN | 468 resolved; 0 code-context; 0 allowlisted; 233 prose tokens (warn) |
| Loop membership | 29 | PASS | 24/24 skills present; 5/5 agents present |
| Secret scan | 44 | PASS | 44 low-signature prose hits (instructional), 0 high-signature |
| Junk scan | 0 | PASS | 0 junk files, 0 symlinks |

## Deviations (warn, per file)

| File | Dimension | Severity | Note |
|---|---|---|---|
| agents/dh-documentor.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
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
| skill | dh-execute-cli | present |
| skill | dh-execute-plan | present |
| skill | dh-execute-plan-fast | present |
| skill | dh-execute-plan-task | present |
| skill | dh-execute-plan-task-fast | present |
| skill | dh-explore | present |
| skill | dh-final-review | present |
| skill | dh-grill-sdd | present |
| skill | dh-mermaid | present |
| skill | dh-pause-plan | present |
| skill | dh-planning | present |
| skill | dh-preflight | present |
| skill | dh-resume-plan | present |
| skill | dh-review | present |
| skill | dh-semver | present |
| skill | dh-setup | present |
| skill | dh-simplify | present |
| agent | dh-documentor | present |
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

- `agent-selection` × 47
- `project-name` × 28
- `per-task` × 17
- `final-review` × 13
- `pre-execution` × 13
- `project-scope` × 12
- `plan-end` × 12
- `plan-fast-skip-checks` × 8
- `osv-scanner` × 7
- `plan-fast-template` × 6
- `skip-checks` × 6
- `artifact-check` × 6
- `re-pause` × 6
- `handoff-template` × 6
- `domain-check` × 5
- `status-based` × 5
- `re-validation` × 5
- `read-only` × 5
- `phased-plan-template` × 5
- `bounded-context` × 4
- `type-based` × 4
- `re-enter` × 4
- `dry-run` × 4
- `review-fast` × 4
- `review-fast-final` × 4

## Secret scan

- Low-signature prose hits (instructional): **44** (env-var names, max_tokens, "never expose" rules).
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
