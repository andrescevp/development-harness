# Code Review Summary — Phase 4a (Sub-Tasks 4.1–4.2)

**Scope**: Sub-Task 4.1 (workspace-first guidance in the five bundled agents) and
Sub-Task 4.2 (monorepo fixtures/tests and the full QA gate) of
[`plan.md`](../plan.md), against [`sdd.md`](../sdd.md) (R8, AC7, AC8) and the
normative [`workspace-contract.md`](../workspace-contract.md) (§4, §8, §10).

Reviewed files:

- `agents/dh-software-architect.md`, `agents/dh-software-engineer.md`,
  `agents/dh-reviewer.md`, `agents/dh-final-reviewer.md`,
  `agents/dh-documentor.md`
- `src/__tests__/workspace-agents.test.ts`
- `src/__tests__/workspace-monorepo-fixtures.test.ts`
- `src/__tests__/fixtures/workspaces/**` (cargo, go, npm, nx, pnpm, submodules, turbo)
- Cross-checked: `skills/dh-setup/references/workspace-map.md`,
  `src/__tests__/workspace-anchor.test.ts`,
  `src/__tests__/workspace-plan-contract.test.ts`,
  `src/__tests__/workspace-gates-scope-rules.test.ts`,
  `src/__tests__/workspace-docs-graph-version-worktree.test.ts`

**Overall risk**: Low
**Verdict**: Approve with comments

No P0/P1 findings. Both sub-tasks meet their acceptance criteria: every agent
carries a role-tailored `## Workspace First` directive with a standalone
fallback and a workspace-root-only plan rule, and the seven layout fixtures are
text-only, deterministic, machine-independent today, and backed by a gate that
re-runs green. The remaining findings are test-guard strength and fixture/bookkeeping
accuracy, not behavior defects.

## Verification matrix

### Sub-Task 4.1 — workspace-first agent guidance

| Check | Result | Evidence |
|---|---|---|
| Every agent has a `## Workspace First` section (exactly one) | **Pass** | All five agents; enforced by `workspace-agents.test.ts:82-85` (`5×1` cases) |
| Reads `WORKSPACE.md` at root, else `docs/WORKSPACE.md` | **Pass** | All five agents; enforced by `workspace-agents.test.ts:54-76` |
| Affected packages from `## Workspace Impact`, never from cwd | **Pass** | Bullet in every agent; `never infer` asserted by the shared directive |
| Package-scoped behavior | **Pass** | engineer package-scoped commands; reviewer `git diff -- <paths>` + package labels; final reviewer per-package evidence + "unaffected"; documentor `{package}/docs` + `package: <name>`; architect package boundaries/ADRs |
| Standalone fallback unchanged | **Pass** | "No map and no workspace marker means standalone: the single root is workspace, package and plan root" in all five |
| No package-local `docs/plans` | **Pass** | Explicit in all five directives |
| Role-specific lines are appropriate | **Pass** | Role needles asserted per agent (`workspace-agents.test.ts:26-52,78-80`); only a low-value ambiguity in the documentor (P3-1) |
| Agent files < 300 lines | **Pass** | 97 / 52 / 49 / 96 / 116 lines; asserted via `contentLines` (`workspace-agents.test.ts:87-96`) |
| Map reference link resolves | **Pass** | `../skills/dh-setup/references/workspace-map.md` exists; asserted at `workspace-agents.test.ts:75`; ships in `dist/assets` after build |
| Roster/frontmatter unchanged | **Pass** | Only body content changed; exactly five agents asserted |

### Sub-Task 4.2 — fixtures, tests and QA gate

| Check | Result | Evidence |
|---|---|---|
| Fixtures for pnpm / npm / Nx / Turbo / Cargo / Go / submodules | **Pass** | 7 layout dirs under `src/__tests__/fixtures/workspaces/`, each with markers, package roots and an expected `WORKSPACE.md` |
| Marker assertions | **Pass** | `DETECTION_MARKERS` (10 markers) checked in both the setup skill and the map reference |
| Map shape matches the template | **Pass** | `templateSections()` derives the 7 sections from `workspace-map.md` and every fixture map is asserted |
| Fixtures machine-independent today | **Pass** | No absolute paths found (`grep` over the fixture tree); guard exists — but weak (P2-1) |
| No brittle absolute paths in tests | **Pass** | `REPO_ROOT`-relative helpers only |
| Tests deterministic / text-only | **Pass** | Filesystem and string reads; no package manager, git, network or timestamps |
| R1–R9 coverage mapping | **Partial (P2-2)** | Each R maps to an existing file with real tests, but the mapping assertion itself is string-presence only and R2 is self-referential |
| Legacy/behavioral suite | **Pass** | `npx vitest run` → 53 files / 937 tests pass |
| `pnpm qa:check:full` green | **Pass with an environment caveat (P3-4)** | Re-ran every component: test, typecheck, biome, links, knip, jscpd, depcruise, build, smokes, docker scans, audit report PASS |

