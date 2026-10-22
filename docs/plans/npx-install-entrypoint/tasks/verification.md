# Verification — npx install entrypoint

Recorded during plan execution on 2026-10-22 (host: CachyOS, Node 24.18.1,
opencode 2.0.18, Docker 29).

## Offline release gate

```sh
pnpm qa:check:full
```

Result: **pass**.

- Biome, Knip, jscpd (0 clones), dependency-cruiser, link check: pass
- OSV-Scanner: **No issues found** after `vitest` 5.0.2 → 5.0.3 and
  `vite` 8.3.1 → 8.3.3
- Semgrep: pass
- Build (`dist/cli.js`, `dist/plugin.js`, `dist/mcp/stdio.js`, 7 agents/17
  skills): pass
- `smoke-install`: **53 checks pass** (project/global install, idempotency,
  status JSON, dry-run/no-mcp/mcp-only, non-TTY exit 2, config preservation,
  installed bundle import, no real-HOME writes)
- `smoke-pack`: **22 checks pass** (tarball contains CLI/plugin/MCP/assets/
  declarations/README; offline install imports the plugin; both bins work;
  MCP lists 7 tools)
- Vitest: **39 files / 656 tests pass**
- `tsc --noEmit`: pass
- Harness audit: exit 0
- `smoke-load`, `smoke-mcp`: pass

## npm tarball

```sh
npm pack --ignore-scripts --json
npm publish --dry-run --json
```

- Tarball: `dev-harness-skills-0.4.0.tgz`, 201 files, ~225 kB packed.
- Contains `dist/plugin.js`, `dist/plugin.d.ts`, `dist/cli.js`,
  `dist/mcp/stdio.js`, `dist/assets` (7/17), `README.md`.
- Clean-prefix install imports the package and exposes the plugin
  `{ id, setup }`; `dev-harness --version/--help` and the MCP bin work.
- `npm publish --dry-run` exits 0 (public access; login warning only).

## Docker (opt-in)

```sh
docker build --build-arg UID=$(id -u) --build-arg GID=$(id -g) \
  -f docker/test/Dockerfile -t dev-harness-test:local .
scripts/docker-test.sh --local --no-build
```

- Base image pinned to `ghcr.io/anomalyco/opencode@sha256:aa0e5ac…` (opencode
  2.0.18, Alpine 3.24.2) plus Node 24.18.1, npm 11.12.1, git 2.54.0,
  OpenSSH 10.3p1, gcompat.
- Local mode passes: tarball install, project install/status JSON assertions,
  installed bundle import, `setup(stub)` registers **7 agents / 17 skills**,
  credential checksums unchanged, temp cleanup.
- `opencode debug agents` surfaces 0 plugin agents on this build; the runner
  records the CLI limitation and uses the setup-stub registration assertion.
- `--remote` was not run: the feature branch is not pushed and `origin/develop`
  predates the installer, so `npx github:…#develop` would install an older
  artifact.

## Known blockers

1. **npm publication**: the package is not on the registry yet; the npm specs
   (`npx dev-harness-skills`, `opencode plugin add dev-harness-skills`) cannot
   be verified until the release is published.
2. **Git `opencode plugin add`**: on OpenCode 2.0.18,
   `opencode plugin add github:andrescevp/development-harness` fails with
   `git dep preparation failed` (bundled npm) while a direct
   `npm install git+file:///…` succeeds. The npm registry spec and the npx Git
   installer are the supported paths until this is investigated/fixed.
3. `--remote` Docker verification requires pushing the feature branch (or a
   release ref) to GitHub.
