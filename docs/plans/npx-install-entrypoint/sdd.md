---
title: npx Install Entrypoint
slug: npx-install-entrypoint
description: Add an npx-runnable installer CLI that installs the dev-harness plugin into global or project OpenCode scope and wires the dh MCP server with idempotent install, status, and uninstall commands
tags: [sdd, design, installer, cli, packaging]
project: dev-harness-skills
stack: TypeScript / Node >=20.11 / tsup / vitest / opencode V2 / jsonc-parser
created: 2026-10-21
updated: 2026-10-21
status: proposed
---

# Software Design Document: npx Install Entrypoint

## Problem Statement

Installing `dev-harness-skills` currently requires a manual sequence: clone the
repository into `~/.config/opencode/plugins/` (or a project's
`.opencode/plugins/`), run `pnpm install`, restart OpenCode, and then hand-edit
the project `opencode.jsonc` to add the `dh` MCP server. There is no
single-command install path, no scope selection, no idempotent upgrade, and no
safe uninstall. The package is not published on npm, but it is already consumed
through `npx` for the MCP server (`npx -y --package=github:... dev-harness-mcp`),
so the same distribution channel can carry an installer entrypoint. The package
must additionally become a proper npm package that OpenCode itself can install
with `opencode plugin add` from either an npm registry spec or the Git repo.

The user intent is explicit: running an `npx` install command must execute an
entrypoint script that installs the plugin in the **proper scope** — global
(all projects) or project-local — without manual cloning or config editing.

## Goals / Non-Goals

- **Goals:**
  - One npx command installs the plugin into a chosen scope.
  - Install materializes a self-contained plugin directory that OpenCode
    discovers without `pnpm install` in the target.
  - Install wires the `dh` MCP server into the matching OpenCode config by
    default, preserving JSONC comments and formatting.
  - Re-running install is idempotent and supports upgrades.
  - `status` reports installed version, paths, and config wiring.
  - `uninstall` removes only installer-managed artifacts.
  - Safe by default: no network, atomic writes, no clobbering unmanaged
    directories or user-customized config entries.
  - Reproducible Docker-based test environment that isolates HOME/config while
    mounting host Git credentials read-only to reach the private GitHub repo.
  - The same package is installable from the npm registry and through
    `opencode plugin add` (npm package spec and Git spec), not only through the
    installer.
  - Users who install via `opencode plugin add` can wire only the `dh` MCP
    entry without a second plugin copy.
- **Non-Goals:**
  - Automated CI release/publish workflows beyond a documented manual publish
    runbook (the package must still be publishable and verified with
    `npm publish --dry-run`).
  - Migrating existing manual/clone installs into managed installs.
  - Windows CI parity (best-effort path handling only).
  - A GUI/TUI beyond a simple interactive scope prompt.
  - Changing the plugin's agents/skills/tools behavior or the MCP protocol.

## Requirements

- **R1:** The package must expose an npx-runnable CLI entrypoint with an
  `install` subcommand. It must be selectable by `npx` both from the package
  name (`dev-harness-skills`) and through an explicit package/bin form.
- **R2:** `install` must support explicit global and project scopes. Global
  installs target the OpenCode config-wide plugins directory; project installs
  target `<project>/.opencode/plugins/`. A project path must be selectable and
  defaults to the current working directory.
- **R3:** Global scope resolution must honor `OPENCODE_CONFIG_DIR`, then
  `XDG_CONFIG_HOME`, then the platform home default. The installer must never
  write outside the resolved plugin directory and the resolved OpenCode config
  file for the chosen scope.
- **R4:** The installed plugin must be self-contained: OpenCode discovers and
  loads it without a package-manager install in the target directory. The
  installed layout must carry the built plugin bundle and its assets, plus
  discovery metadata.
- **R5:** The installer must own its artifacts through a manifest that records
  package version, scope, source spec, install time, target path, managed
  config path/key, and managed files.
- **R6:** Install must be idempotent: an identical re-run makes no changes; a
  version change upgrades managed files. An existing unmanaged directory at
  the target must be refused unless the user explicitly forces it.
- **R7:** By default install must add `mcp.servers.dh` to the OpenCode config
  for the chosen scope. The config write must preserve comments, formatting,
  trailing commas, and unrelated keys. `--no-mcp` must skip config changes.
- **R8:** If `dh` already exists, install must treat an identical entry as a
  no-op and a differing entry as a conflict: warn and leave it untouched
  unless `--force` is supplied.
