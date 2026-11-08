# Code Review Summary

**Scope**: Sub-task 1.1 — CLI argument model and command routing
(`src/cli/args.ts`, `src/cli/main.ts`, `src/cli/__tests__/args.test.ts`,
`src/cli/__tests__/main.test.ts`, `src/lib/main-entry.ts`, the
`src/mcp/stdio.ts` guard refactor, and `CODE_RULES.md`)
**Overall risk**: Low
**Verdict**: Approve with comments

## Verification performed

- `vitest run src/cli` → 66/66 tests pass; `vitest run src/mcp/__tests__/stdio.test.ts` → 13/13 pass.
- `tsc --noEmit` → exit 0; `biome check` on all changed TS files → clean.
- `knip` → exit 0; `depcruise src` → no dependency violations.
- CODE_RULES checks: all files ≤ 300 lines (args.ts 293), relative imports use
  `.js`, parser performs no I/O/exit state, entry modules are import-side-effect
  free, help output is ASCII (asserted in tests), no secrets/tokens in the diff.

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

- **Conflicting MCP source flags are accepted without a defined precedence**
  - **Location**: `src/cli/args.ts:111-123` (option table), `src/cli/args.ts:242-245` (cross-option validation)
  - **Why it matters**: The parser accepts `--mcp-package <spec>` and
    `--mcp-source npm|github` together, and also accepts either one alongside
    `--no-mcp`. Sub-task 4.4 must silently pick a winner (or ignore inputs),
    and two users passing the same flags can get a different MCP entry than
    they expect. The parser is declared as the validator of command/option
    combinations, and 1.1's acceptance criteria require invalid combinations
    to be covered.
  - **Evidence**: `parseArgs(['install', '--mcp-package=github:x/y',
    '--mcp-source=npm'])` returns both `mcpPackage` and `mcpSource` with no
    error; `finish` only checks `--global/--project`, `--path`, and
    `--no-mcp/--mcp-only`.
  - **Fix**: Reject `--mcp-package` + `--mcp-source` as mutually exclusive
    (or document "package wins" in help and enforce consistency), reject MCP
    options with `--no-mcp`, and add the cases to `INVALID_CASES` with exact
    messages.

### [P3] Low

- **Usage errors echo raw argv tokens, breaking the ASCII-only deterministic
  output rule and allowing terminal escape injection**
  - **Location**: `src/cli/args.ts:199`, `src/cli/args.ts:271`,
    `src/cli/args.ts:276` (also the unsupported-command message at
    `src/cli/args.ts:239` if aliases are added)
  - **Why it matters**: `CODE_RULES.md:35-36` requires deterministic ASCII CLI
    output. A token containing ANSI escapes or non-ASCII characters is written
    verbatim to stderr, so a wrapper passing untrusted arguments can clear the
    terminal or forge log lines. `assignValue` already quotes values via
    `JSON.stringify` (`src/cli/args.ts:188`), so the behavior is inconsistent.
  - **Evidence**: `parseArgs(['\u001b[31mfake'])` yields
    `unknown command: <ESC>[31mfake`.
  - **Fix**: Add a small `quoteToken(value)` helper that JSON-quotes and escapes
    control/non-ASCII characters, and use it in every message that embeds
    argv text.

- **Package-version and error-format logic is duplicated with divergent
  fallbacks**
  - **Location**: `src/cli/main.ts:181-193` vs `src/mcp/stdio.ts:34-44`;
    `src/cli/main.ts:199-201` vs `src/cli/main.ts:251`
  - **Why it matters**: Two independent `package.json` lookups now exist: the
    CLI checks `pkg.name === 'dev-harness-skills'` and throws, while the MCP
    entry does not check the name and falls back to `0.0.0`. If the package is
    renamed for publication (an open SDD question), only one path is likely to
    be updated. The `error: ...` rendering is also hand-copied in the top-level
    rejection handler.
  - **Fix**: Extract a shared `readPackageVersion(import.meta.url)` helper into
    `src/lib/` with explicit fallback policy, and reuse the existing
    `reportError` formatting in the top-level rejection handler.

