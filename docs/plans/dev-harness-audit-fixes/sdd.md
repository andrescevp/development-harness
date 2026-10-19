---
title: Dev Harness Audit Fixes
slug: dev-harness-audit-fixes
description: >
  Close the 2026-10-11 harness audit gaps selected for fixing: bundled
  dh-semver skill, dot-namespace tool references, truthful counts and
  checklists, @opencode/plugin version consistency, and a stale
  audit-script comment.
tags: [sdd, design]
project: dev-harness-skills
stack: TypeScript / Markdown (OpenCode V2 plugin)
created: 2026-10-18
updated: 2026-10-18
status: proposed
---

# Software Design Document: Dev Harness Audit Fixes

## Problem Statement

The 2026-10-11 audit of `dev-harness-skills` found the automated gates green
but five documentation/contract gaps that mislead agents, operators, and the
audit tooling itself:

1. `AGENTS.md` references a `dh-semver` skill that does not exist (dangling).
2. Harness docs/skills/agents reference plugin tools by underscore names
   (`dh_plan_read`, `dh_logged_command`, `dh_read_sheet`, …) while the plugin
   registers them under the `dh` namespace with dot names (`dh.plan_read`,
   `dh.logged_command`, `dh.read_sheet`, …) — agents following the docs
   cannot resolve the tools.
3. Skill counts are stale: README/LOADING say "15 skills", checklists omit
   `dh-contingency`, and the LOADING agent checklist omits `dh-documentor`
   and drops `dh-` prefixes.
4. `docs/LOADING.md` contradicts itself and `package.json` on the pinned
   `@opencode/plugin` version (`^2.0.18` vs `^2.0.20`).
5. `scripts/audit.mjs` header comment claims it writes
   `tasks/audit-report.md`; it actually writes `reports/audit.md`.

The requester selected points 1, 2, 3, 4, and 7 (of the audit report's
numbered findings) and directed that **`dh-semver` must be the global
`semver` skill adapted to the harness**.

## Goals / Non-Goals

- **Goals:** eliminate gaps 1, 2, 3, 4, and 7; keep the harness corpus,
  tests, and docs mutually consistent at `7 agents + 17 skills`.
- **Non-goals:** audit points 5 (stale config assets: `link-dh-global.sh`,
  `opencode.example.jsonc`, `demo-project/*`) and 6 (the "Bundled scope"
  note); any change to plugin runtime behavior beyond count contracts;
  `demo-project/` updates.

## Requirements

- **R1:** The bundle ships a `dh-semver` skill — the global `semver` skill
  adapted to the harness — so the `AGENTS.md` reference resolves, and every
  bundled reference that points to the versioning *skill* points to
  `dh-semver`.
- **R2:** All tool references in the active docs surface (`README.md`,
  `AGENTS.md`, `docs/LOADING.md`, `skills/`, `agents/`) use the registered
  dot names (`dh.plan_read`, `dh.plan_update_status`, `dh.plan_create`,
  `dh.logged_command`, `dh.read_sheet`, `dh.update_sheet`,
  `dh.sheet_schema`); zero underscore aliases remain.
- **R3:** Skill/agent counts and verification checklists reflect the actual
  bundle (`7 agents + 17 skills`); the LOADING checklist lists all 7 agents
  (`dh-` prefixed) and all 17 skills, including `dh-contingency` and
  `dh-semver`.
- **R4:** `docs/LOADING.md` states the pinned `@opencode/plugin` version
  consistently at `^2.0.20` (historical v2.0.18 limitation notes stay).
- **R5:** `scripts/audit.mjs` header comment describes its real outputs
  (`reports/audit.md`, `reports/audit.json`).

## Scope

- **In scope:** the five fix areas; count/test contracts that the new skill
  forces to move (`scripts/lib/shared.mjs` loop list, `assets.test.ts`,
  `frontmatter.test.ts`, `registration.test.ts`, `src/plugin.ts` comment);
  regenerated `reports/audit.md` + `reports/audit.json`; `docs/plans/index.md`
  row for this plan; **amendment (2026-10-19, user-approved):** the
  gate-blocking transitive-dependency fix (`source-map-js` override) found
  during validation.
- **Out of scope:** audit points 5 and 6 (explicitly deferred by the
  requester); `demo-project/` counts and underscore refs (point 5 family);
  runtime tool aliasing (R2 is fixed in docs only).

## Constraints

- Bundled skill conventions: frontmatter with `name` + `description`
  (+ `license`, `compatibility`, `allowed-tools`, `metadata` mirroring the
  global skill), SKILL.md < 250 lines, `dh-<kebab>` name regex, no
  `permission` key on agents.
- Adding one skill changes the corpus from 16 to 17 skills → every count
  contract (tests, loop list, docs) must move in the same change set or
  `pnpm test` / `pnpm run audit` fail.
- `registration.test.ts` runs against the built `dist/plugin.js` → a
  `pnpm build` (copy-assets) is required before the test run.
- Repo QA gate: `pnpm run audit`, `node scripts/check-links.mjs`,
  `pnpm test`; Git Flow branch off `develop`.

## Risks and Edge Cases

- Blind search/replace of "semver" would corrupt generic prose — only skill
  invocations/pointers get renamed; the concept word stays.
- Count sites are scattered (comments, tests, docs) — miss one and the
  suite or audit fails; use grep-driven checklists.
- The global `semver` skill references the `/release` command and
  `@executor`; the harness bundles no commands and uses `@dh-executor` —
  the adaptation must rewire both.
- `dist/` is gitignored but read by tests; forgetting `pnpm build` after
  the corpus change yields stale 16-skill registrations.

## Acceptance Criteria

- **AC1:** `skills/dh-semver/SKILL.md` exists; audit loop membership reports
  `17/17 skills present`; `AGENTS.md`'s `dh-semver` reference resolves.
- **AC2:** `rg "dh_plan_|dh_logged_command|dh_read_sheet|dh_update_sheet|dh_sheet_schema"`
  over `agents/ skills/ README.md AGENTS.md docs/LOADING.md` returns 0.
- **AC3:** No "15 `dh-*` skills" / "15 skills" strings remain in the active
  surface; counts read 17; the LOADING checklist enumerates 7 agents + 17
  skills.
- **AC4:** `docs/LOADING.md` `^2.0.18` remains only in historical
  limitation notes; the "Version skew" bullet says `^2.0.20`.
- **AC5:** `pnpm build`, `pnpm test`, `node scripts/audit.mjs` (PASS, 0
  fails), and `node scripts/check-links.mjs` (0 dead refs) all succeed;
  `scripts/audit.mjs` comment matches actual output paths.

## Open Questions

- Deferred follow-ups (non-blocking): audit point 5 (stale config assets),
  point 6 ("Bundled scope" note in `skills/index.md`), and the
  `demo-project/` counts/underscore references (`docs/index.md`).
