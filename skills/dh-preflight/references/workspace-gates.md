# Workspace gates — package-aware preflight and artifact checks

`dh-preflight` and `dh-artifact-check` validate the packages a plan declares in
`## Workspace Impact`, using the per-package commands recorded in the workspace
map (see [`workspace-map.md`](../../dh-setup/references/workspace-map.md)). A
standalone repository has no map and no affected packages: it keeps the current
single-root behavior — one toolchain, one command set, one report row.

## Inputs

| Input | Used for |
|---|---|
| `## Workspace Impact` in `plan.md` | The affected packages (declared, never inferred from the cwd) and their test/build commands |
| `WORKSPACE.md` or `docs/WORKSPACE.md` | Authoritative per-package commands, the aggregate commands and the affected-only command |
| Package manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`) | Fallback command source and drift check against the map |

Read order: plan section → map → manifests. A workspace plan without
`## Workspace Impact` is a hard stop — ask which packages are affected; never
assume "all packages". When the map and a manifest disagree, run the manifest's
command, report the drift and flag the map row as stale.

## Affected vs aggregate selection

| Condition | What to run | What to report |
|---|---|---|
| `## Workspace Impact` lists packages with commands | Those package commands (affected mode) | One row per package |
| The change is workspace-wide (root config, shared dependency bump) and the map records an aggregate | The aggregate command **and** each affected package command, unless the map proves them equivalent | Aggregate row + package rows |
| The map records a package command as `none` | Nothing for that package | `⏭️ Skipped` plus the recorded reason |
| No `## Workspace Impact` and no map (standalone) | Today's single-root detection | One row per tool, as before |

Affected mode is the default: it is cheaper and it isolates failures. The
aggregate never replaces a package row — a green aggregate is not evidence that
an unvalidated package is green.

Run every command from the workspace root so `--filter` / `--workspace` / `-p`
resolve the same projects the map names. Do not `cd` into a package for a
workspace-aware command; a directory-scoped tool (Cargo, Go module, Gradle
subproject) is addressed with its own selector instead.

## Command patterns

| Layout | Per package (affected) | Aggregate | Detect by |
|---|---|---|---|
| pnpm workspace | `pnpm --filter <pkg> test` | `pnpm -r test` / `pnpm -r --if-present run build` | `pnpm-workspace.yaml` with a `packages:` key |
| npm workspaces | `npm test --workspace <pkg>` | `npm test --workspaces` | `package.json#workspaces` |
| yarn workspaces | `yarn workspace <pkg> test` | `yarn workspaces run test` | `package.json#workspaces` + `yarn.lock` |
| Nx | `nx test <project>` | `nx run-many -t test`; affected: `nx affected -t test --base=<base> --head=HEAD` | `nx.json` |
| Turborepo | `turbo run test --filter=<pkg>` | `turbo run test`; affected: add `--filter='...[<base>]'` | `turbo.json` |
| Lerna | `lerna run test --scope <pkg>` | `lerna run test` | `lerna.json` |
| Cargo workspace | `cargo test -p <crate>` | `cargo test --workspace` | `[workspace]` in `Cargo.toml` |
| Go work / module | `go test <module>/...` from the module root | per-module runs (a `go.work` file does not give one test command for all modules) | `go.work` |
| Gradle multi-project | `./gradlew :<project>:test` | `./gradlew test` | `settings.gradle` / `settings.gradle.kts` |
| .NET solution | `dotnet test <project>.csproj` | `dotnet test <solution>.sln` | `*.sln` |
| Submodules / nested repos | `(cd <pkg> && <its own command>)` | none — each repo has its own toolchain | `.gitmodules` or the map only |

`pnpm -r` does not exist for npm/yarn workspaces. A `--filter` / `--workspace`
name is the `package.json#name`, not the directory; take both from the map row
and never guess. Build commands may legitimately be `none` for a docs-only
package — record it, do not invent one.

## Unknown packages, skipped packages and false green

| Case | Verdict | Required output |
|---|---|---|
| A package in `## Workspace Impact` has no map row | ❌ **FAIL — unknown package** | Name the package and the map file; do not skip it |
| The named path does not exist on disk | ❌ **FAIL — unknown package** | Same; a typo must not silently disable a gate |
| The map records `none` with a reason and the plan agrees | ⏭️ Skipped | The recorded reason, verbatim |
| The command could not run (tool missing, offline, no lockfile) | ⏭️ Skipped | The tool, the error and the words "not validated" |
| A package command failed | ❌ Fail | `path:line` and the error message |
| The aggregate passed but a package command did not run | ❌ Not green | List every unvalidated package |

Hard rule: **never report green for a package whose own command did not run.**
A skipped package is not a pass; the verdict stays BLOCKED until every affected
package is validated or the plan records an explicit deferral (which the report
quotes). `dh-artifact-check` applies the same rule to builds and artifacts: a
package whose build did not run has no artifact verdict.

## Report shape

```markdown
## Package Gates
| Package | Command | Result | Details |
|---|---|---|---|
| `apps/web` | `pnpm --filter web test` | ✅ Pass | 48 passed |
| `services/api` | `uv run pytest` | ❌ Fail | tests/test_orders.py:31 — assertion |
| `packages/core` | — | ⏭️ Skipped | map records `none` (generated package) |

Affected: 3 · validated: 1 · failed: 1 · skipped with reason: 1 → **not green**
```

The verdict line follows the table; a ✅ READY / green verdict requires every
affected package to be validated (pass) or explicitly deferred by the plan.

## Standalone fallback

No map and no affected packages: detect one toolchain, run the commands in the
skill's Core Rules, and keep the existing single-table report. Never require a
standalone repository to add a map or a `## Workspace Impact` section.

## Validation checklist

- [ ] `## Workspace Impact` was read; a missing section on a workspace plan
      stopped the run instead of defaulting to all packages.
- [ ] Every affected package has a map row (path + command) or is reported as
      `unknown package` → FAIL.
- [ ] Affected-vs-aggregate selection is stated, with the reason.
- [ ] Each package has its own row with pass / fail / skipped and a skipped
      reason.
- [ ] No green verdict while any affected package is unvalidated.
- [ ] The drift between map commands and package manifests is reported.
- [ ] Commands ran from the workspace root; no `cd` into a package for a
      workspace-aware command.
- [ ] Standalone repositories kept the single-root behavior.
