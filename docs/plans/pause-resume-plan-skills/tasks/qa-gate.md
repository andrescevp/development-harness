---
title: QA Gate Evidence — Pause and Resume Plan Skills
slug: pause-resume-qa-gate
description: Full release-gate results for the pause/resume skills, including the accepted pre-existing dependency-scan exception.
tags: [qa, gate, handoff]
project: dev-harness-skills
created: 2026-11-07
updated: 2026-11-07
status: completed
---

# QA Gate Evidence

## Gate Results

Command: `pnpm qa:check:full` (Node 24.18.0, pnpm 11.9.0).

| Step | Result | Evidence |
|---|---|---|
| `lint:biome` | PASS | 101 files, 0 errors (pre-existing warnings/infos only) |
| `format:biome:check` | PASS | exit 0 |
| `lint:knip` | PASS | no findings |
| `lint:dup` | PASS | 100 files, 0 clones |
| `lint:depcruise` | PASS | 39 modules, 92 deps, no violations |
| `lint:links` | PASS | 32 references, no dead links |
| `scan:deps` | **EXCEPTION** | 20 vulnerabilities (0 critical / 9 high / 11 medium); see below |
| `scan:code` | PASS | 91 files, 89 rules, 0 findings |
| `build` | PASS | 3 tsup entries + declarations; assets 7 agents / 19 skills |
| `smoke-install` | PASS | project/global/flags; 19 skill dirs |
| `smoke-pack` | PASS | 206 files; 7 agents / 19 skills; no src/docs/tests/plans |
| `test` | PASS | 40 files, 669 tests |
| `typecheck` | PASS | `tsc --noEmit` exit 0 |
| `audit` | PASS | verdict PASS; 0 failures; 0 high-signature secrets |
| `smoke-load` | PASS | valid `Plugin.define` bundle |
| `smoke-mcp` | PASS | 7 tools, plan round-trip, symlink launch |

## Dependency Scan Exception

`scan:deps` reports 20 known dependency vulnerabilities on this branch
(`zod 4.6.5`, `undici`, `minimatch`, `glob`, `ip-address`). The branch touches
no `package.json` or `pnpm-lock.yaml`; the same scan on `develop` reports 28
vulnerabilities, so this work does not introduce or worsen them. Remediation
is dependency-upgrade work outside this plan's scope.

The user accepted this documented exception on 2026-11-07. The gate was not
weakened, skipped, or re-pointed; the failure is recorded here and in the
plan review.

## Grep Gates

| Gate | Result |
|---|---|
| Stale 17-skill claims on the active surface | PASS — zero |
| No fourth plan status (`Paused`) | PASS — `PHASE_STATUSES` is exactly 3 values |
| Secret scan on new artifacts | PASS — only generic redaction prose; 0 high-signature hits |
| Pause/resume references resolve | PASS — AGENTS, README, skills index, execute-plan/task |
| `dist` inventory | PASS — 19 skill dirs, 7 agents, no docs/plans |

## Generated Artifacts

- `reports/audit.json` and `reports/audit.md` were regenerated with the
  19-skill inventory and committed in `0000726`.
- `dist/` is gitignored and was rebuilt for the gate.
- `/tmp/pause-resume-qa.log` and the grep logs remain local evidence.

## Verdict

**PASS with a documented, pre-existing dependency-scan exception.** All other
release-gate steps and all contract/inventory grep gates are green.
