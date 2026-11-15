# Code Review Summary — Phase 2b (Sub-Tasks 2.2–2.4)

**Scope**: Sub-Tasks 2.2 (package-aware `dh-preflight`/`dh-artifact-check`), 2.3 (scoped `dh-review`/`dh-code-review`/`dh-simplify`/`dh-final-review` diffs) and 2.4 (root/package `CODE_RULES.md` inheritance) of [`plan.md`](../plan.md), against [`sdd.md`](../sdd.md) (R4, R5, R6; AC4–AC6) and [`workspace-contract.md`](../workspace-contract.md).

Reviewed files:

- `skills/dh-preflight/SKILL.md`, `skills/dh-artifact-check/SKILL.md`
- `skills/dh-review/SKILL.md`, `skills/dh-code-review/SKILL.md`, `skills/dh-simplify/SKILL.md`, `skills/dh-final-review/SKILL.md`
- `skills/dh-coding/SKILL.md`, `skills/dh-code-ruler/SKILL.md`
- `skills/dh-preflight/references/workspace-gates.md`, `skills/dh-review/references/workspace-diff-scope.md`, `skills/dh-coding/references/code-rules-resolution.md`
- `src/__tests__/workspace-gates-scope-rules.test.ts`

**Overall risk**: Medium
**Verdict**: Approve with comments

No P0/P1 findings. The package-aware gates, the scoped-review contract and the rules
inheritance are documented, linked and structurally tested; the remaining findings are
two medium-risk gaps in the delivered instructions plus low-impact consistency/test
items.

## Verification matrix

### Sub-Task 2.2 — package-aware gates

| Check | Result | Evidence |
|---|---|---|
| Affected-vs-aggregate selection | **Pass** | `workspace-gates.md:22-33` (affected is default; aggregate only for workspace-wide; aggregate never replaces a package row); `dh-preflight/SKILL.md:36-41` |
| Per-package reporting | **Pass** | `dh-preflight/SKILL.md:63-66`; `dh-artifact-check/SKILL.md:59-62`; report shape `workspace-gates.md:78-92` |
| No green for an unvalidated package | **Pass** | `workspace-gates.md:72-76`; `dh-preflight/SKILL.md:39-41`; `dh-artifact-check/SKILL.md:40-41` |
| Unknown package fails, never skipped | **Pass with caveat (P3-2)** | `workspace-gates.md:63-70`; `dh-preflight/SKILL.md:42-43`; `dh-artifact-check/SKILL.md:42-43` |
| Command patterns for the supported workspaces | **Pass with caveats (P3-5)** | pnpm/npm/yarn/Nx/Turbo/Lerna/Cargo/Go/Gradle/.NET/submodules at `workspace-gates.md:40-59` |
| Standalone fallback | **Pass** | `workspace-gates.md:94-98`; `dh-preflight/SKILL.md:46-47`; `dh-artifact-check/SKILL.md:44-45` |
| Map discovery (`WORKSPACE.md` vs `docs/WORKSPACE.md`) | **Caveat (P3-1)** | Skills name only root `WORKSPACE.md`; the references accept the fallback |

### Sub-Task 2.3 — scoped review/simplify/final-review

| Check | Result | Evidence |
|---|---|---|
| Path derivation includes root/shared paths | **Partial (P2-2)** | `workspace-diff-scope.md:10-35` defines `∪ shared_paths`, but `## Workspace Impact` has no field to declare them |
| Scoped `git diff -- <paths>` | **Pass with caveat (P2-1)** | `workspace-diff-scope.md:37-65`; all four skills use the pathspec |
| Package labels in findings | **Pass** | `workspace-diff-scope.md:81-94`; `dh-review:154`; `dh-code-review:71,81`; `dh-simplify:43`; `dh-final-review:129-137` |
| Untouched packages reported | **Pass** | `workspace-diff-scope.md:76,138`; `dh-review:186-187`; `dh-final-review:134-137` |
| Final-review full diff equals declared scope | **Pass** | `dh-final-review:21,61` — "full" = affected packages + declared root/shared files |
| Standalone keeps the full diff | **Pass** | `dh-review:20`; `dh-code-review:18`; `dh-simplify:19`; `dh-final-review:21`; `workspace-diff-scope.md:64-65` |
| Two-package fixture demonstrates exclusion | **Partial (P3-3)** | A prose example only (`workspace-diff-scope.md:96-126`); the test asserts headings/names, not the exclusion outcome |

### Sub-Task 2.4 — root/package `CODE_RULES` inheritance

