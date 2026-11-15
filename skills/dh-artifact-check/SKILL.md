---
name: dh-artifact-check
description: >
  Compile production builds and validate deployment scripts: detect build system, run build, verify artifacts exist/non-empty, check deploy script syntax. Use to validate build, check artifacts, verify deployment readiness, or smoke-test.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: development
---

## Core Rules

- Use the `dh-execute-cli` skill to run all commands — never run bash directly
- Detect the build system automatically:
  - **Docker:** `docker build` or `docker compose build`
  - **Python:** `uv build` or `python -m build`
  - **JavaScript/TypeScript:** `npm run build` / `pnpm build`
  - **Rust:** `cargo build --release`
  - **Go:** `go build ./...`
  - **Make:** `make build` or `make`
- Verify the build artifact exists and has non-zero size
- If a `Dockerfile` exists: verify it builds, check for `.dockerignore`
- If deployment scripts exist (e.g., `deploy.sh`, `scripts/deploy*.sh`):
  - Run `shellcheck` on shell scripts
  - Check for syntax errors in other script types
  - Verify required environment variables are documented
- Cross-reference `./docs/plans/<plan-slug>/contingency.md` if it exists for planned deployment paths
- Report each check independently; aggregate into a single pass/fail

## Workspace-Aware Builds

- Read `## Workspace Impact` from the active plan and the workspace map
  (`WORKSPACE.md`); build each affected package with its mapped command, or run
  the workspace aggregate when the change is workspace-wide. Patterns and
  selection rules: [`../dh-preflight/references/workspace-gates.md`](../dh-preflight/references/workspace-gates.md).
- Verify the artifact of **each** affected package (existence + non-zero size);
  report a row per package as pass / fail / skipped.
- Never report green for a package whose build did not run: a skipped package
  keeps its recorded reason, and a green aggregate does not cover it.
- A package in `## Workspace Impact` with no map row, no build command, or a
  missing path is `unknown package` → **FAIL**, never skipped.
- **Standalone** (no map, no affected packages): keep the single-root behavior
  and single-table report below unchanged.

## Output Template

```markdown
# Artifact Check Report

## Build
| Check | Result | Details |
|---|---|---|
| Build system | Docker / pip / npm / cargo / go | [command used] |
| Build result | ✅ Pass / ❌ Fail | [output summary] |
| Artifact exists | ✅ Pass / ❌ Fail | `path/to/artifact` (size) |

## Package Builds (workspace only)
| Package | Build command | Result | Artifact |
|---|---|---|---|
| `apps/web` | `pnpm --filter web build` | ✅ Pass / ❌ Fail / ⏭️ Skipped | `apps/web/dist` (size or reason) |

## Deployment Validation
| Check | Result | Details |
|---|---|---|
| Deploy scripts found | ✅ / ⚠️ None | [paths] |
| Script syntax | ✅ Pass / ❌ Fail / ⏭️ Skipped | [issues] |
| Env vars documented | ✅ / ⚠️ Missing | [missing vars] |

## Contingency Alignment
| Contingency Plan | Status | Note |
|---|---|---|
| [Plan name] | ✅ Aligned / ⚠️ Drift | [explanation] |

**Verdict:** ✅ READY / ❌ BLOCKED — [N] failure(s)
```

## Safety

- Do not push build artifacts or deploy to any environment
- Do not install build tools system-wide
- If no build system is detected, report it — do not guess
- Do not run deployment scripts — validate them statically only

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