Commands re-run in this review (all green unless noted):

- `npx vitest run` → 53 files / 937 tests passed (the two scoped files: 63 tests)
- `npx tsc --noEmit` → 0 errors
- `npx biome check src/` → 104 files, no fixes
- `node scripts/check-links.mjs` → 215 references, no dead links
- `npx knip`, `npx jscpd`, `npx depcruise` → clean (0 clones, 0 dependency violations)
- `npm run build` → OK; `copy-assets` reports "agents 5 | skills 26"; built
  `dist/assets/agents/*.md` each contain `Workspace First` and the built
  `dist/assets/skills/dh-setup/references/workspace-map.md` exists
- `smoke-load`, `smoke-mcp`, `smoke-install` → OK; `smoke-pack` → OK **only**
  when a real node precedes the `~/.local/bin/node` shim in `PATH` (see P3-4)
- docker `scan:deps` (OSV) → no issues; `scan:code` (Semgrep) → 90 rules, 0 findings
- `reports/audit.md` (generated `2026-11-10T23:35:29Z`, not re-run to avoid
  rewriting the committed report) → **PASS**, 0 FAIL, size limits PASS (agents
  < 300, SKILL.md < 250)

Secrets: none found in the changed agents, tests or fixtures (audit secret scan
PASS, 0 high-signature hits; local signature grep also clean).

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

