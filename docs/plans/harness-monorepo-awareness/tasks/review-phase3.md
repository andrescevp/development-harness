# Code Review Summary — Phase 3 (Sub-Tasks 3.1–3.5)

**Scope**: Sub-Tasks 3.1 (workspace/package/vault docs roots), 3.2 (code-graph index routing), 3.3 (fixed/independent versioning), 3.4 (worktree discovery and submodule branch alignment) and 3.5 (package-aware pause/resume and workspace domain mapping) of [`plan.md`](../plan.md), against [`sdd.md`](../sdd.md) (R6, R7; AC6) and the normative [`workspace-contract.md`](../workspace-contract.md).

Reviewed files:

- `agents/dh-documentor.md`
- `skills/dh-create-documentation/SKILL.md`, `references/workspace-docs.md`
- `skills/dh-code-query/SKILL.md`, `references/workspace-index.md`
- `skills/dh-setup/references/code-graph-rag.md`
- `skills/dh-semver/SKILL.md`, `references/monorepo-versioning.md`
- `skills/dh-create-worktree/SKILL.md`, `references/worktree-discovery.md`
- `skills/dh-pause-plan/SKILL.md`, `references/package-scope.md`, `references/handoff-template.md`
- `skills/dh-resume-plan/SKILL.md`, `skills/dh-domain-check/SKILL.md`
- `src/__tests__/workspace-docs-graph-version-worktree.test.ts`

**Overall risk**: Medium
**Verdict**: Approve with comments

No P0/P1 findings. All six requested gates pass and the 28 new structural tests are deterministic. The remaining findings are documentation/contract inconsistencies that can make a supported monorepo path behave differently from the stated contract.

## Verification matrix

### Sub-Task 3.1 — workspace, package and vault docs roots

| Check | Result | Evidence |
|---|---|---|
| Workspace/package/vault decision table | **Pass** | `workspace-docs.md:16-39`; `dh-create-documentation/SKILL.md:35-37,93-96` |
| Package docs frontmatter (`package: <name>`) | **Partial (P2-1)** | Decision table and documentor rule pass; the linked push reference has no `package` field |
| Evolution/observation notes at the workspace root | **Partial (P2-1)** | New reference and SKILL say workspace root; `evolution-notes.md:11,14,33,110,174` still says `{project_root}` |
| `git rev-parse --show-toplevel` / submodule caveat | **Pass** | `workspace-docs.md:57-69` |
| `OBSIDIAN_VAULT` override | **Partial (P2-1)** | New reference says "vault copy"; `obsidian-push.md:5,21-23` writes one tree only |
| Standalone fallback | **Pass** | `workspace-docs.md:94-99`; `dh-documentor.md:51` |
| Documentor agent rule | **Pass** | `dh-documentor.md:44-51`; link resolves |
| Audit P2 doc finding addressed | **Partial (P2-1)** | Roots and package docs are documented; the operational push path is not |

### Sub-Task 3.2 — code-graph routing

| Check | Result | Evidence |
|---|---|---|
| Workspace vs package vs named cgr workspace indexes | **Pass** | `workspace-index.md:22-32` |
| `--workspace` / `--repo-path` / `--project` routing | **Pass** | `workspace-index.md:34-61`; `dh-code-query/SKILL.md:35-40` |
| `cgr status` and staleness checks | **Pass** | `workspace-index.md:63-77` |
| Scope line in the answer | **Partial (P3-1)** | Reference template has `**Scope:**`; the skill's own Output Template does not |
| Setup reference explains workspace vs per-package indexing | **Pass with caveat (P2-2)** | `code-graph-rag.md:121-147`; group sync command opens the assistant |
| Standalone fallback | **Pass** | `workspace-index.md:95-99`; `dh-code-query/SKILL.md:44` |

### Sub-Task 3.3 — monorepo versioning

| Check | Result | Evidence |
|---|---|---|
| Fixed vs independent policy from `WORKSPACE.md` | **Pass** | `monorepo-versioning.md:7-18,20-49`; `dh-semver/SKILL.md:48-64` |
| Per-package tags and changelog | **Pass** | `monorepo-versioning.md:33-49,51-61` |
| Confirmation before tagging, no push | **Pass** | `monorepo-versioning.md:63-72`; `dh-semver/SKILL.md:60-61,119-126` |
| Standalone fallback | **Pass** | `monorepo-versioning.md:85-89` |
| Core Rules / output template agree with independent policy | **Partial (P3-2)** | Core Rules and Output Template are single-tag-only |

