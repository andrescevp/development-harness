# Code Review Summary

**Scope**: `parallel-plan-execution` — parallel plan schema/parser, shared scheduler contract, both orchestrators, worker modes, isolation/worktree rules, MCP/TUI readers, tests and docs (`d3d785b..HEAD`, head `3f0d3f8`).
**Packages**: `None — standalone` (repo-wide: `skills/`, `src/tools/`, `src/mcp/`, `src/tui/`, `src/__tests__/`, docs).
**Overall risk**: Medium
**Verdict**: Request changes — no P0; three P1 contract contradictions (failure drain, review fan-in vs Core Rules, fast-mode ledger ownership), plus P2/P3.

## Findings

### [P0] Blocking

None.

### [P1] High

- **Scheduler pseudocode keeps dispatching after a blocking failure**
  - **Package**: `[workspace]` — `skills/dh-execute-plan/references/parallel-scheduler.md:199-212`
  - **Why it matters**: Both orchestrators are told to follow this reference "exactly" (`skills/dh-execute-plan/SKILL.md:60`, `skills/dh-execute-plan-fast/SKILL.md:105`) and §8 requires "stop scheduling new work" (line 151). The pseudocode sets `stop_new_dispatch = true` at line 211 but never reads it; the next iteration enters `while ready and len(running) < limit:` (line 199), marks a fresh task `In Progress` (line 201) and dispatches a worker (line 202). Literal implementation violates AC6 and leaves undispatched tasks stuck `In Progress`, which resume must then reconcile.
  - **Evidence**: `stop_new_dispatch` is write-only in the whole pseudocode block; no guard on the `while` or on `mark`.
  - **Fix**: `while (not stop_new_dispatch) and ready and len(running) < limit:` and add "no `In Progress` marking for undispatched tasks" to §8 step 1.

- **`dh-execute-plan` Core Rules still require review before dispatching the next sub-task**
  - **Package**: `[workspace]` — `skills/dh-execute-plan/SKILL.md:29-30` vs `:66-75`
  - **Why it matters**: Core Rules say "After each sub-task execution, run the `dh-review` skill before proceeding to the next" and "do not continue to the next sub-task" on P0/P1. Step 2.2 dispatches up to 3 workers *before* any review, and Step 2.3 is fan-in "as workers finish". An agent obeying the higher-priority Core Rules will serialize everything (AC2 never realized) or halt dispatch once the first worker starts. Line 13's intro ("Iterate through all phases and their sub-tasks in order") reinforces the stale model.
  - **Evidence**: `:29` "before proceeding to the next" vs `:66-70` "Dispatch up to the limit (default 3 ...)"; `:13` unchanged sequential summary.
  - **Fix**: Reword `:29-30` to "Review each completed worker as it finishes; P0/P1 stops new dispatch, drains in-flight work, and leaves the task/phase open", and update the `:13` intro to the ready-set model.

- **Fast-mode ledger ownership is stated three contradictory ways; workers can double-write rows**
  - **Package**: `[workspace]` — `skills/dh-execute-plan-fast/SKILL.md:37,44,111,222` and `skills/dh-execute-plan-task-fast/SKILL.md:54-59`
  - **Why it matters**: Core Rule 37 says "The task skill records per-task rows; this orchestrator records end-level rows", and the reference at line 222 says `dh-execute-plan-task-fast` "records per-task ledger rows". But Core Rule 44 and Step 5.2 (`:111`) say the orchestrator appends the six per-task rows serially and "Workers never write status/ledger", and the worker-mode section in the task skill forbids appending. If an orchestrator follows rule 37 while the worker follows the parallel-worker section, rows are missing; if the worker follows its Core Rule 54 ("after selecting the sub-task, append its six per-task rows") in a parallel dispatch that forgot the flag, rows are appended twice — the exact race AC7 ("ledger rows are recorded once") forbids.
  - **Evidence**: `:37` vs `:44` vs `:111`; `skills/dh-execute-plan-task-fast/SKILL.md:54-59` unconditional ledger rule; worker exception only at `:92`.
  - **Fix**: State one owner: "the orchestrator writes all six per-task rows serially; the task skill never appends them." Delete the sentence in rule 37 and fix the reference at :222. Add to both task skills: "If invoked without `parallel-worker` while more than one sub-task is `In Progress`, stop without writing statuses or ledger rows."

