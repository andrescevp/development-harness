---
title: Releasing dev-harness-skills
slug: releasing
description: Manual npm publish runbook and post-publish verification for the dev-harness-skills package
tags: [release, npm, opencode]
project: dev-harness-skills
created: 2026-10-22
updated: 2026-10-22
status: active
---

# Releasing dev-harness-skills

The package has two distribution channels: the npm registry and the Git
repository. The npx installer supports both; OpenCode's `opencode plugin add`
supports an npm spec and a Git spec.

## Preflight

Run from a clean `main`/`release/*` tree after the release branch is merged (or
from the release branch before tagging):

```sh
git status --short                 # must be empty
npm whoami                         # publishing account
npm view dev-harness-skills        # 404 = name likely available; otherwise stop
pnpm qa:check:full                 # offline gate + smokes (Docker runner is opt-in)
node scripts/smoke-install.mjs
node scripts/smoke-pack.mjs
npm pack --dry-run --json          # inspect the exact file list
npm publish --dry-run --json       # auth/name/tarball check; no upload
```

Stop if the name is owned by another account. A scoped-name fallback requires
an explicit decision because it changes every command and the MCP spec.

## Publish

`npm publish` is manual and requires interactive authentication. Never store an
npm token in the repository or shell history.

```sh
npm publish --access public
```

`prepack` runs `npm run build` (bundle + declarations + assets) and `prepare`
then detects `dist/.build-ok` and skips, so a pack performs one build.

## Post-publish verification

```sh
npx -y dev-harness-skills --version
npx -y dev-harness-skills install --global --dry-run
opencode plugin add dev-harness-skills
opencode plugin add github:andrescevp/development-harness
```

Then wire MCP only (do not add a second managed copy):

```sh
npx -y dev-harness-skills install --global --mcp-only
npx -y dev-harness-skills status --global --json
```

Record the published version, `npm view dev-harness-skills version`, the
`opencode plugin list` output, and a fresh-session agent/skill check in the
plan's `tasks/verification.md`.

## Known limitation: Git `opencode plugin add`

On OpenCode 2.0.18, `opencode plugin add github:...` may fail with
`git dep preparation failed` while a direct `npm install git+file://...`
succeeds. The npm registry spec (`opencode plugin add dev-harness-skills`) is
the supported plugin-add channel; the Git channel remains available through the
npx installer (`npx -y github:andrescevp/development-harness install ...`).
Investigate the bundled npm's git-dependency preparation before claiming the
Git plugin-add path.

## Rollback / deprecation

- Within npm's unpublish window: `npm unpublish dev-harness-skills@<version>`.
- Outside the window: `npm deprecate dev-harness-skills@<version> "reason"` and
  publish a fixed version.
- Move the Git tag only by deleting/recreating it deliberately; never rewrite a
  published tag silently.
- If a bad version ships, publish the next patch and update the release notes;
  do not reuse a version number.