### Sub-Task 3.4 — worktree discovery and submodule alignment

| Check | Result | Evidence |
|---|---|---|
| Root/submodule discovery order | **Pass** | `worktree-discovery.md:7-25`; `dh-create-worktree/SKILL.md:42-48` |
| Branch alignment and detached HEAD handling | **Pass** | `worktree-discovery.md:47-64` |
| Nested independent repositories | **Pass** | `worktree-discovery.md:66-71` |
| Missing-file behavior | **Pass** | `worktree-discovery.md:73-86` |
| Same-branch reuse rule preserved | **Pass** | `worktree-discovery.md:61-64`; `dh-create-worktree/SKILL.md:58-59` |
| No destructive shortcuts | **Pass** | `dh-create-worktree/SKILL.md:39-40,128-136` |

### Sub-Task 3.5 — package-aware pause/resume and domain mapping

| Check | Result | Evidence |
|---|---|---|
| Scope from `## Workspace Impact` + `Shared paths` | **Pass** | `package-scope.md:7-18`; `dh-pause-plan/SKILL.md:131-133` |
| Affected-package fingerprints | **Partial (P2-5)** | `package-scope.md:32-50`; submodule/gitlink paths cannot be hashed |
| Unrelated dirty packages are out of scope, not drift | **Pass** | `package-scope.md:20-30,77-84`; `dh-resume-plan/SKILL.md:119-123` |
| Repo-wide fallback | **Partial (P2-3)** | `package-scope.md:86-90` conflicts with the hard stop at `:16-18` |
| Handoff records the package scope | **Partial (P2-4)** | Step 2 says record it; Step 3 and the template omit it |
| Domain check uses the workspace map/graph | **Pass with caveat (P3-6)** | `dh-domain-check/SKILL.md:51-62`; the map has no dependency column, so the graph supplies cross-package edges |

### Cross-cutting

| Check | Result | Evidence |
|---|---|---|
| Tests meaningful and deterministic | **Pass with caveat (P3-4)** | 28/28 pass in 109 ms; file reads only; cross-file contradictions are not asserted |
| All `SKILL.md` files under 250 content lines | **Pass** | Max 248 (`dh-setup`); `dh-create-documentation` and `dh-pause-plan` at 247 |
| New references and test under size limits | **Pass** | References 103–115 lines; test 275 lines; documentor 81 lines |
| Links resolve | **Pass** | `pnpm lint:links` — 205 before this report, 208 with it; no dead references |
| No unrelated changes | **Partial (P3-5)** | `dh-pause-plan/SKILL.md` has formatting-only reflow |
| No secrets/tokens/credentials in the diff | **Pass** | Audit `secretFailures: 0`; manual review found none |

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

1. **3.1 — The operational docs references still use the old single-root model and the vault mirror is not implemented**
   - **Location**: `skills/dh-create-documentation/references/workspace-docs.md:41-55,94-99`; `skills/dh-create-documentation/references/obsidian-push.md:5,21-23,30-40`; `skills/dh-create-documentation/references/evolution-notes.md:11,14,33,110,174`; `skills/dh-create-documentation/SKILL.md:35-37,227`.
   - **Why it matters**: the new reference says package docs live in `{package}/docs`, that in-repo docs are the source of truth, and that `OBSIDIAN_VAULT` mirrors them under `{vault}/docs`. The linked push reference still writes one tree at `$VAULT/docs`, its frontmatter template has no `package` field, and it says ALL docs live under `{project_root}/docs`. The linked evolution reference still writes `{project_root}/docs/evolution`. In a workspace, package docs are therefore never copied or enriched, and the "source of truth + vault copy" model is not executable. If `{project_root}` is read as the session/package root, evolution notes can land package-local, violating the sub-task's "always workspace root" rule.
   - **Evidence**: `workspace-docs.md:47-55` requires a mirror; `obsidian-push.md:21-23` defines `DOCS_DIR="$VAULT/docs"` and `obsidian-push.md:30-40` has no `package`; the test asserts only `workspace-docs.md`, the SKILL and the documentor, not these two references.
   - **Fix**: update `obsidian-push.md` to copy from the chosen docs root to `{vault}/docs` (or explicitly state a one-way mirror), add `package` to its frontmatter template and defaults, and replace `{project_root}` with `{workspace_root}` in `evolution-notes.md`. Add a structural test that both operational references use the new roots and `package`.