### [P2] Medium

- **Authoritative plan template still documents single-active resume**
  - **Package**: `[workspace]` — `skills/dh-planning/references/phased-plan-template.md:262-263`
  - **Why it matters**: The canonical format contract says "Resume mode: continue the first `In Progress` phase, then its first `In Progress` / `Pending` sub-task" — exactly the behavior the feature removes (AC4; `parallel-scheduler.md:171-179`). `dh-planning` points planners here; the stale line was left directly below the newly added "Parallel metadata fields" block.
  - **Fix**: Replace with "Multiple `In Progress` phases/sub-tasks are valid; resume collects all active tasks, revalidates unreviewed work, and never closes a phase early."

- **Phase-level readiness ignores phase `Parallelizable`, losing phase serialization**
  - **Package**: `[workspace]` — `skills/dh-execute-plan/references/parallel-scheduler.md:53-66`
  - **Why it matters**: Readiness only requires a phase to be `Pending` with completed dependencies; no rule consumes phase `parallelizable`, although R1 defines it and §12's example relies on it. Because a sub-task is ready when its phase "is active (`In Progress` or **ready to start**)", any dependency-satisfied `Pending` phase qualifies, so `Parallelizable: yes` sub-tasks of a `Parallelizable: no` phase can run concurrently with another phase — silently defeating phase-level ordering.
  - **Fix**: "A phase may start only when `Parallelizable: yes`, or it is the next phase in plan order; at most one sequential (`no`) phase may be active at a time." Add the corresponding condition to the pseudocode's `phase_ready`.

- **`Files/Scope` overlap algorithm is never defined**
  - **Package**: `[workspace]` — `skills/dh-execute-plan/references/parallel-scheduler.md:111-127`
  - **Why it matters**: AC3's core guarantee ("overlapping declared scopes never run concurrently") rests on an algorithm described only as "prefix/glob". `src/tools/**` vs `src/tools/plan-*.ts` must overlap; `src/tools` vs `src/tools-extra` must not. Without a normative rule the orchestrator invents one, and a permissive matcher allows concurrent edits — the top residual risk in `plan.md:117`.
  - **Fix**: Specify: normalize separators, strip trailing `/`, overlap if one entry is a directory prefix of the other or the globs share a non-wildcard prefix segment; `**` covers everything below; unparseable entries or `None` ⇒ unknown ⇒ serialize. State that false positives (extra serialization) are preferred.

- **Scheduler/isolation tests are keyword greps only**
  - **Package**: `[workspace]` — `src/__tests__/parallel-scheduler-contract.test.ts:30-65`
  - **Why it matters**: AC8 requires tests for readiness/limit, scope conflict, worker-mode isolation, failure drain, resume, and fast mirroring. All three P1s above pass this suite because it only asserts `toContain` on words like `drain`, `3`, `8`. Only the parser/template have real assertions.
  - **Fix**: Add pure readiness/overlap helpers over `PlanDocument` (or at least a table-driven test of the documented cases) so the contract is executable; keep keyword tests as a supplement. Otherwise soften AC8's claim in `plan.md`/`sdd.md`.

- **Status bullet may appear anywhere in a section, contradicting the documented "only blank lines precede it"**
  - **Package**: `[workspace]` — `src/tools/plan-sections.ts:127-129`, `src/tools/plan-lifecycle.ts:216-223`
  - **Why it matters**: `plan-lifecycle.ts:8-9` and `phased-plan-template.md:14-21` promise the status is the first bullet with only blank lines preceding. The parser records the first matching `- **Status:**` anywhere in the section, so a status quoted in an instruction block (unfenced example, execution note) becomes authoritative and `setStatus` rewrites it. Silent wrong status on an otherwise valid plan.
  - **Fix**: Track whether any non-blank, non-status line has been seen since the header and throw (`plan line N: status bullet must be the first bullet`) or relax the docs. Enforcing is safer.