| Check | Result | Evidence |
|---|---|---|
| Package-first, root-for-shared precedence | **Pass** | `code-rules-resolution.md:9-23`; `dh-coding/SKILL.md:18,33-41` |
| Conflict reporting instead of silent merge | **Pass with caveat (P3-6)** | `code-rules-resolution.md:55-64`; `dh-coding/SKILL.md:44-46` |
| Package discovery | **Pass with caveat (P3-1)** | `code-rules-resolution.md:25-42` (map `Path` column, longest prefix); `dh-code-ruler/SKILL.md:36-42` |
| Resolved-file reporting | **Pass** | `code-rules-resolution.md:44-53`; `dh-coding/SKILL.md:42-43` |
| Standalone unchanged (one root file) | **Pass** | `code-rules-resolution.md:19,53,83`; `dh-coding/SKILL.md:34-35`; `dh-code-ruler/SKILL.md:124-125` |

### Cross-cutting

| Check | Result | Evidence |
|---|---|---|
| Tests meaningful and deterministic | **Pass with caveat (P3-3, P3-4)** | Static file reads only; 30/30 passed; no time/network dependency |
| Skills under 250 lines | **Pass** | Changed skills max 209; bundle max 248 (`dh-setup`); enforced by the new test |
| Links resolve | **Pass** | `pnpm lint:links` → 186 references before this report, 189 with it; no dead references |
| No unrelated changes | **Pass** | The 2.2–2.4 edits stay in their declared files; the working tree also carries prior sub-task work (see Scope note) |
| Secrets/credentials in the diff | **Pass** | None found |

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

1. **Scoped diff commands only cover committed history — in-progress work can disappear from review**
   - **Location**: `skills/dh-simplify/SKILL.md:19`; `skills/dh-review/SKILL.md:125-132`; `skills/dh-final-review/SKILL.md:21,61`; `skills/dh-review/references/workspace-diff-scope.md:37-65`
   - **Why it matters**: the only scoped patch command documented is `git diff <base>...HEAD -- <paths>`. The harness implements and reviews sub-tasks before committing (there is no per-sub-task commit step in `dh-execute-plan-task`), so a simplifier or reviewer following the new instruction can receive an empty or partial diff and still approve/report. The reference lists `git status --porcelain -- <paths>` for uncommitted work, but that is a file list, not the patch `dh-simplify` must pass to its three agents.
   - **Evidence**: in this working tree `git status --porcelain` lists 32 entries (22 modified, 10 untracked), while `git diff main...HEAD -- skills/dh-review/references/workspace-diff-scope.md` and the same command for `workspace-gates.md` both return zero lines — the new reference files are untracked. A scoped `<base>...HEAD` review of this very phase would not see the deliverables.
   - **Fix**: add the working-tree variants to the reference and the four skills: `git diff -- <paths>` (unstaged), `git diff HEAD -- <paths>` (all working-tree changes), `git status --porcelain -- <paths>` (file list); state that `<base>...HEAD` is for committed branch/PR reviews only. `dh-simplify` should default to `git diff HEAD -- <paths>`; `dh-review`/`dh-final-review` should use the working-tree form when the plan is not committed.

