# ST6 Verification Report — dev-harness-v2-plugin

Date: 2026-09-28 · Branch: feat/dev-harness-v2-plugin · opencode v2.0.18 · node v24.18.0 · pnpm 11.9.0

## Gate commands (all pass)

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS (tsc --noEmit, exit 0) |
| `pnpm build` | PASS (tsup ESM + tsc declarations + copy-assets; dist/plugin.js 6.95 KB) |
| `pnpm test` | PASS — **51 tests / 51** (frontmatter 26, records 11, assets 6, manifest 6, registration 2) |
| `node scripts/smoke-load.mjs` | PASS (valid `Plugin.define` value) |
| `node scripts/audit.mjs` | PASS (FAIL findings 0; loop 12/12 skills + 6/6 agents) |
| `node scripts/extract.mjs --check` | PASS (agents 6, skills 12 dirs + index.md, no commands/, no prompts/) |
| Asset counts | PASS — dist/assets: 6 agent .md, 12 SKILL.md, index.md |

## Registration test (stub ctx, real bundle)

`src/__tests__/registration.test.ts` runs the REAL built plugin `setup()` against a stub ctx:
- Registered **6 agents**: software-architect, software-engineer, reviewer, final-reviewer, executor, explorer ✓
- Registered **12 skills**: artifact-check, simplify, domain-check, coding, code-review, execute-plan, execute-plan-task, final-review, planning, preflight, review, create-documentation ✓
- **0 command registrations** (stub has no command domain; every capture is agent/skill) ✓
- Log: `[dev-harness-skills] registered 6 agents, 12 skills`

## Unit suite coverage

- Frontmatter parser: real corpus (6 agents + 12 skills) parses; `>` multi-line folding; name regex `^[a-z0-9]+(-[a-z0-9]+)*$` over all 18 names; error cases (missing `---`, unterminated, non-mapping top-level).
- Record builders: V1→V2 permissions mapping (tools→allow/deny wildcard, write/patch→edit, string→wildcard, nested→per-resource, ordering), model split at last `/`, mode default, throw on missing name/description/mode; Skill.Info shape.
- Asset loader: real repo layout loads 6+12 with zero errors; temp fixtures collect per-file errors (missing frontmatter) instead of throwing; missing root returns empty (never throws).

## Real-session verification (opencode v2.0.18) — LIMITATION DOCUMENTED

Attempts in scratch dir + scratch `opencode.jsonc`:

1. `"plugins": ["file:///home/andres/workspace/dev-harness-skills/dist/plugin.js"]`
   → **Not loaded.** Log: `WARN "configured plugin path must be a directory" target=.../dist/plugin.js`.
   → Confirmed v2 behavior: `file://` plugin entries must point to a **directory**, not a file.
2. `"plugins": ["file:///home/andres/workspace/dev-harness-skills"]` (package dir) → accepted (no warning) but our agents not surfaced (`opencode debug agents` shows only global harness agents; `opencode run --agent software-architect` → `Agent not found`).
3. `"plugins": ["/home/andres/workspace/dev-harness-skills"]` (absolute path) → same result.
4. Scratch `.opencode/plugins/dev-harness/{plugin.js,assets,package.json,index.js}` (auto-load convention) → same result; no plugin-load log line, no error.

**Conclusion (degradation path per plan):** the local opencode v2.0.18 host did not surface plugin-registered agents through any of the four load forms attempted; no plugin-load error was emitted for directory/path/auto-load forms (only the file://-to-file form was explicitly rejected). The in-harness verification therefore relies on the stub-context registration test (passing) + smoke-load (passing). Root cause is undetermined between (a) plugin load/config discovery for non-installed packages and (b) agent `editor.update` upsert semantics in the live host. This is a documented open question for README troubleshooting / future host-version verification — the plugin contract itself follows the create-update-opencode-plugin skill (verified against `@opencode/plugin@2.0.18` typings + host source in ST5).

## Open questions / follow-ups

- [ ] Verify agent upsert vs add semantics against the live host after configurable plugin loading is confirmed (or via `opencode publish`/installed package form).
- [ ] Optionally publish/install the package (`pnpm pack` + `opencode plugin add`) and re-run the real-session check.