- **Parallel plans cannot be resumed through the standalone task skills**
  - **Package**: `[workspace]` — `skills/dh-execute-plan-task/SKILL.md:81`, `skills/dh-execute-plan-task-fast/SKILL.md:119-121, 206`
  - **Why it matters**: Both standalone flows stop and ask on multiple `In Progress` tasks. R7 requires standalone behavior unchanged, so this is defensible, but nothing tells the reader that a paused parallel plan must be resumed via `dh-resume-plan`/the orchestrator; a user answering "continue" will hit a stop-and-ask loop.
  - **Fix**: Add one clause to the error paths: "Multiple `In Progress` is expected for parallel plans; resume via `dh-resume-plan`/the orchestrator, not this skill."

### [P3] Low

- **Metadata errors lack line numbers** — `src/tools/plan-metadata.ts:40-53`; `where` is only `file: phase N`. Pass the matched line index from `firstValue` so authors can locate invalid values in long plans.
- **Canonical fixture mixes backtick and bare `Files/Scope` styles** — `src/__tests__/fixtures/plans/phased-plan.md` (1.2 uses `` `src/__tests__/...` ``, 2.1 uses bare paths). The template says backticks are decorative; pick one style to keep the "fixture mirrors template" cautionary point in `plan.md:237`.
- **Unclosed fences silently swallow the rest of the plan** — `src/tools/plan-sections.ts:48-68`: a fence opened but never closed marks everything after it fenced, so parsing reports "no `### Phase N:` headers" with no hint. Emit "unterminated code fence at line N" instead.

## Positive Notes (verified)

- `plan-sections.ts` region/fence scoping is correct: `## Phases` → next `##`, matching fence char/length, fenced examples ignored inside and outside the region, and `setStatus` reuses the layout so edits cannot hit an example (`plan-sections.test.ts` covers backtick, tilde, and fenced status bullets).
- AC1 holds: absent metadata → `false`/`[]`/`[]`/`shared`; `None` is case-insensitive; empty list entries and unknown `yes|no`/`shared|worktree` throw; CRLF is tolerated in every marker and preserved on edits.
- `plan_update_status` keeps multiple `In Progress` legal and still refuses `phase → Completed` while any sub-task is open (`plan-lifecycle.ts:209-214`).
- Worker-mode sections in both task skills are explicit "do not" lists, and the result envelope matches the scheduler reference.
- No secrets, tokens, or credentials in the diff; the new code is pure string/line processing with no shell interpolation or network access.

## Suggested Next Steps

- [x] Fix the three P1s before merge (drain guard, fan-in Core Rules, single ledger owner).
- [x] Fix P2s: template resume line, phase readiness, overlap algorithm, executable tests or softened AC8, status-bullet enforcement.
- [x] Re-run `pnpm vitest run src/__tests__ src/mcp/__tests__ src/tui/__tests__` and `node scripts/check-links.mjs`.

## Remediation Applied

- **P1 drain guard:** scheduler pseudocode now reads `stop_new_dispatch` in the
  dispatch loop; §8 states no `In Progress` marking for undispatched tasks.
- **P1 fan-in:** `dh-execute-plan` Core Rules and intro now describe review
  fan-in, not "review before proceeding to the next"; P0/P1 stops new dispatch
  and drains in-flight work.
- **P1 ledger owner:** fast mode states one owner — standalone task-fast records
  its rows; parallel orchestrator appends all six serially; worker mode never
  writes. Task-fast fails closed without `parallel-worker` when multiple tasks
  are active.
- **P2 resume:** the plan template now says all `In Progress` tasks are
  reconciled; no first-only resume.
- **P2 phase readiness:** a non-parallel phase must be the next phase in order
  and never overlaps another phase; parallel phases may start when deps complete.
- **P2 scope overlap:** normalization/literal-prefix/glob algorithm documented
  (`src/tools` vs `src/tools-extra` disjoint; `src/tools/**` vs
  `src/tools/plan-*.ts` overlap; `None` serializes).
- **P2 executable oracle:** added `src/__tests__/helpers/plan-scheduler.ts`
  (`phaseReady`, `subTaskReady`, `scopesOverlap`) with 8 table tests; the
  scheduler reference names it as the executable definition.
- **P2 status bullet:** template/module docs now state the first bullet is
  authoritative and should stay directly after the header; later bullets are
  not authoritative (implementation unchanged).
- **P3:** scheduler fixture style and line-number diagnostics remain follow-ups.
- **Re-verified:** 74 files / 1220 tests, typecheck, build, Biome, knip, jscpd
  (0), dependency-cruiser, links, audit PASS, smokes, OSV/Semgrep 0.
