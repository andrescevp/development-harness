# Code Review Summary

**Scope**: Sub-task 1.1 — "Define the workspace contract and anchor rules"
(`docs/plans/harness-monorepo-awareness/workspace-contract.md`, new file; the
only `plan.md` change is the Phase 1 / 1.1 status flip to `In Progress`)
**Overall risk**: Low
**Verdict**: Approve with comments

No P0/P1 findings. The note meets the 1.1 acceptance criteria and is usable as
the normative source for the later sub-tasks; three P2 wording gaps should be
closed before 1.2/1.3/2.5 quote the contract, because each can be implemented
literally in a way the contract elsewhere forbids.

## Acceptance-criteria verification

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | All four roots defined | Pass | §1 defines workspace root, package root, plan root, vault root (+ affected packages), with owners and the rule that package-owned artifacts never move above `P` (`workspace-contract.md:27-37`). |
| 2 | Approved single-plan-root decision | Pass | §3: `W/docs/plans` is the only plan root; `P/docs/plans` MUST NOT be created/treated as a root even for submodules/worktrees; pre-existing trees are foreign/legacy (`:68-79`, `:274`). Matches `plan.md:648-650` and `sdd.md:170-172`. |
| 3 | Normative anchor rules + decision table | Pass with comments | A1–A9 at `:83-107`; 10-row cwd × override table at `:114-125`, with the critical note that the check compares against expected `W`, not just MCP vs skill (`:127-135`). See P2-1 and P3-1. |
| 4 | Loud mismatch, no writes, read-only exception | Pass | §6.1/§6.2 give copy-paste error templates naming both roots, both plan dirs and the restart remediation; §6.3 authorizes read-only only on explicit user consent (`:137-171`), reinforced by A5 (`:95-97`) and §10.3.1 (`:297-298`). |
| 5 | Provenance fields + timing in plan.md and index | Pass with comments | §7.1 field table (`:183-201`) covers real repo kind/path, mirrored plan path, summary and architectural changes; §7.2 index row (`:203-211`) matches the existing `## Execution Records` header exactly (`docs/plans/index.md:18`); T1–T5 order at `:213-226`. See P2-2 and P2-3. |
| 6 | Standalone fallback unchanged | Pass | §8: `cwd = W = P = plan root = vault root`, `./docs/plans` keeps its meaning, single toolchain/full diff, and "nothing here may require a standalone repo to add a map, a `DH_WORKSPACE_ROOT` entry, or a workspace marker" (`:228-243`); A9 (`:106-107`). |
| 7 | Evidence citations accurate | Pass | Spot-checked every cited source: `src/mcp/workspace.ts:20-36` (trimmed override, relative resolve, blank-cwd throw), `src/mcp/stdio.ts:4-5,51-59,71-77` (per-connection root), `src/tools/plan-paths.ts:10-18,25-28,36-53,55-61`, `src/mcp/server.ts:27`, `docs/LOADING.md:230-232,251,264-268,277,294-298`, `skills/dh-planning/SKILL.md:13,18,53,98,103,104`, `skills/dh-create-documentation/SKILL.md:4,89,220,229-232`, `skills/dh-setup/SKILL.md:47-49,87,116-130,133-136,173-175`, `pnpm-workspace.yaml:1-9` (settings-only, no `packages:` — the §10.1 false-positive example is correct). Only nit: the `dh-create-documentation:229-232` range is a verification checklist rather than the vault-anchor prose, but it still supports "docs under `{project_root}/docs`". |
| 8 | No contradictions or ambiguity | Pass with comments | Terminology, root ownership, failure templates and the worked example (§9) are internally consistent. The remaining issues are the P2/P3 items below. |

**Security**: the diff is two Markdown files; no secrets, tokens, credentials or
environment values are recorded (and the contract explicitly forbids recording
them, §7.1 `:198-199`).

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