- **R9:** `status` must report whether the managed plugin is installed, its
  version, its target, and whether the `dh` config entry is present, matching,
  missing, or different. It must support machine-readable JSON output.
- **R10:** `uninstall` must remove the managed plugin directory and the `dh`
  entry only when both are attributable to the installer (manifest and exact
  command match), pruning empty `mcp.servers` / `mcp` containers without
  touching other entries. It must support `--dry-run`.
- **R11:** The CLI must provide `--help`, `--version`, `--dry-run`, `--force`,
  `--yes`, `--no-mcp`, and `--json`, with stable exit codes: `0` success,
  `1` operational failure, `2` usage error. Non-interactive runs without an
  explicit scope must fail with guidance; `--yes` must never guess a scope.
- **R12:** All filesystem mutations must be atomic (temporary sibling +
  rename), symlink-aware, and permission-preserving for existing configs.
  Config edits must create a backup before changing an existing file.
- **R13:** The installer must perform no network access and must not read or
  log secrets. Diagnostics must never print config contents or environment
  dumps.
- **R14:** TDD coverage must include unit tests for arguments, scope
  resolution, JSONC editing, manifest handling, install/upgrade/force/dry-run,
  status, and uninstall ownership, plus an isolated integration test and a
  built-artifact smoke test.
- **R15:** Build/packaging must add the CLI artifact to the tsup bundle and to
  the `prepare` completeness check, keep source-mode clone loading working,
  and verify the GitHub-npx channel's required artifacts. npm registry
  publishing remains out of scope but must not regress the npx channel.
- **R16:** Documentation must make the npx installer the primary installation
  path, retain clone/managed-plugin alternatives, and document scope,
  idempotency, config merging, status, uninstall, upgrades, and exit codes.
- **R17:** The full repository QA gate must stay green and the change must not
  alter agent/skill/MCP tool behavior.
- **R18:** The project must provide a reproducible Docker test environment
  derived from the official `ghcr.io/anomalyco/opencode` image (pinned
  tag/digest) that runs the installer and tests in disposable, non-root
  containers with isolated HOME/XDG/OpenCode config paths, a persistent
  npm/npx cache volume, and no writes to the host.
- **R19:** The Docker test environment must mount host Git credentials
  read-only (at minimum `~/.gitconfig`, and whichever of `~/.ssh`,
  `~/.git-credentials`, or `~/.config/gh` exist) so `npx` can clone the private
  GitHub repo. Credentials must never be baked into the image, copied into the
  build context, printed, or written back to the host.
- **R20:** The Docker runner must support both a remote-channel test
  (`npx -y github:andrescevp/development-harness#<ref>`) and a local-artifact
  test (pack the working tree, install the tarball in the container), with
  deterministic assertions for install, status, plugin import, and uninstall.
- **R21:** The official `ghcr.io/anomalyco/opencode` image lacks Node, npm,
  git, and ssh (Alpine + standalone `opencode` binary), so the test image must
  extend it with those packages while preserving the official `opencode`
  binary for host-level plugin verification. The derived image must be pinned
  and documented; the unmodified image must not be presented as sufficient for
  `npx`.
- **R22:** The package must be publishable to the npm registry under its
  package name and installable from a registry tarball: `npm pack` must contain
  the plugin bundle, assets, MCP bin, installer CLI, declarations, and
  `README`; `main`/`exports`/`types` must resolve inside the published tarball.
- **R23:** `opencode plugin add dev-harness-skills` (npm registry spec) and
  `opencode plugin add github:andrescevp/development-harness` (Git spec) must
  both install the plugin into OpenCode's global configuration and load the 7
  agents + 17 skills. The package must not require a post-install build from
  the registry tarball.
- **R24:** Source-mode clone loading (`index.ts` + repo `agents/`/`skills/`)
  and the managed-copy installer must keep working after the npm packaging
  changes; changing `main`/`exports` to `dist` must not break directory
  discovery or local development.
- **R25:** Users who install the plugin through `opencode plugin add` must be
  able to wire the `dh` MCP server without reinstalling the plugin
  (`install --mcp-only`, and the matching `uninstall --mcp-only`). The MCP
  command source must be selectable (npm package spec or GitHub spec) so the
  config matches the chosen distribution channel.
- **R26:** The installer must detect an existing `opencode plugin add` config
  entry and warn about duplicate loading if a managed copy is also installed;
  it must not silently create two registrations.