- **Help text is a second, hand-maintained copy of the option contract**
  - **Location**: `src/cli/main.ts:62-70`, `95-106`, `147-158` (repeated option
    descriptions) and `src/cli/main.ts:76-79`, `109-112`, `132-135`,
    `160-163` (exit-code block repeated four times)
  - **Why it matters**: `OPTIONS` in `src/cli/args.ts:111-123` is the parser's
    source of truth, but the help text duplicates flag names, applicability,
    and exit codes. Adding or retiring a flag requires synchronized edits in up
    to five places, and drift silently documents flags that the parser rejects.
  - **Fix**: Share the exit-code block as a constant (or interpolate it), and
    consider rendering flag lists from a help metadata table colocated with
    `OPTIONS`.

- **Redundant option state and asymmetric duplicate handling**
  - **Location**: `src/cli/args.ts:129-141` (`InternalOptions` mirrors
    `CommandOptions`), `src/cli/args.ts:143-147` (`provided` duplicates
    seen-option state), `src/cli/args.ts:177-178` vs `src/cli/args.ts:200-204`
  - **Why it matters**: Every new flag requires coordinated edits to the key
    union, `CommandOptions`, `InternalOptions`, `initialOptions`,
    `toCommandOptions`, and `OPTIONS`. Duplicate detection is also
    inconsistent: repeated value options throw, while repeated booleans are
    silently accepted (e.g. `--json --json`).
  - **Fix**: Use one mutable option builder and derive `CommandOptions` and
    `provided` from it, or route all duplicate detection through `provided` so
    value and boolean flags share one rule.

## Suggested Next Steps

- [x] Resolve the `--mcp-package` / `--mcp-source` / `--no-mcp` combinations
      (validation or documented precedence) before sub-task 4.4.
- [x] Add the new invalid-combination cases to `INVALID_CASES`.
- [x] Sanitize argv tokens in usage-error messages.
- [ ] Deduplicate package-version lookup and help/exit-code text.
- [x] Re-run `vitest run src/cli`, `tsc --noEmit`, and Biome after the changes.

## Sub-task 1.2 Review

**Verdict:** Approve — no P0/P1 findings.

- Scope resolution covers `OPENCODE_CONFIG_DIR` → `XDG_CONFIG_HOME` →
  platform home, project path validation, config/target paths, and lexical
  confinement (`isPathWithin` rejects siblings, prefix collisions, and `..`).
- No writes, no network, no secrets; project scope stats only the requested
  directory.
- `Scope` is shared type-only with the parser; `OperationalError` moved to
  `src/cli/errors.ts`, eliminating the runtime cycle and bringing `args.ts`
  back under 300 lines (290).
- Verification: 115 focused tests pass; `tsc --noEmit` and Biome clean.
- Deferred: existing `opencode.json` preference is config-file selection
  (sub-task 3.2), not scope resolution.

## Sub-task 1.3 Review

**Verdict:** Approve — no P0/P1 findings.

- Prompt routing is pure and injectable: explicit scope wins, prompting needs
  both TTYs and permission, non-TTY/`--json` fails with usage exit 2, cancel is
  operational exit 1. Empty input defaults to Project and invalid answers are
  bounded to 3 attempts.
- Output separates human steps (stdout, command-prefixed, ASCII-sanitized) from
  diagnostics (stderr) and emits exactly one JSON envelope in `--json` mode;
  duplicate JSON emission fails operationally.
- No real terminal access in tests; no secrets/env dumps; files are 178/116
  lines.
- Verification: 159 focused tests pass; `tsc --noEmit` and Biome clean.

## Sub-task 2.1 Review

**Verdict:** Approve — no P0/P1 findings.

- Manifest schema v1 captures package/version/source/scope/timestamp/target/
  config key+fingerprint/managed files; reads are typed
  (`missing|valid|corrupt|unsupported`) and never throw for normal states.
- Writes validate first, normalize/confine relative file entries, reject target
  mismatches, and commit atomically via `writeFileAtomic`.
- Future schema versions are distinct from corrupt manifests; unknown fields
  are dropped; file contents/secrets are never printed.
- Verification: 44 manifest tests, 203 `src/cli` tests, full suite 384 pass;
  typecheck and static analysis clean.
