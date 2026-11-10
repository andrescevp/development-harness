# Code Review Summary

**Scope**: Sub-tasks 1.2 ("Detect monorepo layouts and generate the workspace map") and 1.3 ("Verify the plan/docs anchor and add anchor tests") of `docs/plans/harness-monorepo-awareness/plan.md`. Changed surface reviewed: `skills/dh-setup/SKILL.md` (Step 3 anchor block + checklist; 248 lines), new `skills/dh-setup/references/workspace-map.md` (215 lines), new `src/__tests__/workspace-anchor.test.ts` (183 lines). `plan.md`, `docs/plans/index.md` and `reports/audit.*` changes are status/generated artifacts from 1.1 or the audit run and are not re-reviewed here except for scope.

**Overall risk**: Low
**Verdict**: Approve with comments

No P0/P1 findings. Both sub-tasks meet their stated acceptance criteria and the reported gates are reproducible. Two P2 documentation-contract gaps (upward workspace detection, and conflating "map declined/absent" with "standalone") should be fixed before Phases 2–4 consume the map/fallback language; three P3s tighten test strength and consistency.

## Acceptance criteria verification

### 1.2 — detection markers and workspace map

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Names every detection marker | Pass | `skills/dh-setup/SKILL.md:80-83` and `references/workspace-map.md:19-30` list pnpm, `package.json#workspaces`, turbo, nx, lerna, Cargo `[workspace]`, `go.work`, `settings.gradle`, `*.sln`, `.gitmodules`. `src/__tests__/workspace-anchor.test.ts:20-32,70-73` asserts every marker in both files. |
| 2 | Links the reference from the skill | Pass | `SKILL.md:91-92` Markdown link; asserted at `workspace-anchor.test.ts:65-68`. |
| 3 | Documents `DH_WORKSPACE_ROOT` wiring | Pass | Reference `:134-164` gives the canonical `mcp.servers.dh` snippet, the absolute-path rule, per-connection resolution and comment-preserving guidance; matches `docs/LOADING.md:205-220,225-232` and the repo's own `opencode.jsonc`. |
| 4 | Interview/template cover packages, stacks, commands, docs roots, code-graph scope, worktree scope, version policy | Pass | Interview items 1–12 (`workspace-map.md:46-76`) and template sections at `:83-132`; `workspace-anchor.test.ts:35-43,80-82` pins the seven map sections. Aggregate/affected commands are covered (`:59-61,103-107`). |
| 5 | Skill stays under the 250-line limit | Pass | `wc -l` = 248; `scripts/lib/shared.mjs:15` (`LINE_LIMITS.skill = 250`) and `reports/audit.md` size dimension PASS. |
| 6 | Standalone behavior preserved | Pass with comments | `workspace-map.md:188-194` keeps `cwd = W = P = plan root = vault root`, no map/marker/override required; the Step 3 additions are read-only checks that pass trivially when cwd = W. See P2-2 for the "map declined" wording. |
| 7 | No unrelated behavior changes | Pass | The 50/50-line `SKILL.md` diff is a prose reflow of Steps 1, 2, 4, 5 needed to fit the new block under 250 lines. A whitespace-normalized sentence diff shows only intended wording changes (e.g. "the optional items" → the named list, "architecture author;" dropped); no instruction or behavior was removed. |

### 1.3 — anchor verification and tests

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 8 | Setup checklist verifies start-at-root, override equality, MCP-vs-skill plan-dir agreement, STOP on mismatch | Pass with comments | `SKILL.md:87-90` (Step 3 body) and `SKILL.md:238` (checklist) cover `pwd -P` = workspace root, override unset/equal, `dh` plan dir = skill `./docs/plans`, no package-local `docs/plans`, "on mismatch STOP … restart opencode"; reference steps at `workspace-map.md:166-186`. See P3-1/P3-2. |
| 9 | Tests assert the markers | Pass | `workspace-anchor.test.ts:70-73` (10 markers, both files) and `:75-78` (marker + confirmation rule). |
| 10 | Tests assert the contract decision table and mismatch codes | Pass with comments | Rows and verdict/code strings at `:124-154`; resolver rows at `:157-165`. Per-row verdict mapping and the checklist's full content are not pinned — see P3-1. |
| 11 | Tests cover resolver override behavior and a root + package-cwd mismatch fixture | Pass | 10 decision rows + blank override (`:157-165`), temp-dir root/package fixture with `pnpm-workspace.yaml` marker (`:167-182`). |
| 12 | Tests deterministic, under 300 lines | Pass | 183 lines; text reads + one `withTempDir` fixture; no network/git (`:1-8`); existing helpers `src/__tests__/helpers/repo.ts`, `helpers/temp-dir.ts`. |
| 13 | No false claims | Pass with comments | Claims about MCP root resolution/anchoring, per-connection resolution, `dh_plan_read` path and vault independence match `src/mcp/workspace.ts:27-35`, `src/mcp/stdio.ts:4-5,51-90`, `src/tools/plan-paths.ts`, `docs/LOADING.md:230-232,251`. The forward-looking map-consumer statement is flagged in P2-2. |
| 14 | Existing resolver tests stay green | Pass | Full suite green (777 tests, 48 files). |