- **R27:** Release verification must include `npm publish --dry-run`, package
  name availability/ownership preflight, version consistency, and a documented
  manual publish runbook. Publishing must not expose credentials or include
  test artifacts.

## Scope

- **In scope:** new `src/cli/**` modules and tests; tsup CLI entry; package
  `bin` aliases; `prepare.mjs` artifact list; `jsonc-parser` runtime
  dependency; install/status/uninstall behavior; managed manifest; OpenCode
  JSONC wiring; isolated integration test; `scripts/smoke-install.mjs`; QA
  wiring; npm packaging metadata (`main`/`exports`/`types`/`files`/
  `publishConfig`), npm pack/publish dry-run verification, manual npm publish
  runbook and first publication, `opencode plugin add` compatibility (npm +
  Git specs), `--mcp-only` wiring; Docker test image/runner with read-only
  credential mounts; README, `docs/LOADING.md`, and `AGENTS.md` updates.
- **Out of scope:** automated CI release/publish workflows; registry auth
  management beyond the manual runbook; Windows CI matrix; migration of
  existing manual installs; OpenCode host changes; plugin/MCP protocol changes;
  telemetry; running OpenCode's full interactive UI inside the container.

## Constraints

- Node >= 20.11 (repo `engines`); ESM only; imports use `.js` extensions.
- Repo rules: TDD, files <= 300 lines, Biome formatting, knip/depcruise clean.
- The package is not yet published on npm (registry check returned 404 at
  planning time). The plan assumes the current name `dev-harness-skills` is
  available; publishing is a manual release step with an availability/ownership
  preflight. Both npm and GitHub specs must work.
- `opencode plugin add <package>` installs a plugin into the **global**
  OpenCode configuration and accepts npm-registry or Git package specs. It does
  not wire MCP servers, which is why the `--mcp-only` path is required.
- The plugin bundle (`dist/plugin.js`) bundles `@opencode/plugin` and `yaml`
  and loads assets from `dist/assets`; `duckdb` stays external and lazy for
  the MCP binary only.
- The published tarball must resolve `main`/`exports`/`types` to `dist`; the
  repository keeps `index.ts` + `src/` for source-mode directory discovery and
  local development.
- The canonical MCP entry becomes source-parameterized:
  `["npx","-y","--package=<spec>","dev-harness-mcp"]` with
  `protocol: "2026-07-28"` and `timeout.startup: 300000`, where `<spec>` is
  `dev-harness-skills` for npm installs or
  `github:andrescevp/development-harness` for Git installs. The installer
  exposes a selection flag and defaults to the npm spec after publication.
- `jsonc-parser` is the only planned new runtime dependency (comment- and
  format-preserving edits).
- Docker test environment: derived from the official
  `ghcr.io/anomalyco/opencode` image (verified: Alpine 3.24, standalone
  `opencode` 2.0.18, entrypoint `opencode`, runs as root by default) plus
  `apk add --no-cache nodejs npm git openssh-client gcompat` (observed:
  Node 24.18.1, npm 11.12.1, git 2.54.0, OpenSSH 10.3p1; `gcompat` is
  required for the `duckdb` native binding on musl — without it, requiring
  `duckdb` fails with `ld-linux-x86-64.so.2`). No credentials in the image or
  build context; host credentials are bind-mounted read-only at runtime
  (`~/.gitconfig`, optional `~/.ssh`, `~/.git-credentials`, `~/.config/gh`).
  Containers run as a non-root user matching the host UID/GID where supported.
  GitHub/npm network access is required; all other host access is avoided.

## Risks and Edge Cases

- **Discovery semantics drift:** if OpenCode ignores a managed directory that
  lacks `src/`, the install layout must include the `index.ts` shim and a
  package metadata file pointing at `dist/plugin.js`.
- **Asset resolution:** `dist/plugin.js` resolves `dist/assets` relative to
  itself; a partial copy yields zero registrations. Materialization must copy
  `dist/assets` completely and verify expected counts.
- **JSONC corruption:** regex editing can destroy comments or produce invalid
  JSONC. Use `jsonc-parser` parse/modify/applyEdits and abort on parse errors.
- **User config conflicts:** an existing `dh` entry may be hand-tuned
  (different command, timeout, environment). Default must not overwrite it.
- **Uninstall overreach:** deleting a directory without a manifest, or
  removing a config entry that no longer matches, can destroy user work.
  Ownership must be proven.
- **Atomic swap failures:** a crash mid-install must not leave a half-written
  plugin directory. Use a temp sibling and rename; keep the previous install
  until the new one is complete.