1. **A4 can be read as authorizing a write outside the mismatch rule**
   - **Location**: `docs/plans/harness-monorepo-awareness/workspace-contract.md:92-97` (A4/A5), with `:127-135` (§5 notes) and `:139-153` (§6.1)
   - **Why it matters**: A4 says that with a different session base, skills "MUST resolve plans against the absolute workspace root". §5 and §6.1 say the only outcome of such a session is a stop/restart and that no override repairs it. An implementer who applies A4 literally in planning/review skills can have a skill write `W/docs/plans/...` from a package-cwd session while the `dh` server is still anchored at `P/docs/plans` (row 5) — i.e. re-create the exact split the contract exists to remove.
   - **Evidence**: The mitigation lives only in the neighbouring A5 and §6; A4 itself carries no read-only qualifier. Row 5 (`:120`) accepts that both sides can agree on the wrong root, so resolving to `W` unilaterally does not prove the MCP agrees.
   - **Fix**: Qualify A4: "…MUST resolve plans against the absolute workspace root **for read-only inspection authorized under §6.3**; when cwd ≠ `W` no skill writes plan/doc/status files (A5, §6)." Alternatively fold A4 into §6.3.

2. **Execution Record timing contradicts the record's own status values**
   - **Location**: `workspace-contract.md:183-201` (§7.1), `:213-226` (§7.3)
   - **Why it matters**: T1 (`:217`) is written when all sub-tasks are `Completed` and requires "every field" with `Execution status: Not executed`. §7.1 defines only `Completed | Completed with deferrals | Not executed` and defines `Executed at` as "the date the execution record was finalized". T2 (`:218`) then requires `dh-final-review` to verify the record is "complete and consistent with the diff" — a record that states the plan was not executed is inconsistent with an executed diff by construction, and a blocked plan "keeps `Not executed` until sign-off" (`:224`) shows the value is really being used as "pending sign-off".
   - **Evidence**: The mandated pre-sign-off value has no distinct status, and the finalization date is required before finalization. Whoever implements 2.5 must invent either a fourth status or a different write point, so the contract will not match the template it governs.
   - **Fix**: Add a `Pending sign-off` (or `Draft`) value, or have T1 write only the substantive fields and leave `Execution status`/`Executed at` to T3; state explicitly that T2 validates the substantive fields (repo/path, commit range, summary, architectural changes), not the status.

3. **"Mirrored plan path" is undefined and can reintroduce a package-local plan tree**
   - **Location**: `workspace-contract.md:72-75` (§3.2/§3.3), `:193` (§7.1 field), `:209-211` (§7.2), `:220` (T4)
   - **Why it matters**: §3.2 forbids `P/docs/plans` "not even when `P` is an independent git repo, submodule or worktree", yet §7.1 requires a `Mirrored plan path` described as a "workspace-relative copy path for a nested repo/worktree" without saying where a mirror may live or who creates it. T4 assigns "Link the evolution note and mirror path" to `dh-create-documentation`, but no rule says a mirror is created at all. A 2.5 implementer can satisfy §7.1 by placing the copy at `P/docs/plans/<slug>/plan.md`, violating §3.2 and AC9 ("no package-local `docs/plans` directory is created"). The index spec compounds it: the `## Execution Records` columns have no mirror column, and "a mirrored copy is named **in addition**, never instead" (`:209-211`) does not say where.
   - **Evidence**: The only permitted locations are implied, never stated; the two authoritative statements (§3.2 and §7.1) point in opposite directions for a nested repo.
   - **Fix**: Define the mirror explicitly — allowed location (e.g. only inside a worktree of `W`, never under `P`), creator, and that it never becomes a second plan root — or declare mirrors unsupported and require `Mirrored plan path: none`. State whether the index names it in the `Plan path` cell or in its own column.

### [P3] Low

