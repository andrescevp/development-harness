---
title: npx Install Entrypoint
slug: npx-install-entrypoint
description: Add an npx-runnable installer CLI (dev-harness install/status/uninstall) that materializes the plugin into global or project OpenCode scope and wires mcp.servers.dh with JSONC-preserving, idempotent, ownership-safe operations
created: 2026-10-21
updated: 2026-10-21
status: Pending
active: true
tags: [plan, installer, cli, packaging]
project: dev-harness-skills
---

# Plan: npx Install Entrypoint

## Objective

Add a first-class `dev-harness` CLI so a single npx command installs the plugin
in the proper scope:

```sh
# from npm (after publication)
npx -y dev-harness-skills install --global
npx -y dev-harness-skills install --project

# from the Git repo (pre-publication / private use)
npx -y github:andrescevp/development-harness install --global
```

The same package must also be installable through OpenCode itself:

```sh
opencode plugin add dev-harness-skills
opencode plugin add github:andrescevp/development-harness
```

The installer materializes a self-contained plugin directory into OpenCode's
global or project plugins folder, writes a managed manifest, and merges the
canonical `mcp.servers.dh` entry into the matching `opencode.jsonc` while
preserving comments and formatting. Re-runs are idempotent, `status` reports
drift, and `uninstall` removes only installer-owned artifacts. Users who
install through `opencode plugin add` use `install --mcp-only` to wire the MCP
entry.

Deliverable: one phased plan executed by the harness loop; end state verified
by unit/integration tests, `scripts/smoke-install.mjs`, `pnpm qa:check:full`,
an installable npm tarball, `opencode plugin add` (npm + Git specs), and a real
GitHub-npx install smoke run inside a Docker test environment derived from
`ghcr.io/anomalyco/opencode` with read-only host Git credential mounts.

## Requirements Snapshot

From `./docs/plans/npx-install-entrypoint/sdd.md` (source of truth; IDs stable):

- **R1:** npx-runnable CLI entrypoint with an `install` subcommand; selectable
  by package name and explicit package/bin form.
- **R2:** Explicit global and project scopes; project path selectable, default
  cwd.
- **R3:** Global resolution honors `OPENCODE_CONFIG_DIR` → `XDG_CONFIG_HOME` →
  platform home; never write outside resolved plugin dir/config file.
- **R4:** Installed plugin is self-contained (bundle + assets + discovery
  metadata), no package-manager install in the target.
- **R5:** Manifest records version, scope, source, timestamp, target, managed
  config path/key, and managed files.
- **R6:** Idempotent installs/upgrades; refuse unmanaged target unless
  `--force`.
- **R7:** Default `mcp.servers.dh` wiring; JSONC comments/formatting/trailing
  commas preserved; `--no-mcp` skips.
- **R8:** Identical `dh` is a no-op; differing `dh` is preserved with a warning
  unless `--force`.
- **R9:** `status` reports install/version/target/config state, with `--json`.
- **R10:** `uninstall` removes only installer-owned plugin + matching `dh`
  entry; prunes empty containers; supports `--dry-run`.
- **R11:** `--help`, `--version`, `--dry-run`, `--force`, `--yes`, `--no-mcp`,
  `--json`; exit codes 0/1/2; non-TTY without scope fails; `--yes` never
  guesses scope.
- **R12:** Atomic, symlink-aware, permission-preserving writes; backup existing
  config before edits.
- **R13:** No network, no secrets, no config/env dumps in output.
- **R14:** TDD: unit + isolated integration + built-artifact smoke coverage.
- **R15:** tsup CLI entry, `prepare` completeness, source-mode preserved,
  GitHub-npx artifacts verified.
- **R16:** Docs make npx installer primary; alternative install paths retained.
- **R17:** Full QA gate green; no behavior change to agents/skills/MCP tools.
- **R18:** Reproducible Docker test environment derived from a pinned
  `ghcr.io/anomalyco/opencode` image; non-root, isolated HOME/XDG/OpenCode,
  persistent npm cache, no host writes.
- **R19:** Host Git credentials mounted read-only (`~/.gitconfig` plus
  available `~/.ssh`, `~/.git-credentials`, `~/.config/gh`); never baked,
  copied, printed, or written back.
- **R20:** Runner supports remote `npx github:...#<ref>` and local-tarball
  modes with install/status/import/idempotency/uninstall assertions.
- **R21:** The official image lacks Node/npm/git/ssh; extend it with those
  packages, pin the base, and keep the official `opencode` binary for host
  plugin verification.
- **R22:** Publishable npm package: `npm pack` contains plugin bundle, assets,
  MCP bin, installer CLI, declarations, and README; `main`/`exports`/`types`
  resolve inside the tarball.
- **R23:** `opencode plugin add dev-harness-skills` and `opencode plugin add
  github:andrescevp/development-harness` both install and load 7 agents + 17
  skills; no post-install build from the registry tarball.
- **R24:** Source-mode clone loading and the managed-copy installer keep
  working after `main`/`exports` move to `dist`.
- **R25:** `install --mcp-only` / `uninstall --mcp-only` wire the `dh` entry for
  `opencode plugin add` users; MCP spec is selectable (npm vs GitHub).
- **R26:** Detect an existing `opencode plugin add` config entry and warn about
  duplicate loading; never create two silent registrations.
- **R27:** Release verification: `npm publish --dry-run`, name/ownership
  preflight, version consistency, manual publish runbook, no secrets/artifacts.

Acceptance criteria: **AC1** dry-run install works without writes; **AC2**
global install layout + importable plugin; **AC3** project install + project
config; **AC4** idempotent re-run/upgrade/unmanaged refusal; **AC5** JSONC
preservation + conflict/no-mcp behavior; **AC6** status JSON accuracy; **AC7**
ownership-safe uninstall; **AC8** non-TTY/help/version/exit codes; **AC9**
tests + smoke wired into `qa:check:full`; **AC10** build/prepare/npm-pack and
source-mode preservation; **AC11** full QA green + docs; **AC12** Docker remote
npx install with read-only credentials; **AC13** Docker local-artifact mode +
official-image plugin load; **AC14** Docker gate documented as opt-in;
**AC15** tarball install/import + bins; **AC16** publish dry-run/name
preflight; **AC17** `opencode plugin add` npm + Git specs load the harness;
**AC18** mcp-only + duplicate warning; **AC19** source-matched MCP spec.

## Scope

- **In scope:** `src/cli/**` (args, scope, output, manifest, filesystem,
  materializer, config, commands), tests, tsup entry, `bin` aliases,
  `prepare.mjs`, `jsonc-parser` dependency, managed manifest, OpenCode JSONC
  wiring, isolated integration test, `scripts/smoke-install.mjs`, QA wiring,
  npm packaging (`main`/`exports`/`types`/`files`/`publishConfig`), npm pack/
  publish dry-run checks, manual npm publish runbook and first publication,
  `opencode plugin add` compatibility (npm + Git specs), `--mcp-only` wiring,
  Docker test image derived from `ghcr.io/anomalyco/opencode`, credential-mount
  runner, README/`docs/LOADING.md`/`AGENTS.md` updates, final manual
  publish/npx smoke.
- **Out of scope:** automated CI release/publish workflows; registry auth
  management beyond the manual runbook; Windows CI matrix; migrating existing
  manual installs; OpenCode host modifications; plugin/MCP protocol changes;
  telemetry; running OpenCode's interactive UI inside the container.

## Assumptions and Constraints

- Node >= 20.11, ESM, `.js` import extensions, Biome formatting, files <= 300
  lines, TDD.
- Distribution channels: npm registry (`dev-harness-skills`, not yet published;
  404 at planning time) and Git (`github:andrescevp/development-harness`).
  `opencode plugin add <spec>` installs into the **global** config and accepts
  both; it does not wire MCP servers.
- Published tarball entrypoints: `main`/`exports`/`types` must point at
  `dist/plugin.js`/`dist/plugin.d.ts`; repository source mode keeps `index.ts`
  for directory discovery. `files` must include `dist` and `README`.
- The plugin bundle is self-contained (`@opencode/plugin` + `yaml` inlined)
  and resolves `dist/assets` relative to `dist/plugin.js`; `duckdb` is only
  needed by the MCP binary and stays lazy/external.
- OpenCode discovers plugin directories under the config-wide or project
  `.opencode/plugins/` folder; the managed layout includes an `index.ts` shim
  and package metadata pointing at `dist/plugin.js`.
- Canonical MCP entry (source-parameterized):
  ```jsonc
  {
    "mcp": {
      "servers": {
        "dh": {
          "type": "local",
          "command": ["npx", "-y", "--package=<spec>", "dev-harness-mcp"],
          "protocol": "2026-07-28",
          "timeout": { "startup": 300000 }
        }
      }
    }
  }
  ```
  `<spec>` is `dev-harness-skills` for npm installs or
  `github:andrescevp/development-harness` for Git installs; the installer
  defaults to npm after publication and exposes an override.
