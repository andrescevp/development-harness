# Release Decision — plugin-tools-to-mcp

**Date:** 2026-10-19 · **Branch:** `feature/plugin-tools-to-mcp` (HEAD `577a5b8`)

## Release Gate Evidence

| Gate | Result |
|---|---|
| `pnpm qa:check:full` | **PASS** — exit 0, 15 s wall (biome 41 files/5 pre-existing warnings · knip clean · jscpd 0 clones · depcruise 0 violations, 14 modules/15 deps · links 26 refs OK · OSV 616 packages no issues · semgrep 89 rules/39 files, 0 findings · build `plugin.js` 203.50 KB + `stdio.js` 224.55 KB, assets 7 agents/17 skills · typecheck clean · audit PASS · tests 18 files/181 tests · smoke-load OK · smoke-mcp all checks 255 ms) |
| `node scripts/audit.mjs` | **PASS** — failFindings 0 (one warn-only dimension: cross-references) |
| Live end-to-end | **PASS** — real agent session called `tools.dh.plan_create`; payload `{ ok: true, path: …/demo-project/docs/plans/verification-scratch/plan.md }` (evidence: `tasks/verification.md`) |
| Stale references (AC6) | **PASS** — 0 matches outside `docs/plans/**` + `docs/evolve/**` |
| Snippet identity | **PASS** — 4 canonical npx copies match (`type` / `command` / `protocol` / `timeout.startup`); demo copy is the documented local fallback |

## Version Decision

# Version Decision

**Current:** v0.4.0 (tag: `v0.4.0` — reachable from this branch; highest released tag)
**Bump:** **MINOR → v0.5.0**
**Reason:** 1 breaking change, 8 features, 0 fixes, 6 maintenance commits (16 commits since `v0.4.0`, incl. the v0.4.0 merge-back).

**Mapping note (explicit):** the breaking commit carries `!` (`feat(plugin)!:`), which the skill's literal table
maps to MAJOR. The project is pre-1.0 (0.x line, latest `v0.4.0`); per Semantic Versioning's
major-version-zero rule, breaking changes bump **MINOR** while the MAJOR line is reserved for 1.0.0.
The plan expected this (`0.5.0`); the decision is recorded rather than silently applied.

# Changelog v0.5.0

## Breaking Changes

- **Plugin tool registration removed** — the harness tools are served exclusively by the
  project-scope `dh` MCP server; `dh.plan_read`-style plugin tools no longer exist and
  references use `dh_<tool>` / `tools.dh.<tool>` (`2356951`)

## Features

- MCP server factory exposing all 7 harness tools with parity payloads (`caba043`)
- Workspace root resolver ACL — `DH_WORKSPACE_ROOT` override, cwd fallback, descriptive rejection (`9b970e2`)
- Plan-lifecycle adapter parity + path ACL consolidation (`plan-paths.ts`, `isError` mapping) (`cb2cc47`)
- Sheet + `logged_command` adapters with async guards; sheets keep legacy `ok:false` payload semantics (`89378ac`)
- Atomic plan-file writes + plan I/O extraction (`atomic-write.ts`, `plan-io.ts`, `O_NOFOLLOW` reads) (`7d826a4`)
- stdio entry: `serveStdio` factory, server instructions, symlink-safe main guard, stderr-only logging (`ebf5105`)
- npx-ready packaging: dual tsup entries, `dev-harness-mcp` bin, prepare with build sentinel, `build:runtime` (`d48b1f4`)
- `smoke-mcp` shipped-binary gate wired into `qa:check:full` (`cdb8e79`)

## Fixes

- None separately classified (hardening changes landed under their feature commits).

## Chores & Maintenance

- Tool-reference naming flip across skills + agents (`dh_<tool>` canonical) (`83d4957`)
- Repository docs updated for MCP wiring (README, AGENTS.md, LOADING, example config) (`29c4d55`)
- `dh-setup` consent-based project wiring step (prewarm + verify) (`1be59d0`)
- Demo project wired to the local MCP build; 5-step `demo.sh validate` gate (`069eba8`)
- End-to-end verification evidence (`577a5b8`)
- Plan set for this work (`1971097`)

## Tag

**Pre-tag step — bump the shipped version.** On the release branch, before tagging,
set `package.json` `"version"` to `0.5.0` (`npm version 0.5.0 --no-git-tag-version`,
or edit the file) and commit it. The MCP `serverInfo.version` is read from
`package.json` at runtime, so the newly tagged commit must not report `0.4.0`.

**Deferred acceptance:** plan 5.2 acceptance “tag created locally” was intentionally
deferred per Git Flow; the tag is created on `main` at release time. The feature branch
must be merged (`feature/* → develop → release/* → main`) first.

When cutting the release on `main`:

```sh
git tag -a v0.5.0 -m "Release v0.5.0"
# push only after user confirmation
```

No tag was created on the feature branch (policy: tags on `main` only).

**Post-merge AC5 re-run:** once the branch is on the remote default branch, run the
verbatim `npx -y --package=github:andrescevp/development-harness dev-harness-mcp`
command once and record the result (the machinery was already proven with a cold
`git+file` run: 24.2 s, exit 0).

## Release Checklist

- [ ] `package.json` version bumped to `0.5.0` (the new tag must not report `0.4.0` via `serverInfo.version`)
- [ ] `pnpm qa:check:full` green on the release commit (regenerates `reports/`)
- [ ] commit the regenerated `reports/audit.{md,json}` as the release-report commit (repo convention, cf. v0.4.0)
- [ ] Git Flow merge path executed; `v0.5.0` tagged on `main`
- [ ] post-merge AC5 re-run recorded

## Notes / Follow-ups

- The `github:andrescevp/development-harness` npx spec becomes exercisable after this branch is
  merged/released (it resolves the remote default branch); the local folder-spec proxy measured
  the install/launch mechanics (752 ms cold / 1046 ms warm), and a cold `git+file` install +
  handshake measured 24.2 s (fresh cache) — hence the canonical snippet now ships
  `"timeout": { "startup": 300000 }` **active**.
- Distribution/merge/push are user decisions (Git Flow): merge feature → `develop`, cut
  `release/v0.5.0`, merge to `main`, tag there, back-merge `main` → `develop`.