**Security / secrets**: no tokens, credentials or environment values in the diff; the audit secret scan reports 0 high-signature hits. The `reports/audit.json` machine path is pre-existing and generated.

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

1. **Workspace detection never looks upward, so a package-cwd setup can pass as standalone**
   - **Location**: `skills/dh-setup/references/workspace-map.md:32-44` (detection procedure), `:166-186` (anchor verification); `skills/dh-setup/SKILL.md:80-92,238`
   - **Why it matters**: The procedure assumes the current directory is the workspace root ("Probe the workspace root and one level below") and provides upward discovery only for submodules (`--show-superproject-working-tree`, `:40-42,172-173`). For npm/pnpm/yarn/Nx/Turbo packages the markers live in a parent, so a setup run in `apps/web` finds no marker, hits "No marker and no confirmation → standalone" (`:43-44`), sees `pwd -P` equal to its own cwd (`:170-171`), and passes the checklist. A later `dh-planning` would then write `/repo/apps/web/docs/plans` while a correctly configured MCP would read `/repo/docs/plans` — the exact split contract §5/§6.2 says setup must stop (`workspace-contract.md:120-135,159-166`), and the plan's stated anchor risk (`plan.md:88-90`).
   - **Evidence**: Nothing in 1.2's procedure or 1.3's checklist discovers a parent workspace for workspace-manager layouts; §6.2's "likely_workspace_root … (marker: pnpm-workspace.yaml / WORKSPACE.md)" presumes knowledge the check never obtains.
   - **Fix**: Before declaring standalone, walk parent directories for the markers (or use `git rev-parse --show-toplevel`, `pnpm -w root`, `npm prefix -w`, `yarn workspaces list`); if a parent workspace is found and cwd is not W, emit the §6.2 report and write nothing. Add the probe to the reference checklist and a fixture/test asserting the documented stop (a second temp-dir case with cwd = `{repo}/apps/web` and the marker above it).

2. **"Map declined / map absent" is conflated with "not a workspace", and "no map" falls back to a single project root**
   - **Location**: `skills/dh-setup/references/workspace-map.md:3-7,43-44`; `skills/dh-setup/SKILL.md:238`
   - **Why it matters**: The map is optional by consent (interview item 12, `:74-76`), so "detected monorepo, map declined" is reachable. The reference then says "No marker and no confirmation → standalone" and that other skills "fall back to the single project root when it is absent". If a detected polyglot workspace is reclassified as standalone, the later gates described in R4/2.2 have no command source of truth and can report a single-root green for untested packages — the plan's "no false green / unknown packages" risk (`plan.md:91-95`, `sdd.md:161-162`). The checklist's "`WORKSPACE.md` written on consent **or** standalone confirmed" also lets that misclassification pass.
   - **Evidence**: The reference's own standalone section defines standalone as "No markers and no map" (`:188-194`), contradicting `:43-44` where missing confirmation alone yields standalone. Separately, "the other skills read it" (`:5-7`) is not true yet: no bundled skill outside `dh-setup` references `WORKSPACE.md` (R2 consumers land in 2.x–4.x).
   - **Fix**: Distinguish the states explicitly: no markers → standalone; markers present with the map declined or not yet generated → detected workspace without a map, keep `docs/plans` at W, record the decline, and make consumers treat per-package commands as unknown (never single-root green). Reword `:5-7` to describe the intended contract ("skills are expected to read it") until the consumers land, or land the claim together with 2.x–4.x.

### [P3] Low

