# Code Review Summary

**Scope**: Sub-Tasks 2.1 ("Add workspace impact to SDD and plan templates and
planning skills") and 2.5 ("Record execution provenance and architectural
changes in plan and index") of
[`docs/plans/harness-monorepo-awareness/plan.md`](../plan.md).

Files reviewed:

- `skills/dh-planning/references/phased-plan-template.md`, new
  `skills/dh-planning/references/execution-record.md`,
  `skills/dh-planning/SKILL.md`, `skills/dh-grill-sdd/SKILL.md`
- `src/tools/plan-template.ts`, `src/tools/plan-fast-template.ts`,
  `src/__tests__/workspace-plan-contract.test.ts`
- `skills/dh-execute-plan/SKILL.md`, `skills/dh-execute-plan-fast/SKILL.md`,
  `skills/dh-execute-plan-fast/references/plan-fast-template.md`,
  `skills/dh-final-review/SKILL.md`, `skills/dh-create-documentation/SKILL.md`
- `docs/plans/index.md` (header change only)

Context: `sdd.md` (R3, R9, AC3, AC9), `workspace-contract.md` §3 and §7, and the
`dh-planning` / `dh-grill-sdd` / `dh-execute-plan` / `dh-execute-plan-fast` /
`dh-final-review` / `dh-create-documentation` skills.

**Overall risk**: Medium
**Verdict**: Request changes

One P1 regression in the plan index's append behavior (the new table at EOF
captures `dh_plan_create`'s plan rows). The section contracts themselves are
complete and consistent; the remaining findings are medium/low.

## Acceptance-criteria verification

### Sub-Task 2.1

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `## Workspace Impact` after `## Scope`, outside `## Phases` | Pass | Template `phased-plan-template.md:69-76`, scaffold `src/tools/plan-template.ts:82-89`; the test asserts both placements and the phases-region exclusion (`workspace-plan-contract.test.ts:71-76, 111-126`). |
| 2 | Required table/fields | Pass | `Workspace root` + `Affected packages` bullets and `| Package | Stack | Test | Build | Docs | Version policy |` in the template, scaffold and SDD template (`dh-grill-sdd/SKILL.md:99-107`). |
| 3 | Section in the scaffold | Pass | `planScaffold` renders it (`plan-template.ts:82-89`); `buildPlanTemplate` delegates to `planScaffold` (`plan-lifecycle.ts:277-280`), so `dh_plan_create` also emits it. |
| 4 | SDD interview + template | Pass | Question at `dh-grill-sdd/SKILL.md:48-51`, template at `:99-107`, checklist at `:143-144`. |
| 5 | Standalone plans remain valid | Pass | "None — standalone repository" fallback in template/scaffold; the plan fixture without the section parses unchanged (`workspace-plan-contract.test.ts:140-148`), and this plan itself (no section) parses. |
| 6 | Fast-mode omitted lists in sync | **Partial** | Renderer, fast skill and fast reference updated (`plan-fast-template.ts:15-27`, `dh-execute-plan-fast/SKILL.md:35`, `plan-fast-template.md:92-97`); `dh-review`'s Plan Alignment Mode list was not (P2-1). |
| 7 | Legacy parser compatibility | Pass | `parsePlan(legacy)` and `parsePlan(legacy + both sections)` are equal and the legacy plan has 2 phases (`workspace-plan-contract.test.ts:133-149`); parser only reads `## Phases`/`###`/`####` (`plan-lifecycle.ts:146-214`). |
| 8 | Planning asks for affected packages when a map exists | Partial | The rule fills from the map but the interview bank has no affected-packages question (P3-1). |

### Sub-Task 2.5

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Execution Record has all 12 fields | Pass | Template `:147-161`, scaffold `plan-template.ts:126-140`, reference `execution-record.md:19-34`; test iterates all 12 names (`workspace-plan-contract.test.ts:37-50, 100-102, 117-121`). |
| 2 | After Final Integration, before Open Questions | Pass | Template/scaffold positions; test `:93-98, 117-119`. |
| 3 | Index header includes `Mirrored plan path` | Pass | `docs/plans/index.md:14-19` and `execution-record.md:45-47` match the contract §7.2; test compares byte-identical header (`:181-185`). |
| 4 | T1/T2/T3/T4 in the right skills | Pass | T1/T3 in `dh-execute-plan/SKILL.md:32-38, 82-94`; T1/T3 in fast (`SKILL.md:47-52, 152-173`); T2 in `dh-final-review/SKILL.md:28-33, 67`; T4 in `dh-create-documentation/SKILL.md:66-68`. |
| 5 | Fast-mode `source_sha256` handling explicit | Partial | T1 refresh is explicit; the T3 record edit is not covered and the gate-order wording conflicts (P2-2). |
| 6 | No duplicate index table | Pass | Exactly one `## Execution Records` heading/header (`workspace-plan-contract.test.ts:175-185`); main 7-column table unchanged. |
| 7 | Legacy plan without the section parses | Pass | Same parser-tolerance test as 2.1. |
| 8 | `dh_plan_create` append behavior unchanged | **Fail** | The index now ends with the Execution Records table, so `appendPlanIndexRow`'s `O_APPEND` writes plan rows into that table (P1-1). |

## Findings

### [P0] Blocking

None.

### [P1] High

1. **`dh_plan_create` now appends plan rows into the Execution Records table**
   - **Location**: `docs/plans/index.md:14-19` (section at EOF),
     `src/tools/plan-io.ts:43-64` (`appendPlanIndexRow`).
   - **Why it matters**: 2.5 explicitly accepts that "the main 7-column index
     table and the `dh_plan_create` append behavior remain unchanged"
     (`plan.md:387-390`), and contract §7.2 repeats it. Instead, the next
     `dh_plan_create({ updateIndex: true })` appends
     `| <title> | <slug> | <title> | <date> | <date> | Pending | Yes |` directly
     after the `## Execution Records` separator because the append is
     `O_APPEND` to the end of the file. Every cell is then read under the wrong
     header (Title→Slug, Slug→Executed in, …) and the plan never appears in the
     main `| Title | Slug | … |` table — silent corruption of the plans index
     and loss of plan discoverability.
   - **Evidence**: Reproduced against a copy of the real file — appending one
     7-cell row yields the section
     `| Slug | Executed in (repo/path) | … | Date |` / `|---…|---|` /
     `| New Plan | new-plan | New Plan | <date> | <date> | Pending | Yes |`.
     The existing append test seeds `# Plans\n` only
     (`src/mcp/__tests__/plan-tools.test.ts:170-188`), so it cannot see the
     real index shape; the new index test only inspects the static file
     (`workspace-plan-contract.test.ts:172-186`).
   - **Fix**: Make `appendPlanIndexRow` insert into the main plan table (locate
     the 7-column header + separator, append after its last data row / before
     the next `## ` heading) instead of `O_APPEND` to EOF, or move the Execution
     Records section so the plan table is last. Add a regression test that seeds
     the real two-table index and asserts the new row lands in the plan table
     and the Execution Records table is untouched.

### [P2] Medium

1. **`dh-review` Plan Alignment Mode still omits the two new sections from its
   allowed-differences list**
   - **Location**: `skills/dh-review/SKILL.md:48-59`; compare with
     `skills/dh-execute-plan-fast/SKILL.md:35` and
     `skills/dh-execute-plan-fast/references/plan-fast-template.md:92-97`.
   - **Why it matters**: 2.1's caution requires the fast-mode omitted-section
     lists to stay in sync. Three of the four copies were updated; `dh-review`
     still enumerates only the old nine sections and says "Do **not** flag
     those omitted top-level sections as missing". A plan-end alignment review
     can therefore report `## Workspace Impact` / `## Execution Record` as
     missing or unexpected from `plan_fast.md`, or at minimum loses the
     explicit protection the list exists to provide.
   - **Evidence**: The existing contract test treats all three prose files as
     one list — `src/__tests__/agent-selection.test.ts:111-120` iterates
     `dh-execute-plan-fast/SKILL.md`, its reference **and**
     `dh-review/SKILL.md`; the new test at
     `workspace-plan-contract.test.ts:216-223` iterates only the first two and
     the renderer.
   - **Fix**: Add `## Workspace Impact` and `## Execution Record` to the
     `dh-review` list and extend the new test to iterate the same three prose
     files as the agent-selection test.

2. **Fast-mode `source_sha256` is refreshed after T1 but not after T3; the
   stated gate order conflicts with the skill**
   - **Location**: `skills/dh-planning/references/execution-record.md:66-72`;
     `skills/dh-execute-plan-fast/SKILL.md:47-52, 152-173`.
   - **Why it matters**: `computeSourceSha256` filters only
     `- **Status:**` lines (`plan-fast-template.ts:50-57`), so T3's edits to
     `- **Execution status:**`, `- **Executed at:**` and `- **Commit range:**`
     also change the body. Only the T1 refresh is documented, so a fast plan
     finishes with a stale `source_sha256`; the next resume/continuation hits
     "Mismatch → **stop and ask**" (`dh-execute-plan-fast/SKILL.md:38`) for a
     sanctioned record edit. Additionally the reference says to refresh "before
     the plan-end equality gate", but Step 6 runs the `dh_plan_fast_sync`
     plan-end assertion **before** item 5 writes the record
     (`SKILL.md:134-155`), so the documented and actual orders disagree.
   - **Evidence**: record field names are not status lines; Step 7 item 3
     finalizes the record after the last documented hash refresh
     (`SKILL.md:170-173`), with no further recompute.
   - **Fix**: State that the hash/`plan_version` refresh runs after **every**
     record write (T1 and T3), align the wording with Step 6's actual order,
     and name the exact recompute command/tool so the agent does not hand-roll
     the hash.

### [P3] Low

1. **`dh-planning` does not actually ask for affected packages**
   - **Location**: `skills/dh-planning/SKILL.md:28-35, 74-84`.
   - **Why it matters**: 2.1's acceptance says "planning asks for affected
     packages when a workspace map exists". The new rule says to fill the
     section "from the map", but the map lists all packages and their commands,
     not which packages a given plan affects; the question bank has no
     workspace question. The `dh-grill-sdd` path covers this
     (`dh-grill-sdd/SKILL.md:48-51`), but a waived/legacy SDD relies on
     inference — and A8 of the contract says package scope is declared, never
     derived.
   - **Fix**: Add an interview question such as "Affected packages (when
     `WORKSPACE.md` exists)" and say the map supplies the commands, not the
     affected set.