- Note: managed file entries use POSIX separators; 2.3 must emit them that way.

## Sub-task 4.4 Review

**Verdict:** Approve — no P0/P1 findings.

- `install --mcp-only` / `uninstall --mcp-only` wire or remove only
  `mcp.servers.dh`, never classify/materialize/delete the plugin or write a
  manifest; dry-run/JSON/force behavior matches the full commands.
- Duplicate-load detection reads the config `plugins` array, recognizes npm
  tags, GitHub shorthand, and Git/GitHub URLs for this repository, and warns
  only when a managed copy would coexist; the array is never edited.
- Status exposes `duplicateLoad`/`pluginEntries` as diagnostics without
  changing its exit-code policy.
- Verification: 19 focused command/plugin-entry tests (463 `src/cli` tests),
  651 full-suite tests pass; typecheck/biome/knip/depcruise clean.

## Sub-task 4.3 Review

**Verdict:** Approve — no P0/P1 findings.

- Uninstall proves ownership via a valid manifest; absent is a no-op, unmanaged
  and symlinked targets are refused even with `--force`, and corrupt manifests
  require `--force` with only exact explicit MCP matches.
- Managed cleanup prefers the manifest fingerprint; missing fingerprint
  (`--no-mcp`) skips config; differing entries are preserved unless forced.
- Config cleanup runs before directory deletion, so a config failure keeps the
  plugin for a safe re-run; invalid JSONC aborts before deletion.
- `--dry-run`/`--json` behavior and exit codes are covered; no symlink
  following.
- Verification: 15 uninstall tests, 402 `src/cli` tests, 590 full-suite tests
  pass; typecheck/biome/knip/depcruise clean.

## Sub-task 4.2 Review

**Verdict:** Approve — no P0/P1 findings.

- Status is read-only, resolves scope (flags or prompt, never JSON), reports
  plugin classification, config path, MCP entry state, drift, and issues.
- JSON envelope is stable and emitted for absent/unmanaged/invalid config;
  exit 0 for managed/corrupt (inspectable drift), 1 for absent/unmanaged or
  invalid/unreadable config.
- Shared scope resolution extracted from install; `status` now accepts
  `--mcp-source`/`--mcp-package` so GitHub-wired installs compare correctly.
- Verification: 16 status tests, 387 `src/cli` tests, 575 full-suite tests
  pass; typecheck/biome/knip/depcruise/declarations clean.

## Sub-task 4.1 Review

**Verdict:** Approve — no P0/P1 findings.

- Install resolves scope (flags or TTY prompt, never JSON), classifies the
  target, plans the MCP merge in memory before any plugin write, stages and
  verifies the plugin, commits atomically, then persists config.
- Invalid JSONC aborts before staging; a differing `dh` entry is preserved with
  a warning unless `--force`; a config write failure leaves the installed plugin
  and returns an actionable re-run hint.
- `--no-mcp`, `--dry-run`, `--json`, `--yes`, and no-op/repair/upgrade actions
  are handled; `--mcp-only` is explicitly deferred to 4.4.
- `install` is wired into the default dispatcher; status/uninstall remain
  explicit not-implemented failures.
- Verification: 14 install tests, 370 `src/cli` tests, 558 full-suite tests
  pass; typecheck/biome/knip/depcruise/declarations clean.

## Sub-task 3.3 Review

**Verdict:** Approve — no P0/P1 findings.

- Canonical entry is source-parameterized (npm default, GitHub override) with
  the pinned protocol and startup timeout; invalid source/package combinations
  are rejected.
- Matching is deep-equality (key-order independent); differing entries are
  preserved with a conflict warning unless `--force`; removal requires an exact
  match (or force) and prunes only emptied `mcp.servers`/`mcp`.
- Fingerprints are canonical sorted JSON for manifest storage; status helper is
  short ASCII without entry contents.
- Verification: 27 MCP-entry tests, 356 `src/cli` tests, 544 full-suite tests
  pass; typecheck/biome/knip/depcruise/declarations clean.

## Sub-task 3.2 Review

**Verdict:** Approve — no P0/P1 findings.

- Config selection prefers existing `.jsonc` → `.json` → new `.jsonc` and
  confines the selected path to the scope root.