1. **Anchor/decision-table tests are weaker than the acceptance criteria**
   - **Location**: `src/__tests__/workspace-anchor.test.ts:119-121,124-142`
   - **Why it matters**: The checklist assertion (`/Step 3 anchor:.*pwd -P.*DH_WORKSPACE_ROOT/s`) still passes if the checklist drops "`dh` plan dir = skill `./docs/plans`", "no package-local `docs/plans`" or "on mismatch nothing written"; only the two tokens are required. Likewise, `:132-142` asserts each verdict string appears somewhere, not against its row, so swapping a row's verdict (e.g. row 3 → "OK — canonical") stays green. The acceptance criterion "tests fail if the setup checklist omits the anchor verification" is therefore only partially enforced.
   - **Fix**: Assert the checklist bullet contains each required clause (or match the whole bullet with a stable regex), and add `verdict` to `DECISION_ROWS` so each `| N |` row is asserted to carry its documented verdict.

2. **Override equality is compared without realpath normalization**
   - **Location**: `skills/dh-setup/references/workspace-map.md:174,207-208`; contract `docs/plans/harness-monorepo-awareness/workspace-contract.md:89-91,288-290` (§10.2 step 3)
   - **Why it matters**: A3/§5 require comparisons after realpath normalization and `pwd -P`, and the MCP accepts a symlinked workspace root (`src/tools/plan-paths.ts:55-61`). The checklist compares `DH_WORKSPACE_ROOT` literally to "the workspace root", so a valid symlinked override (e.g. `/home/u/repo` vs `/mnt/data/repo`) can be reported as a mismatch and stop the setup with a restart instruction it does not need. This repeats 1.1 review P3-1, whose resolution claims the realpath note was clarified, but §10.2 step 3 and the new reference still lack it.
   - **Fix**: State "unset or an absolute path that normalizes (realpath / `pwd -P`) to the workspace root" in both places.

3. **Map file discovery is inconsistent between the two locations the reference allows**
   - **Location**: `skills/dh-setup/references/workspace-map.md:3,74-75`; `skills/dh-setup/SKILL.md:84`
   - **Why it matters**: The reference allows `{workspace_root}/WORKSPACE.md` "otherwise `docs/WORKSPACE.md`" but declares only the root file as "the source of truth", and `SKILL.md:84` names only the root file. When 2.x–4.x skills start reading the map they need one discovery rule; otherwise a map written to `docs/WORKSPACE.md` is invisible.
   - **Fix**: Add the discovery order explicitly ("read `{workspace_root}/WORKSPACE.md`, else `docs/WORKSPACE.md`") in the reference and, if the alternate is kept, in the `SKILL.md` pointer.

## Notes (not findings)

- `docs/plans/harness-monorepo-awareness/plan.md` still marks 1.3 as `Pending` while all 1.3 deliverables exist (only 1.2 is `In Progress`). Update the plan status when the review is accepted.
- The reflow-only `SKILL.md` edits (Steps 1, 2, 4, 5) are semantically neutral and were evidently required to keep the file at 248/250 lines; no action requested.
- `docs/plans/index.md` (new `Mirrored plan path` column) and `reports/audit.*` are 1.1/generated artifacts, outside this review's sub-task scope.

## Suggested Next Steps

- [ ] No P0/P1 findings; safe to continue Phase 1.
- [ ] Address P2-1 (parent-workspace probe) and P2-2 (map-declined/absent classification) before 2.2/2.4/3.x consume the map/fallback contract.
- [ ] Tighten the checklist/verdict assertions and add the realpath wording (P3-1, P3-2); add the map discovery rule (P3-3).
- [ ] Update the 1.2/1.3 status markers when approved.

## Validation evidence (rerun during review)

| Gate | Command | Result |
|---|---|---|
| Targeted tests | `npx vitest run src/__tests__/workspace-anchor.test.ts` | 1 file / 40 tests passed |
| Full tests | `npx vitest run` | 48 files / 777 tests passed |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Biome | `npx biome check src/ scripts/` | 115 files, no fixes, exit 0 |
| Links | `node scripts/check-links.mjs` | 158 references, "OK — no dead references", exit 0 |
| Audit | `node scripts/audit.mjs` | PASS — 0 FAIL, 270 warn, exit 0 (reports restored to the pre-run state) |

No code or skill files were modified during this review; only this report was written.