- **Machine-independence guard has blind spots**
  - **Location**: `src/__tests__/workspace-monorepo-fixtures.test.ts:195-202`
  - **Why it matters**: this is the only enforcement of 4.2's "no
    machine-specific paths baked into fixtures" caution. It can pass while a
    machine path is present, so the fixture contract can silently rot.
  - **Evidence**: the POSIX branch requires `^` or whitespace before
    `/home|/Users|/tmp`, so a path in the fixture's natural markdown form,
    `` `/home/andres/repo` ``, does not match (verified with the exact regex:
    `posix: false`). `C:/Users/andres/repo` also escapes both branches
    (`[A-Za-z]:\\` needs a backslash), and `/root`, `/opt`, `/var` are not
    covered at all.
  - **Fix**: normalize markdown quoting before matching (allow a preceding
    backtick/quote, e.g. `[\s`"'(=]`), add `/\b[A-Za-z]:[\\/]/`, and add a
    meta-test proving a backticked sample is detected.

- **R1–R9 coverage map proves strings, not coverage**
  - **Location**: `src/__tests__/workspace-monorepo-fixtures.test.ts:205-247`
  - **Why it matters**: the mapping is the guard for "each R has at least one
    test or structural assertion". It would stay green after the underlying
    assertions were deleted, giving false confidence that a requirement is
    still covered.
  - **Evidence**: per requirement it only asserts the mapped file exists,
    contains the `R#` token, one needle, and `'it('` — which every test file
    contains. R2 maps to its own file and its needle `pnpm-workspace.yaml` lives
    in the `DETECTION_MARKERS` constant (`:111-122`), so removing the entire
    "layout fixtures" describe block (`:164-203`) leaves R2 green. R7's needle
    `'## Version policy'` (`workspace-docs-graph-version-worktree.test.ts:125`)
    proves only semver although R7 also spans graph routing, worktree discovery,
    pause/resume and domain mapping.
  - **Fix**: assert a distinctive behavioral token per requirement (a `describe`
    title, an exported case array, or an `it` title) instead of `'it('`; drop
    the self-mapping; give R7 needles that represent the graph/worktree/pause
    blocks (or one entry per R7 aspect).

### [P3] Low

- **Documentor directive assumes an active plan**
  - **Location**: `agents/dh-documentor.md:24-38`, duplicated rule at
    `agents/dh-documentor.md:60-67`
  - **Why it matters**: the documentor owns all generated docs and is routinely
    invoked outside a plan, but its only package-scope instruction points at
    "the plan's `## Workspace Impact`"; `dh-create-documentation` never mentions
    that section. With no plan, the agent has no defined fallback and the bullet
    forbids the cwd, so ad-hoc docs can stall or guess. Rule 5 restates the
    section, creating two sources of truth.
  - **Fix**: add "when no plan is active, take the package from the user's
    request or the map's package roots", and fold rule 5 into a pointer to the
    Workspace First section.

- **Fixture map commands do not match their own manifests**
  - **Location**: `src/__tests__/fixtures/workspaces/pnpm/WORKSPACE.md:13-14`,
    `src/__tests__/fixtures/workspaces/turbo/WORKSPACE.md:13`
  - **Why it matters**: low — fixtures are never executed — but the "expected
    map" is the reference the tests bless.
  - **Evidence**: the maps document `pnpm --filter web|core|dashboard …` while
    the packages are named `@fixture/web`, `@fixture/core`,
    `@fixture/dashboard`; no fixture `package.json` declares `scripts` and no Nx
    `project.json` declares `targets`, so none of the documented commands can run
    against the fixture tree.
  - **Fix**: use the real package names in the filters
    (`--filter @fixture/web`) and add minimal `scripts`/`targets`, or mark the
    commands as illustrative.

- **No worktree-lifecycle fixture for the submodule layout**
  - **Location**: `src/__tests__/fixtures/workspaces/submodules/**`,
    `src/__tests__/workspace-docs-graph-version-worktree.test.ts:163-188`
  - **Why it matters**: 3.4's testing suggestion was "a fixture with two
    submodule lifecycle files"; discovery/alignment is currently asserted only
    through prose in the reference, not against a real tree.
  - **Fix**: add `WORKTREE_LIFECYCLE.md` at the fixture root and in
    `packages/engine`/`packages/ui` and assert the documented discovery order
    from those files.

- **Gate is environment-sensitive: `smoke-pack` needs a real `node` first in PATH**
  - **Location**: `scripts/lib/pack-install.mjs:150-180` (pre-existing script,
    not changed by 4.1/4.2)
  - **Why it matters**: with the default session PATH, `node` resolves to
    `~/.local/bin/node` → `node-shim`, which fails under the smoke's isolated
    `HOME` ("no nvm install provides 'node'"); the packed MCP check therefore
    fails even though the package is fine.
  - **Evidence**: `node scripts/smoke-pack.mjs` → 1 FAIL
    (`installed MCP bin lists the 12 harness tools`); re-run with
    `~/.nvm/versions/node/v24.18.0/bin` prefixed → OK. Assets checks passed in
    both runs.
  - **Fix**: none required in this change; record the required PATH (or the
    Docker test image) in the sub-task completion notes so `pnpm qa:check:full`
    is reproducible.

## Process notes

- Plan bookkeeping is still open by design: 4.1 is `In Progress` and 4.2 is
  `Pending` in `plan.md` although both deliverables exist; statuses should be
  set after this review (not changed here).
- `reports/audit.{json,md}` are modified by the gate run; the report shows
  PASS and size limits PASS, so the agent line limits are also covered by the
  audit surface.

## Suggested Next Steps

- [ ] No P0/P1 to fix before this sub-task's sign-off
- [ ] Address P2-1 and P2-2 (fixture guard and coverage-map strength) or record
      an explicit deferral
- [ ] Optionally resolve the P3 fixture/documentor accuracy items
- [ ] Mark 4.1/4.2 `Completed` after the P2 decision; note the `smoke-pack`
      PATH requirement in the completion record

## P2/P3 resolution (orchestrator, 2026-11-10)

- **P2-1 machine-independence:** the guard now matches `/home`, `/Users`, `/tmp` anywhere (including inside backticks) and `C:/`/`C:\` paths; the fixture set is rechecked.
- **P2-2 R2 coverage:** the R2 entry now pins `it.each(LAYOUTS)` in the fixture test, not a marker string, so deleting the layout assertions fails the coverage check.
- **P3:** submodule fixtures now include the two package `WORKTREE_LIFECYCLE.md` files; the remaining P3s (documentor duplication, fixture filter labels, PATH note) are deferred to the docs pass.