- `jsonc-parser` is the only new runtime dependency.
- Docker test base (verified on this host): `ghcr.io/anomalyco/opencode`
  (`2.0.18`, digest `sha256:aa0e5ac93543f24c99dfcc72a6ea7df335faec131dafc16f7607a2c7d3173d28`)
  is Alpine 3.24.2 with a standalone `opencode` 2.0.18 binary, entrypoint
  `opencode`, and writes as root. It has **no** `node`, `npm`, `git`, or
  `ssh`; the derived test image adds `nodejs npm git openssh-client gcompat`
  (observed: Node 24.18.1, npm 11.12.1, git 2.54.0, OpenSSH 10.3p1; `gcompat`
  is required for duckdb's glibc binding on musl).
- Docker test commands must override the entrypoint (`--entrypoint sh` or the
  derived image's test entrypoint); `docker run -it --rm
  ghcr.io/anomalyco/opencode` alone opens the TUI and cannot run `npx`.
- `CODE_RULES.md` does not exist yet; `dh-coding` runs `dh-code-ruler` during
  the first implementation sub-task and applies the resulting rules.

## Risks and Areas Requiring Care

- **Discovery mismatch:** a managed dir without `src/` may not be discovered;
  include `index.ts` + package metadata and verify by importing the installed
  bundle in tests.
- **Partial assets:** `dist/assets` must be copied completely; verify 7 agent
  files and 17 skill directories against the source before committing the swap.
- **JSONC corruption:** never regex-edit configs; parse first, abort on errors,
  use `jsonc-parser` modify/applyEdits, write atomically, keep a `.bak`.
- **Overwriting user config:** differing `dh` entries and unmanaged plugin
  dirs are user-owned; require `--force`.
- **Uninstall overreach:** prove ownership via manifest + exact command match
  before deleting anything; `--force` is explicit and never implicit.
- **Crash safety:** materialize into a temp sibling, verify, then rename;
  retain the previous install until the new one is valid.
- **Test safety:** every test/smoke run sets `HOME`, `XDG_CONFIG_HOME`, and
  `OPENCODE_CONFIG_DIR` to temp directories; assert real home is untouched.
- **npx package root:** resolve source files from `import.meta.dirname`
  (dist), never `process.cwd()`.
- **Packaging drift:** `main`/`exports` point at `index.ts` while `files`
  publishes only `dist`; the npm release must move runtime entrypoints to
  `dist` and include declarations/README while keeping source-mode discovery
  on `index.ts`. Verify both paths.
- **Npm name/ownership:** `dev-harness-skills` is unpublished but availability
  is not guaranteed; preflight `npm view`/`npm whoami` and escalate instead of
  silently renaming.
- **Tarball incompleteness:** verify by installing the packed tarball into a
  temp prefix and importing the plugin; `dist` existing is not enough.
- **`opencode plugin add` duplication:** it writes a global config entry while
  the managed copy writes a plugins-directory directory; using both loads the
  plugin twice. Detect and warn; document "choose one channel".
- **Git-spec install without a build:** `opencode plugin add github:...` may
  not run `prepare` with dev dependencies, leaving `dist` missing. Verify in
  7.4; if it fails, make npm the supported `plugin add` channel and document
  the Git limitation.
- **MCP source mismatch:** tie the MCP command spec to the selected channel
  (npm vs GitHub) and expose an override; mixed versions otherwise.
- **Publish leakage:** review `npm pack --dry-run --json` from a clean tree; no
  `.env`, logs, test output, or credentials in the tarball.
- **Docker credential leakage:** credentials are mounted read-only and never
  baked/copied/printed; `set +x`, no `docker inspect` of env, no `cat` of
  credential files. The runner must redact URLs that may embed tokens.
- **Docker image drift:** `ghcr.io/anomalyco/opencode:latest` is Alpine and
  changes over time; pin a tag or digest, assert the required binaries, and
  keep only the minimal `apk add` layer. The raw image cannot run `npx`.
- **Entrypoint/UID traps:** the official entrypoint is `opencode`; override it
  for shell tests. Running as root by default would make bind-mounted files
  root-owned; create a non-root user with host UID/GID (build args) and use a
  named npm cache volume.
- **Credential mode mismatch:** `github:` specs may resolve over SSH while the
  host uses HTTPS credentials. Detect available credentials, support
  `GIT_CONFIG_GLOBAL`/`GIT_SSH_COMMAND` overrides, and fail early instead of
  hanging on a prompt.
- **Network/opt-in gate:** Docker tests need GitHub + npm access and must not
  run in the default offline `qa:check:full`; document them as a separate
  `test:docker` gate.

## Core concepts

**Managed global layout**

```text
${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}/
  plugins/dev-harness-skills/
    index.ts                     # export { default } from './dist/plugin.js'
    package.json                 # name/version/type/main/exports -> dist/plugin.js
    dist/plugin.js               # self-contained plugin bundle
    dist/assets/agents/*.md      # 7 agents
    dist/assets/skills/**        # 17 skills + index.md
    .dev-harness-install.json    # manifest: version, scope, source, config
  opencode.jsonc                 # mcp.servers.dh merged here
```

**Managed project layout**

```text
<project>/.opencode/plugins/dev-harness-skills/   # same layout
<project>/opencode.jsonc                          # mcp.servers.dh merged here
```

**Command forms**

```sh
# npm channel (after publication)
npx -y dev-harness-skills install --global
npx -y dev-harness-skills install --project --path .
npx -y dev-harness-skills status --global --json
npx -y dev-harness-skills uninstall --project --dry-run

# Git channel (pre-publication / private use)
npx -y github:andrescevp/development-harness install --global
npx -y --package=github:andrescevp/development-harness dev-harness install --global

# OpenCode-managed plugin installation
opencode plugin add dev-harness-skills
opencode plugin add github:andrescevp/development-harness

# MCP-only wiring after opencode plugin add
npx -y dev-harness-skills install --global --mcp-only
npx -y dev-harness-skills uninstall --global --mcp-only
```

**Distribution matrix**

| Channel | Plugin install | MCP wiring | Notes |
|---|---|---|---|
| installer (npm) | managed copy | `install` default | `--global` / `--project` |
| installer (Git) | managed copy | `install --mcp-package=github:...` | pre-publication |
| `opencode plugin add` (npm) | global config entry | `install --mcp-only` | after npm publish |
| `opencode plugin add` (Git) | global config entry | `install --mcp-only --mcp-package=github:...` | works today |
| clone/source | `plugins/` dir | manual or `install --mcp-only` | development |

**Config edit rule:** parse JSONC → compare `mcp.servers.dh` → if identical,
no write; if absent, insert; if different, warn/skip unless `--force`. Removal
only occurs when the current entry deep-equals the managed entry recorded in
the manifest. If `opencode plugin add` already registered the plugin in the
config and a managed copy exists, emit a duplicate-load warning.

**Docker test topology**

```text
ghcr.io/anomalyco/opencode:<pinned>      # official Alpine image, opencode binary
  └─ derived test image (Dockerfile.test)
       apk add nodejs npm git openssh-client gcompat
       non-root tester user (UID/GID build args)

container
  /home/tester/.gitconfig        <- host ~/.gitconfig (ro, conditional)
  /home/tester/.ssh              <- host ~/.ssh (ro, conditional)
  /home/tester/.git-credentials  <- host ~/.git-credentials (ro, conditional)
  /home/tester/.config/gh        <- host ~/.config/gh (ro, conditional)
  /home/tester/.npm              <- named volume (npx cache)
  /work/project                  <- temp project (container-only)
  /work/home                     <- isolated HOME/XDG/OPENCODE_CONFIG_DIR
```

```sh
# install the derived image once (pins the official base)
docker build -f docker/test/Dockerfile -t dev-harness-test:local \
  --build-arg UID="$(id -u)" --build-arg GID="$(id -g)" .

# remote channel (uses mounted credentials)
docker run -it --rm --entrypoint sh \
  -v "$HOME/.gitconfig:/home/tester/.gitconfig:ro" \
  -v "$HOME/.ssh:/home/tester/.ssh:ro" \
  -v dev-harness-npm-cache:/home/tester/.npm \
  dev-harness-test:local -lc \
  'npx -y github:andrescevp/development-harness#<ref> install --project --path /work/project --yes'

# official image plugin-load verification (no npx; plugin/config mounted)
docker run -it --rm -v "$TMP/opencode:/home/tester/.config/opencode" \
  ghcr.io/anomalyco/opencode debug agents
```

The runner script (`scripts/docker-test.sh`) owns conditional mounts, temp
directories, assertions, and cleanup; the raw `docker run -it --rm
ghcr.io/anomalyco/opencode` command alone opens the TUI and is not a test.

## Phases

### Phase 1: CLI Contract and Scope Foundation

- **Status:** Completed

#### Sub-Task 1.1: Define the CLI argument model and command routing

- **Status:** Completed
- **Objective:** Establish the CLI surface, parsing rules, help/version output,
  and stable exit codes before any filesystem logic.
- **Related Requirements:** R1, R11, R17
- **Dependencies and Preconditions:** `CODE_RULES.md` generated by
  `dh-code-ruler` if absent.
- **In Scope for This Sub-Task:** `src/cli/args.ts`, `src/cli/main.ts` skeleton,
  `--help`/`--version`, subcommand routing (`install`, `status`, `uninstall`),
  flag validation, usage error handling.
- **Out of Scope for This Sub-Task:** filesystem writes, scope resolution,
  config editing, command implementations.
- **Instructions:** Model argv as a parsed command + options object; reject
  unknown flags/subcommands with exit 2; mutually exclusive `--global` /
  `--project`; `--path` only valid with `--project`; `--json`/`--dry-run`
  accepted only where meaningful; print concise help with examples; read the
  version from `package.json` relative to `import.meta.url`.
- **Acceptance Criteria:** parser unit tests cover every command, aliases,
  invalid combinations, help/version, and exit codes; no side effects.
- **Cautionary Points (Risks & Edge Cases):** `npx` passes arguments through
  unchanged; do not treat a leading `--` as a subcommand; keep `--yes`
  independent from scope selection.
- **Implementation Suggestions:** small pure functions; return a result object
  instead of calling `process.exit` deep in the parser; the entry maps results
  to exit codes.
- **Testing Suggestions:** table-driven vitest cases for valid/invalid argv.
- **Done When:** `node dist/cli.js --help` and `--version` exit 0; invalid
  usage exits 2; parser tests pass.

#### Sub-Task 1.2: Implement scope resolution and path confinement

- **Status:** Completed
- **Objective:** Resolve global/project targets deterministically and confine
  every write to those paths.
- **Related Requirements:** R2, R3, R13
- **Dependencies and Preconditions:** 1.1.
- **In Scope for This Sub-Task:** `src/cli/scope.ts`, environment precedence
  (`OPENCODE_CONFIG_DIR` → `XDG_CONFIG_HOME`/`APPDATA` → home), global config
  dir, global plugin dir, project root resolution from `--path`/cwd, project
  plugin/config paths, path normalization and safety checks.
- **Out of Scope for This Sub-Task:** creating directories, writing files,
  prompt UX.
- **Instructions:** Treat `OPENCODE_CONFIG_DIR` as the OpenCode config
  directory itself (matching `scripts/link-dh-global.sh`); resolve `--path`
  to an absolute existing directory; reject a project path that is not a
  directory; expose a single `InstallScope` object with `targetDir`,
  `configPath`, `configKey`, `scope`, `projectRoot`.
- **Acceptance Criteria:** unit tests cover precedence, relative/absolute
  `--path`, missing/invalid project dirs, POSIX and Windows-style config
  fallbacks (mocked), and path equality checks.
- **Cautionary Points (Risks & Edge Cases):** `~` expansion is the shell's job;
  do not invent it. Do not resolve symlinks away silently — record both real
  and lexical paths for ownership checks.
- **Implementation Suggestions:** use `node:path.resolve` and `node:os.homedir`;
  inject `env`/`platform` for tests.
- **Testing Suggestions:** pure resolver with an injected environment map.
- **Done When:** scope resolver tests pass and every returned path is absolute
  and confined.

#### Sub-Task 1.3: Add interactive scope prompt and output conventions

- **Status:** Completed
- **Objective:** Let a TTY user choose global/project/cancel, while keeping
  non-interactive behavior explicit and deterministic.
- **Related Requirements:** R2, R11, R13
- **Dependencies and Preconditions:** 1.1, 1.2.
- **In Scope for This Sub-Task:** `src/cli/prompt.ts`, `src/cli/output.ts`
  (human lines + `--json` envelopes), TTY detection, non-TTY error guidance.
- **Out of Scope for This Sub-Task:** command orchestration and actual writes.
- **Instructions:** Prompt only when stdin/stdout are TTY and no scope flag was
  provided; options [Global, Project, Cancel] with Project default; cancel
  exits 1; non-TTY without a scope exits 2 with copy-paste examples; keep
  output ASCII and prefix messages by command; JSON output is a single
  machine-readable object on stdout, diagnostics on stderr.
- **Acceptance Criteria:** tests simulate TTY/non-TTY and verify prompt
  selection, cancel, and exit codes; JSON output parses cleanly.
- **Cautionary Points (Risks & Edge Cases):** never prompt in CI; never mix
  human logs into `--json` stdout; do not print environment/config bodies.
- **Implementation Suggestions:** inject streams for tests; keep readline
  imports lazy so non-interactive runs never touch the terminal.
- **Testing Suggestions:** unit tests with fake streams; integration test for
  non-TTY exit 2.
- **Done When:** interactive and non-interactive paths are covered by tests.

### Phase 2: Managed Plugin Materialization

- **Status:** Completed

#### Sub-Task 2.1: Define the install manifest schema and I/O

- **Status:** Completed
- **Objective:** Make installer-owned state explicit and verifiable.
- **Related Requirements:** R5, R6, R10
- **Dependencies and Preconditions:** 1.2.
- **In Scope for This Sub-Task:** `src/cli/manifest.ts` with
  `.dev-harness-install.json` schema version 1: package name, version, source
  spec, scope, installedAt, target path, config path/key, managed file list,
  and a config-entry fingerprint (deep-equal JSON of the `dh` entry).
- **Out of Scope for This Sub-Task:** writing the plugin files or editing
  config.
- **Instructions:** Validate on read; treat missing/invalid manifests as
  unmanaged; write atomically; keep the schema forward-compatible; never store
  secrets or full config contents.
- **Acceptance Criteria:** round-trip tests, invalid/missing manifest handling,
  unknown schema version rejection with a clear error.
- **Cautionary Points (Risks & Edge Cases):** a corrupt manifest must not be
  silently overwritten on install without `--force`; paths in the manifest are
  absolute and must match the resolved target.
- **Implementation Suggestions:** zod is already a dependency, but a small
  hand-written validator keeps the CLI lean; either way, no `any`.
- **Testing Suggestions:** fixture manifests for valid, missing, corrupt, and
  future-schema cases.
- **Done When:** manifest module is fully tested and used by later phases.

#### Sub-Task 2.2: Build safe filesystem primitives

- **Status:** Completed
- **Objective:** Provide atomic, symlink-aware copy/swap/remove helpers used by
  all commands.
- **Related Requirements:** R3, R12, R13
- **Dependencies and Preconditions:** 1.2.
- **In Scope for This Sub-Task:** `src/cli/fs-utils.ts`: recursive copy,
  temp-sibling staging, atomic rename swap, lstat-based symlink detection,
  confined path assertions, permission preservation, best-effort cleanup.
- **Out of Scope for This Sub-Task:** plugin-specific layout decisions and
  config edits.
- **Instructions:** Stage at `<target>.tmp-<pid>-<random>` on the same
  filesystem; verify contents before swapping; if the target exists, rename it
  to a backup sibling, rename staging into place, then remove the backup;
  restore the backup if the swap fails; never follow a symlink when deleting.
- **Acceptance Criteria:** unit tests cover fresh install, replace, swap
  failure rollback, symlink target refusal, and path-confinement rejection.
- **Cautionary Points (Risks & Edge Cases):** cross-device rename is not
  atomic — keep staging next to the target; cleanup must never delete outside
  the resolved scope; handle `EEXIST`/`ENOTEMPTY` deterministically.
- **Implementation Suggestions:** use `fs.cp` with `recursive: true`,
  `fs.rename`, `fs.lstat`, `fs.rm`; inject a filesystem adapter only if tests
  need fault injection.
- **Testing Suggestions:** temp-dir unit tests plus a fault-injected swap test.
- **Done When:** primitives are tested and no operation can escape its root.

#### Sub-Task 2.3: Implement plugin materialization and integrity checks

- **Status:** Completed
- **Objective:** Produce the exact self-contained plugin layout OpenCode needs.
- **Related Requirements:** R3, R4, R5, R12, R15
- **Dependencies and Preconditions:** 2.1, 2.2.
- **In Scope for This Sub-Task:** `src/cli/plugin-artifact.ts`: locate the
  running package root (`import.meta.dirname` → `..`), copy
  `dist/plugin.js` + `dist/assets`, generate `index.ts` and `package.json`
  shims, write the manifest, verify asset counts (7 agents / 17 skills) and
  that `dist/plugin.js` has no bare runtime imports beyond node builtins.
- **Out of Scope for This Sub-Task:** config merging, uninstall, interactive
  UX.
- **Instructions:** Read version from the package's `package.json`; fail
  clearly if the CLI is running from a source checkout without `dist`; copy
  only what the plugin needs; write the shim as
  `export { default } from './dist/plugin.js'`; package metadata declares
  `"type": "module"`, `"main"` and `"exports"` pointing at `./dist/plugin.js`;
  import the staged `dist/plugin.js` (via file URL) and assert default export
  `id`/`setup` before the swap.
- **Acceptance Criteria:** staged layout test asserts every file; asset counts
  match; the import check passes; a missing/partial `dist` fails with an
  actionable error.
- **Cautionary Points (Risks & Edge Cases):** do not copy `node_modules` or
  the CLI itself; preserve executable bits only where needed; the plugin
  bundle must not evaluate `duckdb`.
- **Implementation Suggestions:** share constants for expected counts; use the
  existing smoke-load assertions as a model.
- **Testing Suggestions:** fixture package roots for complete/partial/missing
  dist; dynamic import of the staged bundle.
- **Done When:** materializer produces an importable plugin directory from the
  built repo.

#### Sub-Task 2.4: Add ownership detection, upgrade, and `--force` semantics

- **Status:** Completed
- **Objective:** Make re-runs safe: upgrade managed installs, refuse unmanaged
  directories, and require explicit force for overrides.
- **Related Requirements:** R5, R6, R10, R12
- **Dependencies and Preconditions:** 2.1, 2.2, 2.3.
- **In Scope for This Sub-Task:** install-state classification (absent,
  managed-current, managed-older, managed-newer, unmanaged, corrupt-manifest),
  version comparison, upgrade messaging, force-only replacement.
- **Out of Scope for This Sub-Task:** config conflict handling.
- **Instructions:** Identical version + identical file set = no-op; different
  managed version = upgrade; unmanaged/corrupt = refuse unless `--force`;
  warn when downgrading; never delete an unmanaged directory on install.
- **Acceptance Criteria:** state-machine unit tests; re-install no-op leaves
  mtimes/content unchanged; unmanaged refusal prints the target and suggests
  `--force`; forced replacement leaves no stale files.
- **Cautionary Points (Risks & Edge Cases):** a managed directory with extra
  user files should be preserved or reported, not silently wiped — decide and
  test (prefer: upgrade replaces only managed paths, reports extras).
- **Implementation Suggestions:** keep classification pure and testable;
  perform writes only in the command layer.
- **Testing Suggestions:** table-driven state tests + integration upgrade.
- **Done When:** all install-state transitions are covered and safe.

### Phase 3: OpenCode Config Integration

- **Status:** Completed

#### Sub-Task 3.1: Implement JSONC-preserving read/modify/remove

- **Status:** Completed
- **Objective:** Edit `opencode.jsonc` without destroying comments,
  formatting, trailing commas, or unrelated keys.
- **Related Requirements:** R7, R8, R12
- **Dependencies and Preconditions:** 1.2; add `jsonc-parser` dependency.
- **In Scope for This Sub-Task:** `src/cli/jsonc.ts`: read/parse with error
  reporting, deep-equal comparison, insert/update `mcp.servers.dh`, remove the
  key, prune empty parents, apply edits.
- **Out of Scope for This Sub-Task:** path selection, backups, command logic.
- **Instructions:** Parse with `jsonc-parser`; abort on syntax errors with the
  line/offset; use `modify` + `applyEdits` for targeted edits; insert missing
  intermediate objects; preserve indentation detected from the file (default
  2 spaces); handle empty files.
- **Acceptance Criteria:** fixtures with comments/trailing commas/unusual
  indentation round-trip byte-for-byte when unchanged; insert/update/remove
  tests assert comments survive; removal prunes only empty managed parents.
- **Cautionary Points (Risks & Edge Cases):** duplicate keys; JSON with BOM;
  CRLF files; comments inside the `dh` object; `null` values; invalid JSONC.
- **Implementation Suggestions:** normalize line endings on write only if the
  input was CRLF; keep the parser options explicit.
- **Testing Suggestions:** golden fixtures for comments, CRLF, BOM, invalid
  syntax, and nested pruning.
- **Done When:** config edit helpers are proven non-destructive.

#### Sub-Task 3.2: Add config target selection, backup, and atomic write

- **Status:** Completed
- **Objective:** Choose the right OpenCode config file and persist changes
  safely.
- **Related Requirements:** R3, R7, R12
- **Dependencies and Preconditions:** 1.2, 3.1.
- **In Scope for This Sub-Task:** `src/cli/config-file.ts`: prefer existing
  `opencode.jsonc`, then `opencode.json`, else create `opencode.jsonc`; backup
  existing file to `<name>.bak` before the first change; write temp + rename;
  preserve mode; create parent dirs only within the resolved scope.
- **Out of Scope for This Sub-Task:** deciding whether to merge or conflict.
- **Instructions:** Never create a second config format when one exists; if
  both exist, prefer `.jsonc`; back up only when content changes; preserve the
  original file mode (new files 0600); do not write backups when the edit is a
  no-op.
- **Acceptance Criteria:** selection tests for both/one/no config files; backup
  content equals the pre-edit file; atomic-write and mode tests pass.
- **Cautionary Points (Risks & Edge Cases):** config paths may be symlinks
  managed by dotfiles; edit the resolved target but keep the symlink intact
  (write through, don't replace the link); permission errors must not leave a
  temp file behind.
- **Implementation Suggestions:** reuse `fs-utils` atomic write; read the
  target of a symlink for backup naming.
- **Testing Suggestions:** temp configs plus a symlinked-config case.
- **Done When:** config writes are atomic, backed up, and format-stable.

#### Sub-Task 3.3: Implement MCP entry ownership, conflict, and pruning rules

- **Status:** Completed
- **Objective:** Apply the canonical `dh` entry only when safe, and remove only
  what the installer owns.
- **Related Requirements:** R7, R8, R10, R13
- **Dependencies and Preconditions:** 2.1, 3.1, 3.2.
- **In Scope for This Sub-Task:** `src/cli/mcp-entry.ts`: canonical entry
  constant, deep-equal matching, insert/update, conflict warning, forced
  overwrite, removal with exact-match guard, empty-container pruning,
  fingerprint persistence in the manifest.
- **Out of Scope for This Sub-Task:** CLI flags/output (phase 4).
- **Instructions:** Default behavior never overwrites a differing entry;
  `--force` overwrites; `--no-mcp` skips; if the config cannot be parsed, fail
  the config step without touching the plugin install; on uninstall, remove
  only when the current entry equals the manifest fingerprint (or `--force`).
- **Acceptance Criteria:** tests for absent/identical/different/forced/removed
  entries; unrelated servers survive; pruning leaves no empty `mcp`/`servers`
  objects; parse failure leaves the file byte-identical.
- **Cautionary Points (Risks & Edge Cases):** a user may have added
  `environment` or a different timeout — treat as different; don't rewrite
  formatting when only comparing; avoid deleting a `dh` entry created by
  another tool.
- **Implementation Suggestions:** centralize the canonical entry in one
  exported constant; deep-equal via stable JSON serialization of the entry.
- **Testing Suggestions:** fixture configs for each state, including
  user-customized entries.
- **Done When:** config merge/removal behavior matches the SDD exactly.

### Phase 4: Command Orchestration

- **Status:** Completed

#### Sub-Task 4.1: Implement `install`

- **Status:** Completed
- **Objective:** Wire scope → materialize → config → report into one
  idempotent command.
- **Related Requirements:** R1, R2, R4, R6, R7, R8, R11, R12
- **Dependencies and Preconditions:** phases 1–3.
- **In Scope for This Sub-Task:** `src/cli/commands/install.ts` with
  confirmation (`--yes`), `--dry-run`, `--no-mcp`, `--force`, human/JSON
  output, partial-failure semantics.
- **Out of Scope for This Sub-Task:** status/uninstall.
- **Instructions:** Order: resolve scope → classify target → plan actions →
  (dry-run stops) → materialize plugin atomically → merge config → write
  manifest. If config merging fails after the plugin swap, keep the plugin
  installed but exit 1 with a clear message and a re-run hint; never leave a
  half-written plugin. Dry-run prints every intended write, including whether
  the config would change, and touches nothing.
- **Acceptance Criteria:** integration tests for global/project install,
  no-op re-run, upgrade, `--force`, `--no-mcp`, dry-run (no writes), and
  config-conflict warning; JSON output includes target/config/actions.
- **Cautionary Points (Risks & Edge Cases):** do not create the config file
  when `--no-mcp`; do not write the manifest before the plugin is in place;
  a config parse failure must not delete an existing install.
- **Implementation Suggestions:** return an action plan object so dry-run and
  real execution share one code path; perform writes only in an executor.
- **Testing Suggestions:** integration tests against temp HOME/project.
- **Done When:** install works end-to-end in both scopes with all flags.

#### Sub-Task 4.2: Implement `status`

- **Status:** Completed
- **Objective:** Report installed state, version, paths, and config wiring
  without modifying anything.
- **Related Requirements:** R9, R11, R13
- **Dependencies and Preconditions:** phase 2, 3.3.
- **In Scope for This Sub-Task:** `src/cli/commands/status.ts`: manifest read,
  file presence/integrity checks, version comparison with the CLI, config
  entry state (`present-matching`, `present-different`, `missing`,
  `unreadable`), human + JSON output, exit code policy.
- **Out of Scope for This Sub-Task:** repairs, installs, uninstalls.
- **Instructions:** Status must be read-only; exit 0 when a managed install is
  found (even with drift) and 1 when absent, so scripts can branch; `--json`
  includes a stable schema with `installed`, `version`, `target`, `config`,
  `entry`, `issues`.
- **Acceptance Criteria:** tests for absent, current, older/newer, corrupt
  manifest, config missing/different/unreadable; JSON schema stable; no writes.
- **Cautionary Points (Risks & Edge Cases):** don't import the plugin to
  verify (slow/side effects); compare manifest version to CLI version; report
  config conflicts without printing config contents.
- **Implementation Suggestions:** reuse classification from 2.4 and
  `mcp-entry` comparison.
- **Testing Suggestions:** fixture installs + temp configs.
- **Done When:** status output is accurate and read-only.

#### Sub-Task 4.3: Implement `uninstall`

- **Status:** Completed
- **Objective:** Remove only installer-owned artifacts, safely and
  idempotently.
- **Related Requirements:** R10, R11, R12
- **Dependencies and Preconditions:** phase 2, 3.3, 4.2.
- **In Scope for This Sub-Task:** `src/cli/commands/uninstall.ts`: manifest
  validation, target ownership check, config entry removal, container pruning,
  `--dry-run`, `--force` for corrupt manifests, human/JSON output.
- **Out of Scope for This Sub-Task:** removing manual/clone installs.
- **Instructions:** Refuse when no manifest is present (suggest manual
  removal); remove `dh` only when it matches the manifest fingerprint or
  `--force`; remove the plugin dir after config cleanup succeeds (or keep it
  and report if config cleanup fails); an already-absent install exits 0 with
  "nothing to do".
- **Acceptance Criteria:** integration tests for clean uninstall, missing
  install, differing `dh` (preserved), forced removal, dry-run, and unrelated
  config preservation.
- **Cautionary Points (Risks & Edge Cases):** never delete a directory whose
  resolved path differs from the expected target; symlinked targets are
  removed as links only, never followed; partial failure must be recoverable
  by re-running.
- **Implementation Suggestions:** do config removal first, then the directory;
  the manifest is the source of truth for ownership.
- **Testing Suggestions:** temp installs with extra files and customized
  config entries.
- **Done When:** uninstall is ownership-safe and idempotent.

#### Sub-Task 4.4: Add `--mcp-only` wiring and duplicate-load detection

- **Status:** Completed
- **Objective:** Support users who install the plugin through
  `opencode plugin add` and only need the `dh` MCP entry, without creating a
  second plugin copy.
- **Related Requirements:** R25, R26, R19
- **Dependencies and Preconditions:** 3.3, 4.1, 4.3.
- **In Scope for This Sub-Task:** `--mcp-only` on `install` and `uninstall`;
  config-only execution path (no plugin materialization/manifest); MCP source
  selection (`--mcp-package` or `--mcp-source npm|github`); duplicate-load
  detection against the `plugins` config array; status reporting.
- **Out of Scope for This Sub-Task:** installing/removing the plugin entry
  managed by `opencode plugin add`.
- **Instructions:** `install --mcp-only` resolves scope, merges
  `mcp.servers.dh`, and exits without creating a plugin directory or manifest;
  `uninstall --mcp-only` removes only the matching entry. When a managed copy
  exists and the config `plugins` array already references the package/Git
  spec, print a duplicate-load warning with the two locations. The MCP command
  spec must match the chosen channel; default to the npm spec after
  publication and allow `--mcp-package=github:...`.
- **Acceptance Criteria:** tests prove `--mcp-only` writes only the config
  entry, does not create a target dir/manifest, works in both scopes, and
  uninstall removes only that entry. Duplicate detection tests cover matching
  and unrelated plugin entries.
- **Cautionary Points (Risks & Edge Cases):** do not edit the `plugins` array
  (owned by OpenCode); do not remove a user-managed `dh` entry on uninstall
  unless it matches the canonical entry; `--mcp-only` with `--force` follows
  the same conflict rules.
- **Implementation Suggestions:** reuse the config/MCP modules; model the
  action plan with a `plugin: false` step; keep the manifest optional.
- **Testing Suggestions:** integration tests after a simulated `opencode plugin
  add` config entry (fixture) and after a managed install.
- **Done When:** both install channels can coexist without duplicate
  registrations.

### Phase 5: Packaging and Build Integration

- **Status:** Completed

#### Sub-Task 5.1: Add the CLI build entry, bin aliases, and prepare artifact

- **Status:** Completed
- **Objective:** Make the installer runnable through npx (npm and Git
  channels) and as a package bin.
- **Related Requirements:** R1, R15
- **Dependencies and Preconditions:** 1.1; `dist/cli.js` name fixed.
- **In Scope for This Sub-Task:** `tsup.config.ts` entry `cli: 'src/cli/main.ts'`;
  `package.json` `bin` entries `dev-harness` and `dev-harness-skills` →
  `./dist/cli.js`; `scripts/prepare.mjs` artifact list includes `dist/cli.js`;
  knip/depcruise entry-point wiring if required.
- **Out of Scope for This Sub-Task:** npm registry publish, CI workflows.
- **Instructions:** The shebang banner already applies to all tsup entries;
  confirm the emitted file starts with `#!/usr/bin/env node` and is executable
  in the npx bin shim. Expose two bin names so npx can resolve the bin matching
  the package name without `--package`. Update prepare's completeness check so
  a missing CLI does not count as a successful build.
- **Acceptance Criteria:** `pnpm build` emits `dist/cli.js`; both bin names
  resolve; `prepare` rebuilds when the CLI is missing; `node dist/cli.js
  --version` works.
- **Cautionary Points (Risks & Edge Cases):** tsup `clean: true` wipes dist;
  ensure copy-assets still runs; do not break the existing MCP bin or plugin
  bundle externalization.
- **Implementation Suggestions:** add the entry next to the existing two; keep
  the build order unchanged.
- **Testing Suggestions:** build + direct execution + `npm pack --dry-run`
  artifact assertions in 5.2.
- **Done When:** built CLI is runnable and part of the build contract.

#### Sub-Task 5.2: Prepare package metadata for npm and `opencode plugin add`

- **Status:** Completed
- **Objective:** Make the published tarball a complete, importable OpenCode
  plugin while preserving repository source-mode loading.
- **Related Requirements:** R22, R23, R24, R27
- **Dependencies and Preconditions:** 5.1; `dist/plugin.d.ts` emitted by the
  build.
- **In Scope for This Sub-Task:** `package.json` `main`, `exports`, `types`,
  `files`, `publishConfig`, `prepublishOnly`/`prepack` guard, README inclusion;
  verify `opencode plugin add` can resolve the package entry.
- **Out of Scope for This Sub-Task:** executing `npm publish`, registry auth.
- **Instructions:** Point `main`/`exports`/`types` at `dist/plugin.js` /
  `dist/plugin.d.ts`; include `dist` and `README.md` in `files` (npm always
  includes `package.json`); add `publishConfig.access: "public"`. Keep the
  repo-root `index.ts` for directory/source-mode discovery. Add a
  `prepublishOnly` (or `prepack`) guard that builds and runs the fast QA gate,
  not the network-dependent Docker gate. Verify a fresh clone still loads from
  source without a build; if OpenCode discovery follows package `main` rather
  than `index.ts`, document the evidence and choose the least invasive
  fallback (include `index.ts`/`src` in `files` and keep `main` on source)
  rather than shipping a broken registry package.
- **Acceptance Criteria:** `npm pack` contains `dist/plugin.js`,
  `dist/plugin.d.ts`, `dist/assets`, `dist/cli.js`, `dist/mcp/stdio.js`, and
  `README.md`; `main`/`exports` resolve; source-mode clone loading still works;
  `npm publish --dry-run` succeeds from a clean tree.
- **Cautionary Points (Risks & Edge Cases):** moving `main` can break directory
  plugin discovery or `file://` local entries; test both. Do not include
  `src/`, tests, plans, or credentials unless required for source fallback.
  `prepare` must not run a full QA gate for registry consumers.
- **Implementation Suggestions:** use conditional exports with `types` first;
  keep `bin` paths in `dist`; run `npm pack --json` and inspect the file list.
- **Testing Suggestions:** pack and install into a temp prefix; import the
  package; run `opencode plugin add` against the tarball/Git spec in 7.4.
- **Done When:** the tarball is a complete plugin package and source mode
  remains intact.

#### Sub-Task 5.3: Verify npm tarball installation and source-mode compatibility

- **Status:** Completed
- **Objective:** Prove a registry-style install works without the repository.
- **Related Requirements:** R22, R24, R27
- **Dependencies and Preconditions:** 5.2.
- **In Scope for This Sub-Task:** `npm pack` → temp `npm install` → import
  `dev-harness-skills` (ESM) → assert plugin `id`/`setup`; execute
  `node_modules/.bin/dev-harness --version` and `dev-harness-mcp` smoke;
  verify assets resolve from the installed `dist`; verify a fresh clone still
  loads `index.ts` from source; `npm publish --dry-run` and name/ownership
  preflight.
- **Out of Scope for This Sub-Task:** actually publishing; `opencode plugin
  add` runtime (7.4).
- **Instructions:** Use a temp prefix and a clean `npm pack`; do not rely on the
  repo's `node_modules`. Assert the tarball has no `docs/plans`, tests, `.env`,
  logs, or source maps with secrets. Run `npm view dev-harness-skills` and
  `npm whoami` as a preflight; stop if the name is taken.
- **Acceptance Criteria:** installed package imports and exposes the plugin;
  both bins run; assets are found; source clone still works; publish dry-run
  passes; pack file list matches the intended set.
- **Cautionary Points (Risks & Edge Cases):** `npm install` may run `prepare`
  for Git installs but not for tarballs — the tarball must already contain
  `dist`; native `duckdb` is only needed for sheet tools and must not break
  plugin import; `npm pack` can include unexpected files.
- **Implementation Suggestions:** add the assertions to
  `scripts/smoke-install.mjs` or a dedicated `scripts/smoke-pack.mjs`; keep
  offline.
- **Testing Suggestions:** `npm pack --json`, temp prefix install, dynamic
  import, bin checks.
- **Done When:** registry-style install is proven and the publish preflight is
  documented.

### Phase 6: Tests, Smoke, and QA

- **Status:** Completed

#### Sub-Task 6.1: Unit tests for CLI primitives

- **Status:** Completed
- **Objective:** Lock down parsing, scope, JSONC, manifest, and ownership
  rules with fast tests.
- **Related Requirements:** R14
- **Dependencies and Preconditions:** phases 1–3.
- **In Scope for This Sub-Task:** `src/cli/__tests__/args.test.ts`,
  `scope.test.ts`, `jsonc.test.ts`, `manifest.test.ts`, `mcp-entry.test.ts`,
  fixtures for configs and manifests.
- **Out of Scope for This Sub-Task:** built-artifact/process integration.
- **Instructions:** TDD throughout; tests must not touch real home/config;
  cover error paths and exact exit-code mapping; use table-driven cases where
  possible.
- **Acceptance Criteria:** all unit tests pass under `pnpm test`; coverage
  includes every requirement behavior listed in 3.1/3.3/2.1.
- **Cautionary Points (Risks & Edge Cases):** avoid brittle formatting
  assertions beyond the intended preservation guarantees.
- **Implementation Suggestions:** share fixture builders; keep files < 300
  lines.
- **Testing Suggestions:** `pnpm test -- src/cli`.
- **Done When:** primitives are covered and green.

#### Sub-Task 6.2: Integration tests for install/status/uninstall

- **Status:** Completed
- **Objective:** Exercise the real command flow in isolated environments.
- **Related Requirements:** R2, R6, R7, R9, R10, R11, R14
- **Dependencies and Preconditions:** phase 4, 5.1.
- **In Scope for This Sub-Task:** `src/cli/__tests__/commands.test.ts` spawning
  `node dist/cli.js` with temp `HOME`, `XDG_CONFIG_HOME`,
  `OPENCODE_CONFIG_DIR`, and a temp project; global/project install, no-op
  re-run, upgrade, force, no-mcp, dry-run, non-TTY scope error, status JSON,
  uninstall, config preservation.
- **Out of Scope for This Sub-Task:** npx network install (covered by the
  Docker remote mode in 7.2/7.3 and final verification in 8.4).
- **Instructions:** Build before running integration tests (or use a fixture
  `dist`); assert exit codes and stdout JSON; ensure no test writes to the real
  `$HOME`; clean temp dirs in `finally`.
- **Acceptance Criteria:** integration suite passes deterministically; both
  scopes covered; installed `dist/plugin.js` imports successfully; uninstall
  leaves unrelated config untouched.
- **Cautionary Points (Risks & Edge Cases):** temp-dir cleanup on Windows;
  concurrency between test files (use unique dirs); environment leakage.
- **Implementation Suggestions:** a small helper to spawn the CLI with an env
  overlay and parse stdout.
- **Testing Suggestions:** `pnpm build && pnpm test -- src/cli/__tests__/commands`.
- **Done When:** full lifecycle is proven without network access.

#### Sub-Task 6.3: Add `scripts/smoke-install.mjs` and wire the QA gate

- **Status:** Completed
- **Objective:** Provide a release-gate smoke test over the built CLI.
- **Related Requirements:** R14, R15, R17
- **Dependencies and Preconditions:** 6.2.
- **In Scope for This Sub-Task:** smoke script that runs dry-run, global
  install, idempotent re-run, status JSON, import check, uninstall, project
  scope, non-TTY exit code, and pack-artifact assertions; add it to
  `qa:check:full` after build.
- **Out of Scope for This Sub-Task:** real npx/network verification.
- **Instructions:** Use `node dist/cli.js`; isolate env; fail with a clear
  message and non-zero exit; keep runtime under a few seconds; print one line
  per check.
- **Acceptance Criteria:** smoke exits 0 on a clean build; fails on missing
  CLI/artifacts; wired into `qa:check:full`.
- **Cautionary Points (Risks & Edge Cases):** don't accidentally use the
  developer's real config when `OPENCODE_CONFIG_DIR` is unset; assert the env
  overlay is applied.
- **Implementation Suggestions:** mirror `scripts/smoke-load.mjs` style.
- **Testing Suggestions:** run the script directly and via the full gate.
- **Done When:** the smoke is part of the release gate.

#### Sub-Task 6.4: Run the full QA gate and fix static-analysis fallout

- **Status:** Completed
- **Objective:** Keep the repository's quality gates green with the new
  modules and dependency.
- **Related Requirements:** R17
- **Dependencies and Preconditions:** 6.1–6.3.
- **In Scope for This Sub-Task:** `pnpm qa:check:full`, biome fixes, knip
  unused-export/dependency adjustments, dependency-cruiser entry points,
  duplicate-code review, typecheck, audit.
- **Out of Scope for This Sub-Task:** weakening rules or excluding the CLI
  from analysis.
- **Instructions:** Fix root causes; only add legitimate entry points/ignores
  where the tool cannot see dynamic/CLI usage; keep files under 300 lines by
  splitting modules.
- **Acceptance Criteria:** `pnpm qa:check:full` exits 0; no new lint/knip/
  depcruise suppressions beyond documented entry-point configuration.
- **Cautionary Points (Risks & Edge Cases):** knip may flag CLI exports used
  only by tests/entry; dependency-cruiser may flag `src/cli/main.ts` as an
  orphan if tsup is not recognized.
- **Implementation Suggestions:** run the gate piecewise to isolate failures.
- **Testing Suggestions:** full gate twice (clean build, incremental).
- **Done When:** the gate is green on the final branch state.

### Phase 7: Dockerized Test Environment

- **Status:** In Progress

#### Sub-Task 7.1: Build the derived OpenCode test image

- **Status:** Completed
- **Objective:** Provide a pinned, non-root test image based on the official
  OpenCode image with the toolchain needed for `npx`, while keeping the
  official `opencode` binary available.
- **Related Requirements:** R18, R19, R21
- **Dependencies and Preconditions:** 5.1 (CLI build entry) and 6.2
  (integration flow) are available for the image to exercise.
- **In Scope for This Sub-Task:** `docker/test/Dockerfile`, `.dockerignore`,
  base image pinned by tag/digest, `apk add --no-cache nodejs npm git
  openssh-client gcompat`, non-root `tester` user with UID/GID build args,
  binary assertions (`opencode`, `node`, `npm`, `git`, `ssh`), and a minimal
  image with no credentials or repo files.
- **Out of Scope for This Sub-Task:** running the tests, credential mounts,
  CI workflows, publishing the image.
- **Instructions:** Use `FROM ghcr.io/anomalyco/opencode:<pinned>` (verified
  base: Alpine 3.24.2, opencode 2.0.18, entrypoint `opencode`, root by
  default). Add the packages above; `gcompat` is required for the bundled
  `duckdb` native binding to load on musl (verified: without it,
  `require('duckdb')` fails with `ld-linux-x86-64.so.2`; with it, it loads).
  Create `tester` with build args defaulting to 1000/1000 and `USER tester`;
  keep `/usr/local/bin/opencode` intact. Add a build-time smoke that asserts
  the five binaries and `require('duckdb')`.
- **Acceptance Criteria:** `docker build` succeeds with host UID/GID; all
  binary/version assertions pass; the image contains no `.ssh`,
  `.gitconfig`, `.git-credentials`, tokens, or repo checkout; the official
  opencode binary still runs.
- **Cautionary Points (Risks & Edge Cases):** Alpine's Node/npm versions come
  from the distro (observed Node 24.18.1/npm 11.12.1) — pin the base digest
  and assert `node >= 20.11`; do not add build tools "just in case" (duckdb
  ships a binding); do not run as root by default; `gcompat` is a functional
  requirement, not an optimization.
- **Implementation Suggestions:** multi-arg `ARG UID/GID`; `addgroup`/
  `adduser -D -u "$UID" -G tester -h /home/tester tester`; keep the inherited
  entrypoint but document `--entrypoint sh` for tests.
- **Testing Suggestions:** `docker run --rm --entrypoint sh
  dev-harness-test:local -c 'opencode --version; node -v; npm -v; git
  --version; ssh -V; node -e "require(\"duckdb\")"'`.
- **Done When:** the image builds reproducibly and passes its own smoke.

#### Sub-Task 7.2: Add the credential-mount Docker runner

- **Status:** Completed
- **Objective:** Run installer tests in a disposable container with isolated
  config and read-only host Git credentials.
- **Related Requirements:** R18, R19, R20
- **Dependencies and Preconditions:** 7.1; phase 4 commands finalized.
- **In Scope for This Sub-Task:** `scripts/docker-test.sh` with modes
  `--remote` (npx from GitHub) and `--local` (pack the working tree), optional
  `--ref`, `--keep`, `--verbose`; conditional credential mounts; temp
  project/config dirs; named npm cache volume; `set +x`/redaction; cleanup.
- **Out of Scope for This Sub-Task:** non-Docker smoke tests, CI workflows.
- **Instructions:** Detect and mount only existing credential sources:
  `~/.gitconfig` → `/home/tester/.gitconfig:ro`, `~/.ssh` →
  `/home/tester/.ssh:ro`, `~/.git-credentials` →
  `/home/tester/.git-credentials:ro`, `~/.config/gh` →
  `/home/tester/.config/gh:ro`. Use `--mount type=bind,...,readonly` so a
  missing path does not create a host directory. Set `HOME=/home/tester`
  inside the container for git/npm, but point the installer/OpenCode at
  `/tmp/dh-test/{home,opencode,project}` via `XDG_CONFIG_HOME` and
  `OPENCODE_CONFIG_DIR` so nothing writes to the host. Mount a named
  `dev-harness-npm-cache` volume at `/home/tester/.npm`. Fail early with a
  clear message when no credential source is found for `--remote`; `--local`
  must work offline. Never print credential contents or env dumps.
- **Acceptance Criteria:** runner mounts only existing credentials read-only;
  remote mode authenticates and clones the private repo; local mode works
  without GitHub; both use isolated config paths; host files are unchanged
  (checksum the mounted credential files before/after); cleanup removes temp
  dirs unless `--keep`.
- **Cautionary Points (Risks & Edge Cases):** SSH vs HTTPS credential mode;
  `github:` specs may resolve over SSH; support `GIT_CONFIG_GLOBAL` and
  `GIT_SSH_COMMAND` overrides; avoid `-v` shorthand for missing files;
  user/group mismatch on the cache volume; `set -euo pipefail` plus `set +x`.
- **Implementation Suggestions:** build the image with host UID/GID; generate
  a `docker run` argument array in the script (no compose interpolation
  traps); use `mktemp -d` and a trap for cleanup.
- **Testing Suggestions:** run `--local` in CI-like offline mode; run
  `--remote --ref <branch>` manually with real credentials and record it.
- **Done When:** the runner executes both modes with proven credential and
  filesystem isolation.

#### Sub-Task 7.3: Add containerized lifecycle assertions and official-image plugin check

- **Status:** Completed
- **Objective:** Prove install/status/import/uninstall inside the container and
  verify plugin loading with the unmodified official image.
- **Related Requirements:** R20, R21, R14
- **Dependencies and Preconditions:** 7.2; phase 6 tests green on the host.
- **In Scope for This Sub-Task:** `docker/test/run-checks.sh` (or runner
  subcommand) assertions: install project/global in temp paths, config
  contents, manifest, plugin import + `setup(stub)` registration of 7 agents /
  17 skills, idempotent re-run, status JSON, uninstall, non-TTY exit 2;
  `opencode debug agents` best-effort (opencode 2.0.18 does not surface plugin
  agents through this command) and a note that the raw image has no
  `npx`/MCP toolchain.
- **Out of Scope for This Sub-Task:** interactive TUI testing, model calls,
  MCP sheet-tool execution (covered by host tests; note the gcompat
  requirement).
- **Instructions:** Run the checks inside the derived image with
  `--entrypoint sh`; use `node` to import the installed `dist/plugin.js` and
  call `setup` with a stub transform context, asserting 7 agents/17 skills;
  parse `status --json`. Run `opencode debug agents` as best-effort and record
  the CLI limitation instead of failing the gate. Do not require
  authentication.
- **Acceptance Criteria:** all lifecycle assertions pass in both scopes;
  installed `setup(stub)` registers 7 agents/17 skills; `debug agents` output
  is recorded (best-effort); evidence is written to
  `docs/plans/npx-install-entrypoint/tasks/verification.md`.
- **Cautionary Points (Risks & Edge Cases):** official image entrypoint is
  `opencode` — pass the subcommand directly, do not prepend `sh`; it has no
  Node, so MCP startup/`mcp list` may fail and is explicitly out of scope
  there; use the derived image for MCP checks.
- **Implementation Suggestions:** keep assertions in a POSIX `sh` script so
  the same file runs in the Alpine image; use `jq` only if installed, or
  `node -e` for JSON parsing.
- **Testing Suggestions:** run the full script in both `--remote` and
  `--local` modes; capture container IDs and timings without secrets.
- **Done When:** Docker evidence complements the host `qa:check:full` gate.

#### Sub-Task 7.4: Verify `opencode plugin add` (Git + npm) and `--mcp-only`

- **Status:** Pending
- **Objective:** Prove OpenCode's own plugin manager can install this package
  from the Git channel and that MCP-only wiring works afterward; the npm
  registry spec is verified post-publication in 8.5.
- **Related Requirements:** R23, R25, R26, R21
- **Dependencies and Preconditions:** 5.2, 7.1, 7.3.
- **In Scope for This Sub-Task:** in the derived image with an isolated
  `HOME`: `opencode plugin add github:andrescevp/development-harness#<ref>`,
  `opencode plugin list`, `opencode debug agents` (7 `dh-*` agents),
  `opencode plugin remove`; a local tarball check if `opencode plugin add`
  accepts it; `install --mcp-only` and `uninstall --mcp-only`; duplicate-load
  warning; config inspection.
- **Out of Scope for This Sub-Task:** publishing the package and the npm
  registry spec (post-publish evidence in 8.5); editing OpenCode's plugin
  manager; testing every OpenCode version.
- **Instructions:** `opencode plugin add` writes the **global** configuration,
  so use a temp HOME and never the developer's real config. The Git spec is
  testable immediately; the npm spec must be tested against the published
  package in 8.5, not by pointing at the repo. Confirm the plugin loads from
  the package entry (`main`/`exports`), not from `index.ts` in the repo. After
  plugin add, run `dev-harness install --global --mcp-only` and verify only
  `mcp.servers.dh` is written; then add a managed copy in the same HOME and
  assert the duplicate warning.
- **Acceptance Criteria:** Git spec installs and shows 7 agents + 17 skills;
  `plugin list` and `plugin remove` behave; a local tarball works if supported;
  `--mcp-only` writes/removes only the MCP entry; duplicate warning is emitted
  when both channels are present; config/global HOME is isolated and cleaned
  up.
- **Cautionary Points (Risks & Edge Cases):** `opencode plugin add` may use its
  own npm/bun install path and cache; the official image has no Node, so use
  the derived image with Node; npm registry evidence is deferred to 8.5. A Git
  install may skip `prepare`/dev dependencies, leaving `dist` missing — test
  this explicitly and record whether the Git spec or only the npm spec is
  supported. Version skew between the opencode binary and the plugin's
  `@opencode/plugin` dependency must be recorded.
- **Implementation Suggestions:** reuse the Docker runner's temp HOME and
  credential mounts; capture `opencode plugin list` and `debug agents` output
  in evidence; do not commit configs containing tokens.
- **Testing Suggestions:** run the Git-spec check in Docker CI-like mode; the
  npm spec check after the first publish is recorded in 8.5.
- **Done When:** the Git `opencode plugin add` channel and MCP-only wiring are
  proven; npm registry verification is queued for 8.5.

### Phase 8: Documentation and Final Verification

- **Status:** Pending

#### Sub-Task 8.1: Rewrite the README installation section

- **Status:** Completed
- **Objective:** Make the npx installer the primary, copy-pasteable path.
- **Related Requirements:** R16
- **Dependencies and Preconditions:** phase 4 behavior finalized.
- **In Scope for This Sub-Task:** README `Installation` with npm and Git
  channels, installer global/project commands, `opencode plugin add` variants,
  MCP-only wiring, flags, verification, upgrade/status/uninstall, and a short
  note that clone/source remains a development path.
- **Out of Scope for This Sub-Task:** architecture/agent/skill reference
  rewrites.
- **Instructions:** Show exact commands, expected paths, and restart guidance;
  mention `--dry-run`, `--no-mcp`, `--mcp-only`, `--force`, and non-TTY
  behavior; keep the MCP snippet source-parameterized and consistent with the
  canonical entry; link to the publish runbook for maintainers.
- **Acceptance Criteria:** commands match the implemented CLI and both
  distribution channels; no stale clone-first instructions at the top.
- **Cautionary Points (Risks & Edge Cases):** npm commands only work after the
  package is published; label them accordingly and keep the Git fallback.
  Don't claim zero-restart behavior.
- **Implementation Suggestions:** keep one canonical command block and link to
  LOADING for details.
- **Testing Suggestions:** copy each command and check `--help` consistency.
- **Done When:** README install path is accurate and primary.

#### Sub-Task 8.2: Document the installer in `docs/LOADING.md`

- **Status:** Completed
- **Objective:** Provide operational detail: scopes, paths, config merge,
  status/uninstall, upgrades, exit codes, troubleshooting.
- **Related Requirements:** R16, R15
- **Dependencies and Preconditions:** 8.1.
- **In Scope for This Sub-Task:** new "install channels" section (npm
  installer, Git installer, `opencode plugin add` npm/Git, clone/source);
  "npx installer" operational details; MCP-only wiring; duplicate-load
  warning; restart/verification steps; conflict behavior; backup location;
  cache-bust guidance; link to the publish runbook for maintainers.
- **Out of Scope for This Sub-Task:** unrelated troubleshooting edits.
- **Instructions:** Explain global vs project precisely, including
  `OPENCODE_CONFIG_DIR`/`XDG_CONFIG_HOME`; state that `--yes` never selects a
  scope; document JSON output and exit codes; explain which channel owns the
  plugin entry and why not to combine `opencode plugin add` with a managed
  copy; include recovery steps for a partial config failure.
- **Acceptance Criteria:** a user can install, verify, upgrade, and uninstall
  using only the doc; paths and flags match the implementation.
- **Cautionary Points (Risks & Edge Cases):** keep the MCP section canonical
  and avoid duplicating conflicting snippets.
- **Implementation Suggestions:** cross-link README ↔ LOADING instead of
  copying everything.
- **Testing Suggestions:** verify markdown links with `pnpm lint:links`.
- **Done When:** docs cover the full lifecycle.

#### Sub-Task 8.3: Update `AGENTS.md` and repository contract references

- **Status:** Completed
- **Objective:** Keep the harness runtime contract and repo layout accurate.
- **Related Requirements:** R16, R17
- **Dependencies and Preconditions:** 8.1, 8.2.
- **In Scope for This Sub-Task:** repository layout (`src/cli/`), install
  command mention, tooling/gate note for `smoke-install`, and any canonical
  MCP snippet updates.
- **Out of Scope for This Sub-Task:** changing agent/skill inventory or the
  skills loop.
- **Instructions:** Keep edits minimal and consistent with the actual code;
  update the QA table and layout block.
- **Acceptance Criteria:** AGENTS.md references the installer, CLI path, and
  new smoke gate; no stale counts/inventory.
- **Cautionary Points (Risks & Edge Cases):** the 7 agents/17 skills counts
  must remain unchanged.
- **Implementation Suggestions:** use `dh-create-documentation` ownership
  rules for non-plan docs if delegated.
- **Testing Suggestions:** `pnpm run audit` + link check.
- **Done When:** repo contract docs match the implementation.

#### Sub-Task 8.4: Final pre-publish integration, Docker/npx smoke, and evidence

- **Status:** Completed
- **Objective:** Prove the complete user journey before publishing and capture
  evidence for final review.
- **Related Requirements:** R1–R26 (system-wide; R27 post-publish in 8.5)
- **Dependencies and Preconditions:** phases 1–7 complete.
- **In Scope for This Sub-Task:** `pnpm qa:check:full`; Docker runner `--local`
  then `--remote --ref <branch>`; official-image plugin check; npm tarball
  install/import; `opencode plugin add` Git evidence; inspect the installed
  layout; import the plugin bundle; verify `opencode debug agents`/`mcp list`
  guidance; write evidence to
  `docs/plans/npx-install-entrypoint/tasks/verification.md`.
- **Out of Scope for This Sub-Task:** modifying the developer's real global
  config during automated verification (use a temp HOME/OPENCODE_CONFIG_DIR);
  actual npm publication and npm-spec evidence (8.5).
- **Instructions:** Record exact commands, versions, and observed output.
  Confirm the npx run resolves the `dev-harness-skills` bin (package-name
  match) and that the installed plugin registers 7 agents/17 skills on a fresh
  OpenCode start. Run the Docker runner with credential checksums before/after
  to prove no host writes; use the unmodified official image for `debug
  agents` and the derived image for MCP/toolchain checks. Note the restart
  requirement and the `gcompat`/duckdb caveat for sheet tools.
- **Acceptance Criteria:** full gate green; Docker `--local` and `--remote`
  modes pass; official-image `debug agents` shows 7 agents; installed bundle
  imports; Git `opencode plugin add` works; evidence file complete; no real
  home/config pollution and no credential changes.
- **Cautionary Points (Risks & Edge Cases):** cold npx install may take
  20–25 s plus build time; use a temp npm cache if needed; the official image
  has no Node, so MCP startup there is out of scope; do not commit temp paths,
  container logs with tokens, or secrets.
- **Implementation Suggestions:** keep verification commands reproducible;
  capture versions (`node --version`, `opencode --version`, package version,
  image digest).
- **Testing Suggestions:** run the real npx command from a clean-ish cache
  once; rerun from warm cache to confirm idempotency.
- **Done When:** evidence is recorded and all pre-publish signals are green.

#### Sub-Task 8.5: Add the npm publish runbook and post-publish verification

- **Status:** In Progress
- **Objective:** Make the npm release repeatable and prove the package is
  actually installable from the registry, without automating credentials.
- **Related Requirements:** R22, R27
- **Dependencies and Preconditions:** 5.3, 8.1, 8.2, 8.4.
- **In Scope for This Sub-Task:** `docs/RELEASING.md` (or a README release
  section) with preflight (`npm whoami`, `npm view dev-harness-skills`,
  clean tree, version/tag), `pnpm qa:check:full`, `npm pack`,
  `npm publish --dry-run`, manual `npm publish --access public`, post-publish
  `npx -y dev-harness-skills --version`, `opencode plugin add
  dev-harness-skills`, and rollback/deprecate guidance.
- **Out of Scope for This Sub-Task:** automating the publish in CI, storing
  npm tokens, changing registry ownership.
- **Instructions:** The actual `npm publish` requires interactive auth and is a
  **manual release step**; execution stops and asks the user before publishing.
  Verify the published version matches the Git tag and package.json. If the
  name is unavailable/owned by another account, stop and escalate (scoped-name
  fallback requires explicit approval). Never print tokens or `.npmrc`
  contents.
- **Acceptance Criteria:** runbook is copy-pasteable; dry-run passes; the
  published `npx`/`opencode plugin add` commands work (recorded evidence);
  rollback/deprecate steps are documented; no secrets in docs.
- **Cautionary Points (Risks & Edge Cases):** npm publish is irreversible
  within 72 hours except unpublish/deprecate; version/tag mismatch creates
  unreproducible installs; `latest` can be overwritten only by newer versions.
- **Implementation Suggestions:** use `npm publish --dry-run --json` in the
  gate; keep the publish command in one block with a confirmation prompt.
- **Testing Suggestions:** first publish a prerelease (`0.5.0-rc.1`) if the
  user approves, verify both channels, then publish the final version.
- **Done When:** the release path is documented and first-publish evidence is
  recorded.

## Final Integration & Verification

- **System-Wide Test:** From a temporary project and isolated
  `HOME`/`XDG_CONFIG_HOME`/`OPENCODE_CONFIG_DIR`:
  1. `npx -y github:andrescevp/development-harness install --project --path
     "$TMP/project" --yes --dry-run` → no writes.
  2. Same install without `--dry-run` → plugin dir + `opencode.jsonc` with
     `mcp.servers.dh`; re-run → no changes.
  3. `status --project --path "$TMP/project" --json` → installed, version
     matches, entry matching.
  4. Import `<target>/dist/plugin.js` → default export with `id` and `setup`.
  5. `uninstall --project --path "$TMP/project" --yes` → target gone, `dh`
     removed, unrelated config intact.
  6. Global equivalent with `HOME`/`XDG_CONFIG_HOME` isolated.
- **Npm / OpenCode Test:** `npm pack` → install into a clean temp prefix →
  import `dev-harness-skills` (plugin id + setup) → run both bins; then in an
  isolated HOME run `opencode plugin add github:andrescevp/development-harness`
  (Git spec) and, after publication, `opencode plugin add dev-harness-skills`
  (npm spec); `opencode debug agents` shows 7 `dh-*` agents for both;
  `dev-harness install --mcp-only` writes only `mcp.servers.dh`.
- **Docker Test:** `scripts/docker-test.sh --local` (packed artifact, offline)
  and `scripts/docker-test.sh --remote --ref <branch>` (read-only host Git
  credentials, isolated `XDG_CONFIG_HOME`/`OPENCODE_CONFIG_DIR`) both pass the
  lifecycle assertions; credential checksums are unchanged; the unmodified
  `ghcr.io/anomalyco/opencode` image lists 7 `dh-*` agents with the generated
  config mounted. Record the pinned image digest and the `gcompat` duckdb
  caveat.
- **Completion Checklist:**
  - [ ] All sub-tasks `Completed`; phases `Completed` only when every
        sub-task is `Completed`.
  - [ ] `pnpm qa:check:full` exits 0.
  - [ ] `node scripts/smoke-install.mjs` exits 0 and is in the gate.
  - [ ] Docker `--local` and `--remote` modes pass; `test:docker` is
        documented as opt-in (not part of the offline gate).
  - [ ] `npm pack` contains the CLI, plugin bundle, declarations, MCP binary,
        assets, and README; tarball install/import passes.
  - [ ] `npm publish --dry-run` passes; publish runbook documented; first
        publication verified with `npx dev-harness-skills` and
        `opencode plugin add dev-harness-skills`.
  - [ ] `opencode plugin add github:...` loads 7 agents + 17 skills;
        `install --mcp-only` works after it; duplicate-load warning verified.
  - [ ] README, `docs/LOADING.md`, and `AGENTS.md` updated.
  - [ ] No writes to the developer's real `$HOME`/OpenCode config or
        credential files during tests; test evidence recorded.
  - [ ] Final review + semver recommendation (new feature → minor bump).

## Open Questions

- If `dev-harness-skills` is unavailable/owned on npm, should the release use a
  scoped name? This changes every command and the MCP spec; escalate before
  renaming.
- Should `status` optionally probe `opencode mcp list` (live connection) in
  addition to config/files? Deferred to avoid process spawning and host
  coupling; document as a manual verification step.
- If OpenCode turns out to require a `plugins` config entry rather than
  directory discovery for managed copies, should the installer add one? Only
  if 8.4 evidence proves it necessary; prefer discovery.
- Should a future release automate npm publishing in CI? Out of scope here;
  the manual runbook must be stable first.