2. **Only root `WORKSPACE.md` is recognized; the consented `docs/WORKSPACE.md`
   fallback is ignored**
   - **Location**: `skills/dh-planning/SKILL.md:28-29, 129-132, 147-150`;
     `skills/dh-grill-sdd/SKILL.md:48, 143`.
   - **Why it matters**: 1.2 permits a consented map at `docs/WORKSPACE.md`
     (`skills/dh-setup/references/workspace-map.md:80-82`). The 2.1 skills test
     only `WORKSPACE.md` at the workspace root, so a workspace that accepted
     that fallback would silently get no Workspace Impact section.
   - **Fix**: Refer to "the workspace map (`WORKSPACE.md`, or
     `docs/WORKSPACE.md` when setup wrote it there)".

3. **Fast-mode T3/T4 order is inverted relative to the contract's mandatory
   order**
   - **Location**: `skills/dh-execute-plan-fast/SKILL.md:164-173` vs
     `skills/dh-planning/references/execution-record.md:52-60`.
   - **Why it matters**: contract §7.3 lists T3 (finalize record) before T4
     (documentation close-out) as a mandatory order; the fast skill runs
     `dh-create-documentation` (T4) before finalizing the record (T3). Low
     impact because the T1 record already exists, but a strict contract check
     fails and the finalized status can precede the last record edit.
   - **Fix**: Swap the Step 7 items, or state explicitly that fast mode
     combines T3/T4 and the record is finalized last.