- Reads use one fd for content+mode; writes no-op on identical text, back up
  the pre-edit content atomically before changes, preserve modes, create
  parents only inside the scope, and write through dotfile symlinks without
  replacing them.
- Backup failure aborts before touching the config; no contents/secrets in
  errors.
- Verification: 32 config tests, 328 `src/cli` tests, 517 full-suite tests
  pass; typecheck/biome/knip/depcruise clean.
- Note: a symlink inside the scope may intentionally point to a dotfiles
  target outside it; the link is the user-configured path and is preserved.

## Sub-task 3.1 Review

**Verdict:** Approve — no P0/P1 findings.

- Typed JSONC parsing reports offset/line/column; empty/comment-only documents
  are valid empty inputs.
- `setAtPath` preserves comments, trailing commas, indentation, EOL, BOM, and
  performs byte-identical no-ops; missing intermediates are created.
- `removeAtPath` splices object properties to keep sibling comments and
  formatting; `pruneEmptyObjects` removes only listed empty containers.
- Unsafe path segments (`__proto__`, `constructor`, `prototype`) and duplicate
  keys along an edited path are rejected; edits are re-validated.
- Verification: 31 JSONC tests, 297 `src/cli` tests, 485 full-suite tests pass;
  typecheck/biome/knip/depcruise/build clean. `jsonc-parser` added.

## Sub-task 2.4 Review

**Verdict:** Approve — no P0/P1 findings.

- Classification is read-only and covers absent/empty, managed
  current/older/newer, unmanaged, and corrupt (incl. symlink targets and
  non-comparable manifest versions).
- Semver-like comparison handles prerelease/build metadata deterministically;
  malformed versions map to `corrupt` in classification rather than crashing
  status.
- Force policy: unmanaged/corrupt require `--force`; symlinks are always
  refused; downgrade is warning-only; drift reports missing/extra files.
- Verification: 31 install-state tests, 266 `src/cli` tests, 454 full-suite
  tests pass; typecheck/knip/depcruise clean.

## Sub-task 2.3 Review

**Verdict:** Approve — no P0/P1 findings.

- Materializer resolves the package root from both source and dist layouts,
  requires `dist/plugin.js` + `dist/assets`, verifies 7 agents/17 skills, scans
  for bare imports (Node builtins allowed), and imports the staged bundle before
  accepting it.
- Staging layout is self-contained (`index.ts`, package.json, dist bundle,
  assets, manifest); the final target is untouched and staging is cleaned on
  every failure.
- Manifest is built against the final target and rendered into staging without
  weakening `writeManifest` validation; managed paths are POSIX-relative.
- Shared `package-meta` removes the duplicate version lookup; `args.ts` remains
  under 300 lines (290).
- Verification: 235 `src/cli` tests and 423 full-suite tests pass; typecheck,
  knip, depcruise clean. `lint:dup` still has two pre-existing clones in
  `fs-utils.test.ts`, deferred to 6.4.

## Sub-task 2.2 Review

**Verdict:** Approve — no P0/P1 findings.

- Staging is a same-filesystem sibling; swap uses rename + backup with rollback,
  never deletes the previous target on failure, and cleans staging on rejected
  swaps.
- Destructive helpers require absolute paths, refuse filesystem roots, and use
  `lstat` so symlinks are never followed.
- Copy rejects source symlinks/special entries; file modes are preserved via
  `copyFile` + `chmod` (added during review).
- Verification: 19 fs-utils tests + 44 manifest tests pass; typecheck/Biome
  clean. `copyTree` remains non-transactional by design (callers stage).


## Resolution (sub-task 1.1)

- **P2 conflict flags:** rejected `--mcp-package` + `--mcp-source` and
  `--no-mcp` with either MCP source option; added invalid-case tests.
- **P3 argv injection:** added `sanitizeToken` and escaped control/non-ASCII
  tokens in unknown option/command/unexpected-argument messages; added an
  ESC-sequence regression test.
- **P3 duplicate error formatting:** the top-level rejection handler now uses
  `reportError`.