2. **`shared_paths(plan)` has no declared source in `## Workspace Impact`**
   - **Location**: `skills/dh-review/references/workspace-diff-scope.md:3-6,10-13,22-33,78-79`; `skills/dh-final-review/SKILL.md:21,61`; `skills/dh-planning/references/phased-plan-template.md:69-76`; `src/tools/plan-template.ts:82-89`
   - **Why it matters**: the reference opens by saying reviews cover "the paths a plan declares in `## Workspace Impact`", and the formula unions `affected_packages ∪ shared_paths`; but `## Workspace Impact` only carries `Workspace root`, `Affected packages` and the per-package table — there is no field for root/shared paths. Step 4 then treats a root/shared change that is not "in the plan" as an out-of-scope finding. A monorepo plan that also changes root config/docs (the exact case 2.3's cautionary names: `pnpm-workspace.yaml`, root lockfile, `AGENTS.md`) has nowhere canonical to declare it, so reviewers must infer from prose or flag a legitimate change.
   - **Evidence**: `grep -i shared` over the plan template, SDD template and `src/tools/plan-template.ts` finds no shared-path field; the template's `## Workspace Impact` is exactly the three items above. The 2.3 plan cautionary (`plan.md:326-329`) requires root-level files to be included explicitly, but the 2.1 template gives no slot for them.
   - **Fix**: add `- **Shared/root paths:** <paths or None>` to `## Workspace Impact` in the template and the scaffold (a small 2.1 follow-up), or state in this reference that shared paths are read from `## Scope` and the sub-task `In Scope for This Sub-Task` fields, and use that rule in the checklist.

### [P3] Low

1. **The `docs/WORKSPACE.md` fallback is missing from the gate and rule skills**
   - **Location**: `skills/dh-preflight/SKILL.md:31-32`; `skills/dh-artifact-check/SKILL.md:34-35`; `skills/dh-coding/SKILL.md:33`; `skills/dh-code-ruler/SKILL.md:40,122` — versus `skills/dh-setup/references/workspace-map.md:3-10`, `workspace-gates.md:14`, `code-rules-resolution.md:27`
   - **Why it matters**: `dh-setup` may legitimately write the map at `docs/WORKSPACE.md` (interview item 12), and the references accept it, but the four skills name only root `WORKSPACE.md`. In such a workspace the gates cannot find the map: the safe reading classifies every affected package as `unknown package` (blocked), while a reader who treats "no map" as standalone can run the single-root gate and hide the packages behind a green result; `dh-coding`/`dh-code-ruler` silently fall back to root rules and skip package overrides. This is the same class as the phase-2a P3-1 map-discovery inconsistency, now in the gate/rule skills.
   - **Fix**: use one phrasing everywhere: "`WORKSPACE.md`, else `docs/WORKSPACE.md`".

2. **`none` is both "legitimately skipped" and "unknown package → FAIL"**
   - **Location**: `skills/dh-preflight/SKILL.md:42-43`; `skills/dh-artifact-check/SKILL.md:42-43`; `workspace-gates.md:28,59,63-68,104-105`
   - **Why it matters**: the reference says a `none` command is legitimate for a docs-only package ("record it, do not invent one") and maps it to `⏭️ Skipped` with a reason; both skills and the reference checklist call a package with "no command" an `unknown package → FAIL`. A docs-only package is therefore either FAIL or Skipped depending on which line the agent reads.
   - **Fix**: define "no command" as "no map row or a blank command cell"; state that an explicit `none` with a reason is `Skipped` (still not green without a plan deferral).

3. **The 2.3 acceptance fixture is demonstrated in prose only**
   - **Location**: `src/__tests__/workspace-gates-scope-rules.test.ts:130-151`; `skills/dh-review/references/workspace-diff-scope.md:96-126`
   - **Why it matters**: 2.3's acceptance criterion is "a two-package fixture demonstrates that unrelated changes are excluded". The repository has a prose example, and the test asserts only the `## Two-package example` heading and the `apps/web`/`services/api` strings — it does not assert the union formula's `shared_paths` term, the excluded `services/api` outcome, or a real two-package diff. The 2.2 "fixture plan with two affected packages" and 2.4 "fixture with root + package rules" are likewise absent (both are testing suggestions, but 4.2 will need them).
   - **Fix**: add the fixtures in 4.2 (as plan 4.2 already requires) and strengthen this test to assert `paths = affected_packages(plan) ∪ shared_paths(plan)` and the example's "`services/api` — unaffected, not reviewed" line; or explicitly record the deferral in the sub-task.

4. **The 250-line test has an off-by-one (rejects a 249-line skill)**
   - **Location**: `src/__tests__/workspace-gates-scope-rules.test.ts:215-221`
   - **Why it matters**: `read(file).split('\n').length` counts the trailing newline, so a 249-line `SKILL.md` (documented limit: `< 250`) yields 250 and fails the assertion. The current maximum is 248, so it is latent, but the next one-line growth of `dh-setup` (248 today) would fail for a compliant file.
   - **Fix**: count content lines, e.g. `read(file).replace(/\n$/, '').split('\n').length`, or assert `match(/\n/g)` count `< 250`.

5. **The command table contradicts its "run from the workspace root" rule and omits Yarn Berry**
   - **Location**: `skills/dh-preflight/references/workspace-gates.md:35-38,46,51,54`
   - **Why it matters**: the blanket "run every command from the workspace root" conflicts with the Go row ("from the module root") and the submodule row (`(cd <pkg> && <its own command>)`). The Yarn row uses the Yarn 1 aggregate `yarn workspaces run test`; Yarn 2+ (Berry) uses `yarn workspaces foreach run test`, and the detection hint (`.yarnrc.yml`) is absent. An agent following the table literally can run a command from the wrong directory or fail a supported Yarn workspace.
   - **Fix**: state the explicit exceptions ("directory-scoped invocations — Go module, submodule — use `(cd <pkg> && ...)`/`go -C`; every workspace-aware command runs from the root") and add the Yarn 1/Berry detection and aggregate variants.

6. **The two conflict rows prescribe different actions without a distinguishing criterion**
   - **Location**: `skills/dh-coding/references/code-rules-resolution.md:59-60`; `skills/dh-coding/SKILL.md:44-46`
   - **Why it matters**: row 1 says a package/root contradiction is resolved by applying the package rule and reporting the divergence; row 2 says a root rule that **forbids** what the package rule requires is a conflict to escalate ("ask which wins before implementing"). The distinction between "contradicts" and "forbids/requires" is not defined, so an implementer can either apply a package rule that violates a root security constraint or stop unnecessarily.
   - **Fix**: define the criterion (e.g. hard prohibitions/security always escalate; stylistic divergence uses package precedence) or merge the two rows into one rule with an escalation clause.

## Validation performed

- `pnpm vitest run src/__tests__/workspace-gates-scope-rules.test.ts` → **30/30 passed**, ~108 ms; file reads only (no network/time/MCP dependency).
- `npx biome check src/__tests__/workspace-gates-scope-rules.test.ts` → clean.
- `npx tsc -b` → exit 0 (the generated `tsconfig.tsbuildinfo` was restored; no code change left behind).
- `pnpm lint:links` → 186 references checked before this report was added, `OK — no dead references`; re-run with the report: 189 references, still OK.
- `wc -l`: changed `SKILL.md` files 85–209 lines; bundle maximum 248 (`dh-setup`); the three new references 113/139/96 lines; the new test 221 lines (code/test files under 300).
- No full `pnpm test` / `pnpm qa:check:full` run in this review; the targeted suite above is the new test, and the prior phase-2a follow-up reports the full suite green (49 files / 815 tests).
- No secrets, tokens, credentials or environment values in the reviewed diff.

## Scope note

- The working tree is cumulative: it also contains Sub-Tasks 1.2/1.3/2.1/2.5 work (`dh-setup`/`workspace-map.md`/`workspace-anchor.test.ts`, plan/SDD templates, execution-record prose, `reports/audit.*`). Those were reviewed in the phase-1/2a reviews; this review judges only the 2.2–2.4 portions. `dh-review`'s fast-mode omitted-section list and `dh-final-review`'s T2 execution-record lines come from 2.1/2.5, not 2.3.
- Plan status: `plan.md:307` (2.3) and `plan.md:337` (2.4) still say **Pending** while their implementation is present; 2.2 says **In Progress**. Per the phase model, both should be **In Progress** while under review and **Completed** only after acceptance.

## Suggested Next Steps

- [ ] Add the working-tree diff variants (`git diff -- <paths>`, `git diff HEAD -- <paths>`) to `workspace-diff-scope.md` and the four review skills; make `dh-simplify` default to the working-tree form (P2-1).
- [ ] Define where `shared_paths(plan)` is declared — add a `Shared/root paths` line to `## Workspace Impact` (template + scaffold) or point the reference at `## Scope`/sub-task in-scope text (P2-2).
- [ ] Use the "`WORKSPACE.md`, else `docs/WORKSPACE.md`" phrasing in the gate/rule skills (P3-1).
- [ ] Resolve the `none` vs "no command" wording (P3-2).
- [ ] Add the two-package/root-shared fixtures and strengthen the 2.3 test assertions in 4.2 (P3-3).
- [ ] Fix the line-count assertion off-by-one (P3-4).
- [ ] Clarify the command-table cwd exceptions and Yarn Berry aggregate (P3-5).
- [ ] Clarify the conflict-escalation criterion (P3-6); move 2.3/2.4 statuses to `In Progress` while reviewing.
- [ ] Re-run the targeted test, `pnpm lint:links` and `pnpm qa:check:full` after the fixes.

## P2 resolution (orchestrator, 2026-11-10)

- **P2-1 (uncommitted diffs):** `workspace-diff-scope.md` and the review/simplify/final-review skills now include `git diff HEAD -- <paths>`, `git diff -- <paths>` and `git status --porcelain -- <paths>` alongside the base diff; the reference test pins the commands.
- **P2-2 (shared paths source):** `## Workspace Impact` now declares `Shared paths` in the template, scaffold, SDD template and planning rule; `workspace-diff-scope.md` derives `shared_paths` from that field (explicit sub-task paths as fallback).
- **P3:** deferred as non-blocking (map fallback wording, `none` command semantics, prose-only two-package example, line-test off-by-one, Go/submodule cwd and conflict-row dedup). None affects the standalone or the documented workspace path.