4. **Some new test assertions are weaker than the acceptance they claim to
   cover**
   - **Location**: `src/__tests__/workspace-plan-contract.test.ts:78-87,
     216-235`.
   - **Why it matters**: `toContain(column)` over `['Test','Build','Docs',
     'Version policy']` passes wherever the words appear; `/optional/i` passes
     on any use of "optional"; `not.toContain('## Execution Record\n')` is a
     weak negative. The link test checks only that the four skills mention
     `execution-record.md`, not that they carry the T1/T2/T3/T4 timing the
     sub-tasks require. These are low-impact because the same file also asserts
     exact placement and the exact index header.
   - **Fix**: Assert the section-local header/content (the exact
     `IMPACT_HEADER` is already defined), add `T1`/`T3` assertions for the two
     execute skills, `T2` for final-review and `T4` for documentation, and add
     the `dh-review` fast-list assertion from P2-1.

## Verified (no finding)

- Workspace Impact is outside `## Phases` in the template, scaffold and this
  review's synthetic plan; `parsePlan` ignores both new sections.
- All 12 Execution Record fields exist in the template, scaffold and reference,
  and the index header matches the contract exactly.
- T1/T2/T3/T4 instructions are present in the correct four skills (with the
  P2-2/P3-3 caveats above).
- Fast-mode omitted sections are in sync in the renderer, fast skill and fast
  reference; the generated mirror does not contain the record section.
- All 26 `skills/*/SKILL.md` files are under 250 lines (max
  `dh-setup/SKILL.md` at 248); the new test file is 236 lines.
- Tests are deterministic (static reads plus pure render/parse; fixed timestamp
  for `renderFastPlan`). `npx vitest run` → 49 files / 814 tests pass;
  `scripts/check-links.mjs` passes through `mermaid-skill.test.ts`.
- No secrets, tokens, credentials or environment values in the diff.
- No unrelated behavior change in the reviewed files: `planScaffold` and
  `FAST_OMITTED_SECTIONS` are additive; `buildPlanTemplate` still delegates to
  `planScaffold`; the main 7-column index table is untouched.

## Scope note

The working tree also contains Sub-Task 1.2/1.3 changes (`skills/dh-setup/**`,
`skills/dh-setup/references/workspace-map.md`,
`src/__tests__/workspace-anchor.test.ts`, `reports/audit.*`) and the plan/index
status lines. Those belong to other sub-tasks and were not reviewed here. The
plan currently shows 2.1 `In Progress` and 2.5 `Pending`; the implementation in
this diff appears complete apart from the findings above.

## Suggested Next Steps

- [ ] Fix P1-1 (index append) and add the two-table regression test before
      merge.
- [ ] Apply P2-1 (`dh-review` omitted list + test) and P2-2 (T3 hash refresh and
      gate-order wording).
- [ ] Consider the P3 wording/order/test-strength improvements while the files
      are still uncommitted.
- [ ] Re-run `npx vitest run`, `node scripts/check-links.mjs` and
      `pnpm run audit` after the fixes.
