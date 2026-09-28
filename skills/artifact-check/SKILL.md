---
name: artifact-check
description: >
  Compile final production builds and validate deployment scripts against
  established contingency plans: detect the build system, run the production
  build, verify build artifacts exist and are non-empty, validate deploy
  script syntax and basic correctness, and produce a build readiness report.
  Use when preparing a release, smoke-testing the deployment path before
  shipping (invoked by /release as step 4), or when the user asks "validate
  build", "check artifacts", "does it build?", "validate the artifact",
  "is the build clean?", or "verify deployment readiness".
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: development
---

## Core Rules

- Use the `@executor` subagent to run all commands — never run bash directly
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

## Output Template

```markdown
# Artifact Check Report

## Build
| Check | Result | Details |
|---|---|---|
| Build system | Docker / pip / npm / cargo / go | [command used] |
| Build result | ✅ Pass / ❌ Fail | [output summary] |
| Artifact exists | ✅ Pass / ❌ Fail | `path/to/artifact` (size) |

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