- **npx cwd/package root:** the CLI runs from the npx cache; source artifacts
  must resolve from the module location, never `process.cwd()`.
- **Cross-platform paths:** `OPENCODE_CONFIG_DIR` may be set to the config
  directory itself; Windows fallback uses `APPDATA`. Do not assume POSIX
  separators.
- **Test isolation:** tests must never touch the developer's real home,
  OpenCode config, or plugin directory.
- **Credential leakage:** mounted credentials are the highest-risk part of the
  Docker test path. They must be read-only, absent from the image/build
  context, never echoed (`set +x`), and never copied into test artifacts or
  logs. Prefer `--mount ...,readonly` over compose bind shortcuts that create
  empty host directories when a file is missing.
- **OpenCode image drift:** `ghcr.io/anomalyco/opencode` is Alpine-based with
  no Node/npm/git/ssh and an `opencode` entrypoint; `latest` can change.
  Pin a tag/digest, keep the derived image thin, and assert the expected
  binaries (`opencode`, `node`, `npm`, `git`, `ssh`) in the runner before
  testing. Do not assume the raw image can run `npx`.
- **Entrypoint override:** the official image's entrypoint is `opencode`;
  test commands must use `--entrypoint sh` (or the derived image's test
  entrypoint) or they will be interpreted as OpenCode arguments.
- **musl/duckdb compatibility:** the official image is Alpine (musl) and the
  `duckdb` npm binding is glibc-linked. Add `gcompat`; without it, sheet tools
  fail to load the native module. Plan tools and the installer itself do not
  require duckdb at load time, but the MCP server's sheet tools do.
- **Credential mode mismatch:** `github:` npx specs may resolve over SSH while
  the host is configured for HTTPS (or vice versa). The runner must detect and
  mount the available credential set, support an explicit
  `DH_GIT_SSH_COMMAND`/`GIT_CONFIG_GLOBAL` override, and fail early with a
  clear diagnostic instead of hanging on a prompt.
- **UID/GID ownership:** bind mounts and the npm cache volume must be writable
  by the container user without making host files world-writable; use a
  matching UID/GID (or a named cache volume).
- **Network expectation:** the Docker test requires GitHub and npm registry
  access; it must not be part of the offline `qa:check:full` gate unless a
  network+credentials profile is explicitly enabled.
- **Packaging divergence:** `main`/`exports` currently point at `index.ts`
  while `files` publishes only `dist`. The npm release must move runtime
  entrypoints to `dist` and include declarations/README in the tarball while
  keeping repository source-mode discovery on `index.ts`; verify both paths.
- **Npm name/ownership:** `dev-harness-skills` is not published (404) but
  availability is not guaranteed. Preflight with `npm view` and `npm whoami`;
  if the name is unavailable or owned by another account, stop and escalate —
  do not silently rename the package or change all commands.
- **Tarball incompleteness:** `files: ["dist"]` omits `index.ts`/`src`/
  `README`; a registry consumer may get an unimportable package or missing
  assets. Verify the packed tarball by installing it into a temp prefix and
  importing the plugin, not just by checking `dist` exists.
- **`opencode plugin add` duplication:** `opencode plugin add` writes a global
  config entry, while the managed-copy installer writes a plugins-directory
  directory. Using both loads the plugin twice. Detect the config entry and
  warn; document "choose one channel".
- **Git-spec install without a build:** `opencode plugin add github:...` may
  use a package manager that does not run `prepare` with dev dependencies,
  leaving `dist` missing. Test this explicitly; if it fails, make the npm
  registry package the supported `plugin add` channel and document the Git
  limitation (or ship a prebuilt branch/tarball).
- **MCP source mismatch:** a plugin installed from npm but an MCP command
  pinned to GitHub (or vice versa) can serve different versions or fail in
  environments without Git credentials. Tie the MCP spec to the chosen channel
  and expose an override.
- **Publish leakage:** `npm pack` can include local artifacts (`.env`, logs,
  test output) if `files` is wrong. Review `npm pack --dry-run --json` and
  never publish from a dirty tree with credentials present.

## Acceptance Criteria

- **AC1:** `npx -y github:andrescevp/development-harness install --global
  --yes --dry-run` exits 0 and reports the resolved plugin path and config
  path without creating or modifying anything.
