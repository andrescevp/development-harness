# Audit Report — Dev Harness V2 Plugin (ST2)

Generated 2026-09-28T12:03:28.063Z by `scripts/audit.mjs`.

## Verdict

**PASS** — FAIL findings: **0** (exit code 0). Warn deviations: 127. Documented schema deviations: 0.

## Summary verdict table

| Dimension | Count | Status | Notes |
|---|---|---|---|
| Inventory & structure | 20 | PASS | counts match manifest (6 agents, 11 skill dirs + index.md; no commands/, no prompts/) |
| Frontmatter parse | 21 | PASS | 21 files on audit surface |
| Name regex | 20 | PASS | ^[a-z0-9]+(-[a-z0-9]+)*$ |
| Size limits | 0 | PASS | SKILL.md < 250, agents < 300; warn-only |
| Cross-references | 7 | WARN | 258 resolved; 1 code-context; 0 allowlisted; 120 prose tokens (warn); out-of-bundle mentions warn-only (external harness refs documented) |
| Loop membership | 18 | PASS | 12/12 skills present + coding expected-pending (ST3); 6/6 agents present |
| Secret scan | 21 | PASS | 21 low-signature prose hits (instructional), 0 high-signature |
| Junk scan | 0 | PASS | 0 junk files, 0 symlinks |

## Deviations (warn, per file)

_None._

## Schema deviations (known source-content issues, documented in manifest.json)

_None._

## Loop membership

| Kind | Name | Status |
|---|---|---|
| skill | dh-artifact-check | present |
| skill | dh-simplify | present |
| skill | dh-domain-check | present |
| skill | dh-code-review | present |
| skill | dh-execute-plan | present |
| skill | dh-execute-plan-task | present |
| skill | dh-final-review | present |
| skill | dh-planning | present |
| skill | dh-preflight | present |
| skill | dh-review | present |
| skill | dh-create-documentation | present |
| skill | dh-coding | present |
| agent | dh-software-architect | present |
| agent | dh-software-engineer | present |
| agent | dh-reviewer | present |
| agent | dh-final-reviewer | present |
| agent | dh-executor | present |
| agent | dh-explorer | present |

## Cross-reference failures

| File | Line | Mention | Note |
|---|---|---|---|
| agents/dh-software-engineer.md | 53 | @executor | unresolved @mention (external role/product or prose) — warn-only per plan |
| agents/dh-software-engineer.md | 54 | @reviewer | unresolved @mention (external role/product or prose) — warn-only per plan |
| agents/dh-software-engineer.md | 56 | @executor | unresolved @mention (external role/product or prose) — warn-only per plan |
| agents/dh-software-engineer.md | 63 | @executor | unresolved @mention (external role/product or prose) — warn-only per plan |
| agents/dh-software-engineer.md | 83 | @executor | unresolved @mention (external role/product or prose) — warn-only per plan |
| agents/dh-software-engineer.md | 83 | @executor | unresolved @mention (external role/product or prose) — warn-only per plan |
| skills/dh-planning/SKILL.md | 29 | @build | unresolved @mention (external role/product or prose) — warn-only per plan |

Unresolved prose tokens (kebab-case, non-bundled, warn-level — top 25 shown; full list in reports/audit.json):

- `osv-scanner` × 7
- `phased-plan-template` × 5
- `state-sync` × 3
- `non-blocking` × 3
- `implementation-agnostic` × 3
- `chrome-devtools-mcp` × 3
- `opencode-rules` × 3
- `pre-commit` × 3
- `architect-skills` × 2
- `dependency-cruiser` × 2
- `dh-contingency` × 2
- `bounded-context` × 2
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
- `android-remote-control-mcp` × 2

## Secret scan

- Low-signature prose hits (instructional): **21** (env-var names, max_tokens, "never expose" rules).
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
