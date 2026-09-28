# Audit Report — Dev Harness V2 Plugin (ST2)

Generated 2026-09-28T08:01:46.507Z by `scripts/audit.mjs`.

## Verdict

**PASS** — FAIL findings: **0** (exit code 0). Warn deviations: 75. Documented schema deviations: 0.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
| Inventory & structure | 18 | PASS | counts match manifest (6 agents, 11 skill dirs + index.md; no commands/, no prompts/) |
| Frontmatter parse | 19 | PASS | 19 files on audit surface |
| Name regex | 18 | PASS | ^[a-z0-9]+(-[a-z0-9]+)*$ |
| Size limits | 0 | PASS | SKILL.md < 250, agents < 300; warn-only |
| Cross-references | 1 | WARN | 193 resolved; 0 code-context; 0 allowlisted; 74 prose tokens (warn); out-of-bundle mentions warn-only (external harness refs documented) |
| Loop membership | 18 | PASS | 12/12 skills present + coding expected-pending (ST3); 6/6 agents present |
| Secret scan | 16 | PASS | 16 low-signature prose hits (instructional), 0 high-signature |
| Junk scan | 0 | PASS | 0 junk files, 0 symlinks |

## Deviations (warn, per file)

_None._

## Schema deviations (known source-content issues, documented in manifest.json)

_None._

## Loop membership

| Kind | Name | Status |
|---|---|---|
| skill | planning | present |
| skill | domain-check | present |
| skill | execute-plan | present |
| skill | execute-plan-task | present |
| skill | simplify | present |
| skill | review | present |
| skill | code-review | present |
| skill | preflight | present |
| skill | artifact-check | present |
| skill | final-review | present |
| skill | create-documentation | present |
| skill | coding | present |
| agent | software-architect | present |
| agent | software-engineer | present |
| agent | reviewer | present |
| agent | final-reviewer | present |
| agent | executor | present |
| agent | explorer | present |

## Cross-reference failures

| File | Line | Mention | Note |
|---|---|---|---|
| skills/planning/SKILL.md | 29 | @build | unresolved @mention (external role/product or prose) — warn-only per plan |

Unresolved prose tokens (kebab-case, non-bundled, warn-level — top 25 shown; full list in reports/audit.json):

- `state-sync` × 5
- `phased-plan-template` × 5
- `architect-skills` × 2
- `bounded-context` × 2
- `system-wide` × 2
- `anti-corruption` × 2
- `re-running` × 2
- `code-level` × 2
- `re-review` × 2
- `full-file` × 1
- `system-level` × 1
- `data-flow` × 1
- `infrastructure-as-code` × 1
- `cross-cutting` × 1
- `tool-specific` × 1
- `osv-scanner` × 1
- `at-least-once` × 1
- `zero-downtime` × 1
- `stop-and-start` × 1
- `framework-native` × 1
- `third-party` × 1
- `bash-based` × 1
- `language-standard` × 1
- `hard-code` × 1
- `non-zero` × 1

## Secret scan

- Low-signature prose hits (instructional): **16** (env-var names, max_tokens, "never expose" rules).
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