1. **Override validation wording and table coverage**
   - **Location**: `workspace-contract.md:86-88` (A2), `:114-125` (§5), `:286-288` (§10.2 step 3)
   - **Why it matters**: A2's heading ("Override equals the cwd, or is unset") is weaker than its body ("MUST be the absolute path of `W`") and conflicts with the row-5 verdict when cwd = `P`; a check implemented from the heading passes exactly the case §5's note warns about (`:127-129`). The table tabulates 10 of the 12 cwd × override combinations: `P` + absolute value ≠ `W` (including `P` itself), and `S` + relative value are missing (their verdicts are derivable from A2/§6.1). §10.2 step 3 requires `DH_WORKSPACE_ROOT` "equal to `W`", while A3 (`:89-91`) requires realpath-normalized comparison (`pwd -P`), so a symlinked-but-valid override would fail the setup checklist.
   - **Fix**: Reword A2 to "absolute path of `W` (after realpath normalization) when set", add the three missing cells (or one sentence: "any override that does not normalize to `W` is a mismatch; every relative override is rejected"), and add "after realpath" to §10.2 step 3.

2. **Consumption map omits six later sub-tasks**
   - **Location**: `workspace-contract.md:305-317` (§11), header claim at `:15`
   - **Why it matters**: The note claims to be the authoritative contract for 1.1–4.3, and 1.1's testing suggestion is "verify every later sub-task can cite a contract section". §11 lists 1.2, 1.3, 2.1, 2.5, 3.1, 3.2, 3.4, 4.1, 4.3 but omits 2.2, 2.3, 2.4, 3.3, 3.5 and 4.2, so the traceability check cannot be performed and 3.3 (version policy) has no section to cite at all.
   - **Fix**: Add the missing rows with their sections (gates/reviews → §1 affected packages, A8; CODE_RULES → §1 package root and root/package ownership, A7; tests → §5/§6/§10), or narrow the header claim to the sections the note actually owns and mark version policy as out of contract scope.

3. **The contract is named in the plan but not linked from it**
   - **Location**: `docs/plans/harness-monorepo-awareness/plan.md:156-159`; `workspace-contract.md:319-322` (§12)
   - **Why it matters**: Acceptance criteria require the note to be "linked from the plan". The plan only contains the pre-existing backticked path inside 1.1's In-Scope line (it was written during planning, before the file existed); there is no clickable back-link, so the acceptance criterion is met only in spirit and 1.2–4.3 cannot navigate to it from the plan.
   - **Fix**: Add a Markdown link to `workspace-contract.md` from the plan (e.g. a References bullet near the audit/SDD links) and keep the `plan:` frontmatter back-reference.

## Suggested Next Steps

- [ ] No P0/P1 findings to fix before merge.
- [ ] Apply P2-1 (A4 read-only qualifier), P2-2 (execution-record status/timing) and P2-3 (mirror location/creator) before 1.2, 1.3 and 2.5 quote the contract.
- [ ] Add the missing decision-table cells and consumption-map rows (P3-1, P3-2) while the note is still uncommitted.
- [ ] Link the contract from `plan.md` (P3-3).
- [ ] After edits, re-run `node scripts/check-links.mjs` (currently green: 156 references, no dead links).

## Validation evidence

- `node scripts/check-links.mjs` → `OK — no dead references in the active surface`
  (covers the contract's `../../audits/...`, `../../../src/...`, `../../LOADING.md`
  and `../../../skills/...` links and its backticked evidence paths).
- Working tree: only `plan.md` (status flip) and the new
  `workspace-contract.md`; no code, schema or skill files changed, so no test
  suite is applicable to this sub-task — 1.3 is expected to encode §5/§6 and
  §10.2 as fixtures/structural tests.
- No secrets, tokens or credentials in the diff.

## P2/P3 resolution (orchestrator, 2026-11-10)

- **P2-1:** A4 is now explicitly read-only outside `W`; writes remain blocked by A5/§6. A2 heading now names the workspace root, not the cwd.
- **P2-2:** `Execution status` includes `In progress`; T1 writes `In progress`, and T3 finalizes status, `Executed at` and the commit range.
- **P2-3:** `Mirrored plan path` is defined as an optional non-authoritative copy that must link back to the authoritative plan; the index execution table now has a dedicated column.
- **P3:** the consumption map now covers 2.2, 2.3, 2.4, 3.3, 3.5 and 4.2; `plan.md` links the contract; the decision-table and realpath notes were clarified.