- **AC2:** A global install creates `<config>/plugins/dev-harness-skills/`
  with `index.ts`, package metadata, `dist/plugin.js`, `dist/assets`, and a
  valid manifest; the installed `dist/plugin.js` imports successfully and
  exposes the plugin `id`/`setup`.
- **AC3:** A project install (`--project`, default cwd, optional `--path`)
  creates `<project>/.opencode/plugins/dev-harness-skills/` and writes the
  `dh` entry to the project's `opencode.jsonc` (or existing `opencode.json`).
- **AC4:** Re-running the same install makes no further changes; installing a
  newer version updates managed files; an unmanaged target directory is
  refused unless `--force`.
- **AC5:** JSONC config edits preserve comments, formatting, trailing commas,
  and unrelated keys; an identical `dh` entry is a no-op; a differing entry is
  preserved with a warning unless `--force`; `--no-mcp` performs no config
  write.
- **AC6:** `status --json` accurately reports installed version, target,
  config path, and entry state for both scopes.
- **AC7:** `uninstall` removes the managed plugin directory and only the
  installer-owned `dh` entry, prunes empty containers, and leaves other
  servers and keys intact; `--dry-run` reports without deleting.
- **AC8:** Non-TTY invocation without a scope exits with code 2 and actionable
  guidance; `--help` and `--version` exit 0; unknown flags exit 2.
- **AC9:** Unit, integration, and smoke tests pass; `scripts/smoke-install.mjs`
  runs against isolated temp home/project directories and is wired into
  `pnpm qa:check:full`.
- **AC10:** Source-mode clone loading remains documented and functional; the
  tsup build emits `dist/cli.js`; `prepare` treats it as required; `npm pack
  --dry-run` contains the CLI, plugin bundle, MCP binary, and assets.
- **AC11:** `pnpm qa:check:full` exits 0, and the README/LOADING/AGENTS docs
  describe the npx installer as the primary path.
- **AC12:** The Docker runner builds a non-root image derived from a pinned
  `ghcr.io/anomalyco/opencode` base with Node/npm/git/ssh added and no
  credentials, mounts the host's available Git credential files read-only, and
  completes a remote `npx github:... install` inside the container with
  isolated HOME/XDG/OpenCode paths; nothing is written to the host.
- **AC13:** The same Docker runner can test a local artifact (`npm pack` +
  install the tarball) without GitHub, and both modes assert install, status,
  plugin import, idempotent re-run, and uninstall. The official unmodified
  `ghcr.io/anomalyco/opencode` image is separately verified to load the
  installed plugin (`opencode debug agents`) when the plugin/config volumes
  are mounted; the runner documents that the raw image cannot run `npx`.
- **AC14:** Docker tests are documented as an opt-in network/credentials gate
  and are excluded from the default offline `pnpm qa:check:full` gate.
- **AC15:** `npm pack` produces a tarball whose `main`/`exports`/`types` point
  at files inside the tarball; installing it into a clean temp prefix and
  importing `dev-harness-skills` yields the plugin definition (id + setup), and
  the CLI/MCP bins are executable.
- **AC16:** `npm publish --dry-run` succeeds from a clean tree with only the
  intended files; package name/ownership preflight is documented; no
  credentials or test artifacts are included.
- **AC17:** `opencode plugin add github:andrescevp/development-harness` installs
  and loads 7 agents + 17 skills; `opencode plugin add dev-harness-skills`
  works after publication and is verified in a clean temp HOME (npm spec).
- **AC18:** `install --mcp-only` writes only `mcp.servers.dh` without creating a
  plugin directory; `uninstall --mcp-only` removes only that entry; both work
  after an `opencode plugin add` installation, and a duplicate-install warning
  is emitted when a managed copy coexists with a config plugin entry.
- **AC19:** The MCP entry uses the selected source spec (npm or GitHub) and the
  installer documents the default; no mixed-version config is produced by the
  supported flows.

## Open Questions

- If `dev-harness-skills` is unavailable on npm, should the release use a
  scoped name (e.g. `@andrescevp/dev-harness`)? This changes every documented
  command and the MCP spec; escalate before renaming rather than guessing.
- Should `status` also probe `opencode mcp list`? Deferred: the CLI stays
  offline and reports config/files only; live host verification remains a
  documented manual step.
- Should global installs optionally write a `plugins` config entry instead of
  relying on directory discovery? Not needed if discovery works; verify in
  integration and manual smoke, and fall back only if evidence requires it.
- Should a future release automate npm publishing in CI? Out of scope here;
  the manual runbook must be stable first.