2. **3.2 — `cgr start --workspace <name> --update-graph` is not a sync-and-exit command**
   - **Location**: `skills/dh-setup/references/code-graph-rag.md:127-145`; `skills/dh-code-query/references/workspace-index.md:72-75`.
   - **Why it matters**: upstream `cgr` documents that `--update-graph` with `--workspace` syncs each repository and then opens the interactive assistant scoped to the workspace; it is not the batch "index and exit" form used for a single repository. The reference presents it as the named-workspace index and re-sync command, so `dh-setup` or a staleness check can block waiting for input or leave an assistant session open in a non-interactive run.
   - **Evidence**: [`multi-project.md`](https://github.com/vitali87/code-graph-rag/blob/main/docs/guide/multi-project.md) ("syncs each ... then opens the assistant") and the `--update-graph` option in [`cli-reference.md`](https://github.com/vitali87/code-graph-rag/blob/main/docs/guide/cli-reference.md); the reference table and re-index bullet use the command without that caveat.
   - **Fix**: use `cgr start --repo-path <repository> --update-graph` per repository for non-interactive group sync, or document that the named-workspace form opens the assistant and belongs to an interactive query session. Keep `--workspace` for `stats`/`export`/MCP and for scoped queries.

3. **3.5 — The package-scope fallback contradicts the hard stop for a workspace plan without `## Workspace Impact`**
   - **Location**: `skills/dh-pause-plan/references/package-scope.md:16-18` versus `:86-90`.
   - **Why it matters**: one rule says a workspace plan without `## Workspace Impact` is a hard stop at pause ("ask which packages are affected; never fall back to all packages"). The fallback rule says "No map or no `## Workspace Impact`: do not write `## Package Scope`; compare the full recorded path set exactly as today." When the map exists but the section is missing, the second rule silently restores the repo-wide comparison, allowing unrelated-package drift to contaminate resume — the behavior this sub-task exists to prevent.
   - **Evidence**: the two quoted paragraphs; `dh-resume-plan/SKILL.md:119-123` then uses the repo-wide comparison whenever the section is absent.
   - **Fix**: split the conditions explicitly: no map → repo-wide fallback; map present + missing `## Workspace Impact` → stop and ask. Update `dh-pause-plan` and add a test for both cases.

4. **3.5 — The optional `## Package Scope` section is missing from the canonical handoff template and the pause Step 3 list**
   - **Location**: `skills/dh-pause-plan/SKILL.md:131-133,137-150`; `skills/dh-pause-plan/references/handoff-template.md:11,48-60,93-199`; `skills/dh-resume-plan/SKILL.md:119-123`.
   - **Why it matters**: Step 2 says to record the optional `## Package Scope` section, but Step 3 says to follow `handoff-template.md` exactly and enumerates only the 11 required sections; the template's required-section list and its template block also omit the section. A compliant pause can therefore omit it, and resume then falls back to the repo-wide comparison, reintroducing the false-drift behavior.
   - **Evidence**: Step 3's list at `dh-pause-plan/SKILL.md:146-150` has no `## Package Scope`; `handoff-template.md:48-60` has 11 required sections; the only mention is the contract-overview bullet at `:11`. The 3.5 test's `toContain('## Package Scope')` is satisfied by that bullet, not the template.
   - **Fix**: add the optional section to the template block and the Step 3 list (or say "the 11 required plus the optional `## Package Scope`"), validate it when present, and strengthen the test to assert it in the template block.

5. **3.5 — Package fingerprints cannot hash a submodule/gitlink path**
   - **Location**: `skills/dh-pause-plan/references/package-scope.md:32-47`.
   - **Why it matters**: `git hash-object -- <path>` fails on a directory. A submodule is a supported package type (the map detects `.gitmodules`, and 3.4 aligns submodule branches), and `git status` reports a dirty submodule as one gitlink path. An affected submodule package therefore cannot be fingerprinted; pause will either fail or mark the scope unverifiable, weakening the resume comparison for exactly the nested-repository case the plan targets.
   - **Evidence**: `git hash-object -- sub` in a temporary repository returns `fatal: Unable to hash sub` (exit 128); the reference defines only file hashes and `DELETED`, with no gitlink branch.
   - **Fix**: define a gitlink sentinel (for example `SUBMODULE <sha>` from `git -C <path> rev-parse HEAD`), or use `git status --porcelain=v2`/`git diff --raw` with gitlink handling. Add a two-repository fixture in 4.2.

### [P3] Low

1. **3.2 — The skill's Output Template omits `**Scope:**`**
   - **Location**: `skills/dh-code-query/SKILL.md:42-43,166-181`; `skills/dh-code-query/references/workspace-index.md:79-93`.
   - **Why it matters**: the routing rule requires a scope line in every answer, but the skill's canonical output template only has `**Project:**`. An agent copying the template can omit the index scope, which the sub-task's acceptance criterion specifically requires.
   - **Fix**: add `**Scope:**` to the Output Template and assert it in the 3.2 test.

2. **3.3 — Independent policy is documented, but Core Rules and the output template remain single-tag-only**
   - **Location**: `skills/dh-semver/SKILL.md:29-44,95-117` versus `:48-64`; `skills/dh-semver/references/monorepo-versioning.md:33-49`.
   - **Why it matters**: Core Rules unconditionally create `v<X.Y.Z>`, and the output template reports `vX.Y.Z`. In an independent workspace, an agent following those sections can create or report the wrong tag format. The mandatory confirmation catches it, but the instructions conflict and the plan's "keep the output template" suggestion leaves the independent report shape undefined.
   - **Fix**: qualify the Core Rules tag command with the map policy and add an independent output variant (one row per `<package>@<version>`).

3. **3.5 — The fingerprint set and plan-owned paths are underspecified**
   - **Location**: `skills/dh-pause-plan/references/package-scope.md:22-27,45-46,60-64,81-82`.
   - **Why it matters**: (a) step 4 records fingerprints only for affected and shared paths, while the handoff example and the resume comparison also use out-of-scope package fingerprints; an agent following step 4 cannot recompute them on resume. (b) `docs/plans/<slug>/plan.md` is a root path that is not under a package and is not automatically in `Shared paths`; status updates make it dirty, so it can be classified `unattributed` and force confirmation on every resume, defeating the "unrelated changes are not drift" goal for the plan's own files.
   - **Fix**: record one fingerprint per dirty out-of-scope package and always include `docs/plans/<slug>/` in the shared/root set (excluding `handoff.md` and `*.tmp`). Add a fixture.

4. **Tests — cross-file contradictions are not asserted**
   - **Location**: `src/__tests__/workspace-docs-graph-version-worktree.test.ts:16-261`.
   - **Why it matters**: the 28 tests are deterministic and pass, but they assert strings in the new files without checking that the operational references (`obsidian-push.md`, `evolution-notes.md`) use the new roots, that the pause Step 3 list includes `## Package Scope`, or that the no-map/no-impact cases are distinguished. The handoff-template assertion at `:255-260` is satisfied by the overview bullet while the template block omits the section.
   - **Fix**: add structural assertions for those cross-file contracts; keep them file-read only.

5. **3.5 — Unrelated formatting churn in `dh-pause-plan/SKILL.md`**
   - **Location**: `skills/dh-pause-plan/SKILL.md:47-50,76-80`.
   - **Why it matters**: two prose blocks were reflowed into long single lines with no behavior change, apparently to stay under the 250-line limit after adding the package-scope pointer. It makes the 3.5 diff noisier and reduces readability; the sub-task did not require it.
   - **Fix**: revert the reflow and move the Code Mode/MCP sentence to a reference if the line limit is tight.

6. **3.5 — `dh-domain-check` says the map's `## Packages` table carries dependencies, but the template has no dependency column**
   - **Location**: `skills/dh-domain-check/SKILL.md:54-55`; `skills/dh-setup/references/workspace-map.md:102-107`.
   - **Why it matters**: the skill tells the agent to read dependencies from `## Packages`, which only has Package/Path/Stack/Test/Build/Docs root/Rules/Notes. On an unindexed workspace the code-graph step cannot supply the missing edges, so the directory fallback can miss a cross-package dependency and under-report a boundary violation.
   - **Fix**: derive dependencies from workspace manifests (`pnpm list -r --depth -1`, `cargo metadata`, `go list`) and the graph, or add a `Dependencies` column to the map as a 1.2 follow-up and cite it.

## Validation performed

- `pnpm build` — pass (`tsdown` bundles, `tsc --emitDeclarationOnly`, `copy-assets`: 5 agents, 26 skills).
- `pnpm test` — **51 files / 874 tests passed**, 2.29 s.
- Targeted `pnpm vitest run src/__tests__/workspace-docs-graph-version-worktree.test.ts` — **28/28 passed**, 109 ms; file reads only, no network/time/MCP dependency.
- `pnpm typecheck` — pass (`tsc --noEmit`).
- `pnpm lint:biome` — 119 files checked, no fixes applied.
- `pnpm lint:links` — 205 references checked before this report, 208 with it; **OK — no dead references** in both runs.
- `pnpm run audit` — exit 0; `secretFailures: 0`, `junkFiles: 0`, `symlinks: 0`; `unresolvedAtMentions: 1` and `unresolvedKebabTokens: 289` are the pre-existing warn-only findings noted in the handoff. The run regenerated `reports/audit.{json,md}`.
- Size checks: all `SKILL.md` files are under 250 content lines (max 248, `dh-setup`); new references are 103–115 lines; the new test is 275 lines; `dh-documentor.md` is 81 lines.
- `git diff --check`: only the pre-existing trailing whitespace at `skills/dh-review/SKILL.md:156` (Phase 2); the new files have no trailing whitespace.
- No secrets, tokens, or credentials were found in the reviewed diff (audit secret failures 0).

## Scope note

- The working tree is cumulative: it also carries Phase 1/2 changes (`dh-setup`, `dh-preflight`, planning templates, `docs/plans/index.md`, `reports/audit.*`). This review judges only the Phase 3 portions listed above.
- Plan statuses at review time: Phase 3 `In Progress`; 3.1 `In Progress`; 3.2–3.5 `Pending` despite their implementation. The handoff records this as intentional pending this review. Move 3.2–3.5 to `In Progress` while fixing the findings and to `Completed` only after acceptance; the phase cannot close until all five are `Completed`.
- No package-local `docs/plans` directory was created or referenced.

## Suggested Next Steps

- [ ] Fix P2-1 (docs references and vault mirror) and re-run `pnpm lint:links`.
- [ ] Fix P2-2 (named-workspace cgr sync) and P3-1 (scope line in the skill's Output Template).
- [ ] Resolve P2-3/P2-4/P2-5 and P3-3/P3-6 for 3.5, and add the submodule/out-of-scope fixtures in 4.2.
- [ ] Add the cross-file assertions in P3-4 and fix the `dh-pause-plan` formatting churn (P3-5).
- [ ] Re-run the six gates after the fixes; mark 3.1–3.5 `Completed` only when the P2s are closed or explicitly accepted.

## P2 resolution (orchestrator, 2026-11-10)

- **3.1 docs references:** `obsidian-push.md` now follows the workspace-docs decision (workspace/package/vault, `package` frontmatter); `evolution-notes.md` uses `{workspace_root}` and states notes stay workspace-root.
- **3.2 cgr workspace:** `cgr start --workspace` is documented as interactive (sync then assistant); per-repo `cgr start --repo-path ... --update-graph` is the batch path.
- **3.5 package scope:** a detected workspace with a plan missing `## Workspace Impact` is a hard stop; only standalone/legacy handoffs use the repo-wide fallback. `## Package Scope` is in the canonical handoff template and pause Step 3; submodule/gitlink fingerprints use `gitlink:<sha>`/`SUBMODULE_UNVERIFIABLE`.
- **P3:** `**Scope:**` added to the code-query output; semver independent policy added to Core Rules; remaining P3s deferred (formatting churn, cross-file test breadth, domain dependency column).