- **Deferred (P3):** shared package-version lookup is intentionally postponed
  to sub-task 2.3/5.2, where package-root resolution and packaging metadata
  are implemented; extracting it now would duplicate that work. Help-text
  deduplication and the mutable-state refactor are deferred as low-impact.
- **Verification after fixes:** `vitest run src/cli/__tests__` (71 tests) +
  `src/mcp/__tests__/stdio.test.ts` (13) pass; `tsc --noEmit` clean; Biome
  clean on changed files.


## Sub-task 5.1 Review

**Verdict:** Approve — no P0/P1 findings.

- `dist/cli.js` is built from `src/cli/main.ts`, carries the shebang, is
  executable, and runs `--help`/`--version`/unknown-command with the expected
  exit codes; importing it has no side effects (main guard).
- `bin` exposes `dev-harness` and `dev-harness-skills` (plus the existing
  `dev-harness-mcp`); `prepare` now treats a missing CLI as an incomplete build.
- `jsonc-parser` is bundled into the CLI (`noExternal`) and the bundle contains
  no bare specifiers, `duckdb`, or MCP SDK imports.
- Existing plugin/MCP bundles and smoke tests remain intact.
- Verification: build artifacts present; 651 tests, typecheck, knip,
  depcruise, Biome, smoke-load, smoke-mcp pass.

## Sub-tasks 6.1-6.4 Review

**Verdict:** Approve — no P0/P1 findings.

- **6.1:** 460+ unit cases cover args, scope, prompt/output, manifest,
  fs primitives, materializer, install state, JSONC, config file, MCP entry,
  plugin entries, and command helpers.
- **6.2:** command integration suites exercise install/status/uninstall and
  mcp-only in isolated HOME/XDG/project/fixture roots; the built-CLI lifecycle
  is covered by `scripts/smoke-install.mjs`.
- **6.3:** smoke-install performs 53 checks (project/global lifecycle,
  idempotency, status JSON, dry-run/no-mcp/mcp-only, non-TTY exit 2, config
  preservation, installed bundle import, no real-HOME writes); wired into
  `qa:check:full` after build.
- **6.4:** `pnpm qa:check:full` passes end-to-end after:
  - removing the two pre-existing jscpd clones in `fs-utils.test.ts`;
  - updating `vitest` 5.0.2 → 5.0.3 and `vite` 8.3.1 → 8.3.3 (OSV cleared:
    no issues);
  - full gate: lint/knip/jscpd/depcruise/links/OSV/semgrep/build/
    smoke-install/smoke-pack/656 tests/typecheck/audit/smoke-load/smoke-mcp.
- Generated `reports/audit.*` and `report/jscpd-report.md` are QA artifacts;
  revert them before the release commit unless intentionally tracked.

## Sub-tasks 7.1-7.3 and 8.1-8.4 Review

**Verdict:** Approve for completed scope; 7.4/8.5 remain blocked on distribution
state.

- **7.1:** derived image pinned to
  `ghcr.io/anomalyco/opencode@sha256:aa0e5ac…` (opencode 2.0.18, Alpine 3.24),
  adds Node/npm/git/ssh/gcompat, runs non-root; image build and toolchain
  smoke pass; no credentials in the image.
- **7.2:** `scripts/docker-test.sh` supports local/remote modes, conditional
  read-only credential mounts, isolated HOME/XDG/OPENCODE/project paths,
  named npm cache, checksum verification, and cleanup.
- **7.3:** `--local` passes install/status/import/manifest/config assertions;
  `setup(stub)` registers 7 agents/17 skills; `debug agents` limitation
  recorded. `--remote` not run (branch not pushed; `develop` predates the
  installer).
- **8.1-8.3:** README/LOADING/AGENTS now document npx (npm/Git), opencode
  plugin add + `--mcp-only`, scope paths, flags, status/uninstall, Docker
  test, package entrypoints, and the release runbook.
- **8.4:** `pnpm qa:check:full` passes (656 tests; smokes; OSV cleared);
  tarball install/import/bins pass; Docker local passes.
- **Blocked:** npm publication/post-publish npm-spec verification (8.5) and
  Git `opencode plugin add` (7.4, bundled-npm `git dep preparation failed`).
  Do not mark Phase 7/8 or the plan complete until resolved/deferred by the
  user.
