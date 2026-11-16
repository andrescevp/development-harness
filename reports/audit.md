# Audit Report — dev-harness-skills plugin

Generated 2026-11-16T14:04:10.894Z by `scripts/audit.mjs`.

## Verdict

**PASS** — FAIL findings: **0** (exit code 0). Warn deviations: 327. Documented schema deviations: 0.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
| Inventory & structure | 33 | PASS | 6 agents, 27 skill dirs + index.md; no commands/, no prompts/ |
| Frontmatter parse | 34 | PASS | 34 files on audit surface |
| Name regex | 33 | PASS | /^[a-z0-9]+(-[a-z0-9]+)*$/ |
| Size limits | 0 | PASS | SKILL.md < 250, agents < 300; warn-only |
| Cross-references | 1 | WARN | 598 resolved; 0 code-context; 0 allowlisted; 320 prose tokens (warn) |
| Loop membership | 33 | PASS | 27/27 skills present; 6/6 agents present |
| Secret scan | 54 | PASS | 54 low-signature prose hits (instructional), 0 high-signature |
| Junk scan | 0 | PASS | 0 junk files, 0 symlinks |

## Deviations (warn, per file)

| File | Dimension | Severity | Note |
|---|---|---|---|
| agents/dh-documentor.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-final-reviewer.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
| agents/dh-researcher.md | frontmatter | warn | agent missing 'model' (plugin registration impact) |
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
| skill | dh-code-query | present |
| skill | dh-contingency | present |
| skill | dh-create-documentation | present |
| skill | dh-create-worktree | present |
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
| skill | dh-research | present |
| skill | dh-resume-plan | present |
| skill | dh-review | present |
| skill | dh-semver | present |
| skill | dh-setup | present |
| skill | dh-simplify | present |
| agent | dh-documentor | present |
| agent | dh-final-reviewer | present |
| agent | dh-researcher | present |
| agent | dh-reviewer | present |
| agent | dh-software-architect | present |
| agent | dh-software-engineer | present |

## Cross-reference failures

| File | Line | Mention | Note |
|---|---|---|---|
| skills/dh-setup/SKILL.md | 55 | @playwright | unresolved @mention (external role/product or prose) — warn-only per plan |

Unresolved prose tokens (kebab-case, non-bundled, warn-level — top 25 shown; full list in reports/audit.json):

- `agent-selection` × 39
- `project-name` × 30
- `per-task` × 20
- `execution-record` × 16
- `workspace-diff-scope` × 14
- `parallel-scheduler` × 14
- `workspace-docs` × 13
- `pre-execution` × 13
- `plan-end` × 13
- `workspace-map` × 12
- `tests-reaching` × 12
- `final-review` × 12
- `project-scope` × 11
- `repo-path` × 11
- `parallel-worker` × 11
- `read-only` × 10
- `qualified-name` × 9
- `plan-fast-skip-checks` × 8
- `package-scope` × 8
- `package-local` × 7
- `osv-scanner` × 7
- `in-flight` × 7
- `test-only` × 7
- `code-rules-resolution` × 6
- `plan-fast-template` × 6

## Secret scan

- Low-signature prose hits (instructional): **54** (env-var names, max_tokens, "never expose" rules).
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
