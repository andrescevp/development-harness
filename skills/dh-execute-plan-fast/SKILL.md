---
name: dh-execute-plan-fast
description: >
  Fast or rapid plan execution: run every sub-task from the plan_fast.md mirror with no per-task gates; all end gates — alignment review, simplify, code-review, domain-check when architectural, preflight, artifact-check, final review, docs/evolution notes, and semver — run once across Steps 6–7. Use when the user says 'execute plan fast', 'run fast mode', 'finish the plan quickly', or asks to execute from plan_fast.md with end-of-plan verification.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Orchestrate **fast** execution of a plan. The outcome matches
`dh-execute-plan` — every phase/sub-task implemented, verified, documented, and
signed off — but per-task gates are removed and every critical gate runs once
across Steps 6–7.

- `./docs/plans/<plan-slug>/plan.md` — **scope truth**: requirements, scope,
  acceptance criteria, done-when. Content is frozen; only statuses are mirrored.
- `./docs/plans/<plan-slug>/plan_fast.md` — **execution mirror**: integrity
  hash, fast policy, verbatim `## Phases` region, and final verification.
- `./docs/plans/<plan-slug>/plan_fast_skip_checks.md` — **append-only skipped
  check ledger** (contract: [`references/plan-fast-skip-checks.md`](references/plan-fast-skip-checks.md)).

Fast tools: `dh_plan_fast_create`, `dh_plan_fast_read`,
`dh_plan_fast_update_status`, `dh_plan_fast_sync`, `dh_plan_fast_skip_check` —
MCP tools on the project-scope `dh` server (Code Mode:
`tools.dh.plan_fast_*`). Fall back to the references only when unavailable.

## Core Rules

- Create a feature branch per plan execution; if not on one, ask before any change. In monorepos with submodules, branch each submodule in alignment.
- Read `plan.md` first with `dh_plan_read` (`{ slug }`). Fallback: manual read following the phased markers (`## Phases` → `### Phase N: <title>` → `#### Sub-Task N.M: <title>` with `- **Status:**` bullets). Missing → stop and suggest `dh-planning`.
- **Paused handoff:** if `handoff.md` is `status: paused`, stop and redirect to `dh-resume-plan`. Resume defaults to standard; after it marks the handoff `resumed`, re-enter **fast mode** when `plan_fast.md` exists.
- **Scope freeze + allowed differences:** never change `plan.md` scope, requirements, acceptance criteria, or done-when. The mirror may differ only by (a) omitted top-level sections — `## Objective`, `## Requirements Snapshot`, `## Scope`, `## Assumptions and Constraints`, `## Risks and Areas Requiring Care`, `## Core concepts`, `## Visual Context`, `## Agent Selection`, `## Open Questions`; (b) fast sections — `## Fast Execution Policy`, `## Alignment Contract`, `## Final Verification`; and (c) status progression. Use `plan.md` for every requirements/scope check.
- **Dual status is mandatory.** Every phase/sub-task change goes to **both plans** via `dh_plan_fast_update_status` (`{ slug, target, index, status }`; normalized `dh_plan_fast_update_status`, Code Mode `tools.dh.plan_fast_update_status`), which applies both writes and reverts on a failed mirror write. Fallback: manual dual edits with retry/revert. Never update only one plan.
- **Skip-check ledger:** append every skipped, deferred, or not-applicable standard check to `plan_fast_skip_checks.md` via `dh_plan_fast_skip_check` (append-only, never delete). The task skill records per-task rows; this orchestrator records end-level rows.
- **Integrity hash:** record `source_sha256` at creation — SHA-256 of the `plan.md` body (after the closing frontmatter) with every line whose trimmed form starts with `- **Status:**` deleted. Recompute at startup, resume, Step 4, and Step 6; validate `slug` and `source_plan: plan.md`. Mismatch → **stop and ask**; never auto-adopt. Only a pre-execution transcription fix (hash matches but structure/fields disagree, statuses excluded) may be done with confirmation; any realignment bumps `plan_version`.
- **Phase-close sweep:** before selecting a sub-task, at Resume start, and before Step 6, close in both files any phase whose sub-tasks are all `Completed` (the tool refuses while a sub-task is open).
- **No per-task gates.** Do not run `dh-review`, `dh-simplify`, `dh-code-review`, `dh-preflight`, `dh-artifact-check`, or `dh-domain-check` between sub-tasks; the task skill keeps only a narrow implementation sanity check.
- **Critical gates:** pre-execution alignment in Step 4; all end gates once in Steps 6–7 — plan-end alignment, `dh-simplify` + `dh-code-review` (software), `dh-domain-check` (architectural software plans), `dh-preflight` + `dh-artifact-check`, `dh-final-review`, `dh-create-documentation`, `dh-semver` (software).
- **Alignment:** `dh_plan_fast_sync` dry-run for structural/status differences plus `dh-review` Plan Alignment Mode — `phase: pre-execution` → `tasks/review-fast.md`, `phase: plan-end` → `tasks/review-fast-final.md`. Never write `tasks/review.md`.
- **Selection:** phases in order; within the active phase, **In Progress first**, then the first `Pending`. Out-of-order statuses → ask, never silently resume the earlier task.
- **Agent selection:** take the implementation, review, final-review, and documentation roles from `plan.md`'s `## Agent Selection` (the mirror intentionally omits the section). Absent, incomplete, or stale → run [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md) before executing; re-validate availability at startup and on resume; never substitute silently. One implementation agent per sub-task — no complexity- or type-based split.
- **Project type, once:** `package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, `CMakeLists.txt`, `setup.py`, `setup.cfg`, `Gemfile`, `project.clj`, `deps.edn`, `mix.exs`, `pubspec.yaml`, `Build.scala`, `build.gradle`, `*.csproj`, `*.sln`. Record it once for end gates; it never changes who implements (the selected implementation agent).
- **Frontmatter lifecycle:** `status: In Progress` in both plans when the first sub-task starts; `Completed` in both at close; bump `plan_version` on realignment.
- Update `./docs/plans/index.md` only when complete, then run `dh-create-documentation` (docs + evolution/observation notes).

## Workflow

### Step 0: Create the feature branch

Apply the feature-branch rule before any change; if the user declines, stop.

### Step 1: Read the plan

Read `plan.md` via `dh_plan_read` (`{ slug }`; fallback: manual). Missing → stop
and suggest `dh-planning`.

### Step 2: Paused-handoff guard

When `handoff.md` is `status: paused`, stop and redirect to `dh-resume-plan`.
Do not create or execute the mirror until it is `resumed`; then re-enter this
skill.

### Step 3: Ensure the fast mirror and ledger exist

- **Missing:** call `dh_plan_fast_create` for the slug — it creates
  `plan_fast.md` (verbatim `## Phases`, copied verification items, `source_plan`,
  `source_sha256`, `plan_version: fast-1`, plan-level `status`) **and seeds
  `plan_fast_skip_checks.md`**. Manual fallback: follow
  [`references/plan-fast-template.md`](references/plan-fast-template.md) and
  [`references/plan-fast-skip-checks.md`](references/plan-fast-skip-checks.md).
  Do not edit `plan.md`.
- **Exists:** call `dh_plan_fast_read` and confirm `source_sha256`, `stale:
  false`, the skip-checks path, `slug`, and `source_plan`. Stale, mismatched,
  or unparseable → stop and ask. If only the ledger is missing, recreate it
  from the ledger reference (seed rows) without touching `plan_fast.md`. A
  **confirmed realignment** rebuilds `## Phases` (preserving `Completed` only for
  unchanged IDs/titles), recopies verification items, bumps `plan_version`,
  recomputes the hash, and re-runs Step 4.
- **Transcription fix (pre-execution only):** hash matches but structure or
  field content disagrees (statuses excluded) → confirm, fix, bump
  `plan_version`, re-run Step 4.

### Step 4: Pre-execution alignment review

Run `dh_plan_fast_sync` in **dry-run** mode for structural/status differences
and invoke `dh-review` Plan Alignment Mode with `phase: pre-execution`
(report: `tasks/review-fast.md`). **Both must pass**: no structural difference
and no P0/P1 finding. The mirror may be ahead of `plan.md` only in statuses;
`plan.md` ahead is a finding. On failure, fix `plan_fast.md` only (never rewrite
`plan.md` scope), bump `plan_version` if content changed, and re-run both.

### Step 5: Fast execution loop

At loop start run `dh_plan_fast_sync`: dry-run, then apply **fast→plan only**;
`plan.md` ahead → stop and ask, never rewind. Phase-close sweep, resolve the
implementation/review/final-review roles from `plan.md`'s `## Agent Selection`
(absent or stale → selection protocol), re-validate availability, then read
`plan_fast.md` via `dh_plan_fast_read` and select:

1. First `In Progress` phase → its first `In Progress` sub-task, else its first
   `Pending` sub-task.
2. Otherwise the first `Pending` sub-task of the first `Pending` phase.
3. All sub-tasks `Completed` → Step 6.
4. Multiple `In Progress` phases, or out-of-order sub-tasks → stop and ask.

For each selected sub-task:

1. Mark it `In Progress` with `dh_plan_fast_update_status`
   (`{ slug, target: "subtask", index: "N.M", status: "In Progress" }`), which
   updates both plans and reverts on mirror failure. On a phase's first
   sub-task also set the phase `In Progress` and the plan frontmatter
   `status: In Progress` in both files. Fallback: manual dual edit with
   retry/revert; never one plan.
2. Invoke `dh-execute-plan-task-fast`; it implements the work, records the six
   per-task ledger rows, and marks the sub-task `Completed` via the same tool.
3. When ALL sub-tasks of the phase are `Completed`, close the phase in both
   files via `dh_plan_fast_update_status` (idempotent if the task skill already
   did).
4. Repeat; run **no** per-task review, simplify, code-review, preflight,
   artifact-check, or domain-check. Record any end-level skip/not-applicable
   decision with `dh_plan_fast_skip_check`.

### Step 6: End-of-plan critical verification

Run `dh_plan_fast_sync` with `phase: 'plan-end'` as a **dry-run equality
assertion** and require `aligned: true`; plan-end never applies or writes. If
not aligned, fix statuses via `dh_plan_fast_update_status` (or manual dual
edit), then re-run until aligned. Structure/P0 differences or a stale
`source_sha256` are stop-and-ask conditions: recreate/realign the mirror,
never fix them with status edits. Then run `dh-review` Plan Alignment Mode with
`phase: plan-end` → `tasks/review-fast-final.md`; both must pass.
Run the gates once, in order:

1. **Plan-specific verification:** execute the System-Wide Test and Completion
   Checklist items copied into `## Final Verification`; report each result.
2. **Simplify + code review (software only):** `dh-simplify` + `dh-code-review`
   on the full plan diff; if skipped, append the ledger row.
3. **Domain check (conditional):** `dh-domain-check` only for architectural
   multi-module software plans; otherwise append `not applicable`.
4. **Preflight + artifact check:** `dh-preflight` + `dh-artifact-check`.
5. **Final review:** `dh-final-review`, instructed to reuse the alignment and
   gate results above and not re-run preflight, artifact-check, or semver.
6. **Ledger outcomes:** append every gate outcome (`run: PASS/FAIL` or
   `not applicable`) via `dh_plan_fast_skip_check`, then report the skip-checks
   path and any **unresolved** ledger rows.
7. **Any P0/P1:** stop, fix, re-run the failing gate, then every downstream gate.

### Step 7: Close the plan

1. **Documentation:** `dh-create-documentation` to update project docs and write
   `docs/evolution/<date>-<slug>.md` + `docs/evolution/observations/<date>-<hhmm>-<slug>.md`.
2. **Version bump (software only):** `dh-semver` **once**; backfill the
   version/tag into the evolution note and index entry.
3. **Mark complete:** `status: Completed` in both plans (all phases/sub-tasks
   `Completed` in both), then update the `./docs/plans/index.md` row.
4. **Report:** both plan paths, skip-checks path, dual-status confirmation, both
   alignment verdicts, each end gate outcome, unresolved ledger rows,
   plan-specific results, final review verdict, P2/P3 findings, docs paths,
   version bump, readiness for merge.

## Resume Mode

- Phase-close sweep and `dh_plan_fast_sync`; then read via `dh_plan_fast_read`
  and continue from the first `In Progress` phase → its first `In Progress`
  sub-task, else its first `Pending`; otherwise the first `Pending` phase.
- Recompute `source_sha256`; mismatch → stop and ask. `plan.md` ahead → ask;
  never rewind.
- Never re-run `Completed` sub-tasks; resume an interrupted `In Progress` task.
- Mirror or ledger missing → Step 3. Paused handoff → `dh-resume-plan`, then
  re-enter fast mode after it marks the handoff `resumed`.
- Before stopping on a blocker, run `dh-pause-plan`; resume later with
  `dh-resume-plan` (standard by default, fast when the mirror exists).

## Error Handling

- **Missing `plan.md` / `plan_fast.md`:** stop / create via Step 3; never execute
  from `plan.md` alone.
- **Hash mismatch, stale mirror, corrupt ledger:** stop and ask; realign only
  with confirmation and `plan_version` bump.
- **Alignment or sync failure:** fix the mirror only; re-run both checks.
- **Multiple `In Progress` / out-of-order:** stop and ask.
- **Status write failure after revert:** stop; never leave the plans diverging.
- **Sub-task failure:** task skill stops after 3 validation failures; do not
  advance; recommend `dh-pause-plan`.
- **Final gate failure:** fix, re-run it and every downstream gate.
- **Unresolved ledger rows at close:** report them; a required gate without an
  outcome row blocks the close.

## Loop Integration (bundled)

Fast execution is an **alternative** to the standard per-task loop:

| Fast mode | Standard loop |
|---|---|
| Step 5 (`dh-execute-plan-task-fast`) | 2.1 `dh-execute-plan-task` |
| Step 6 sync + alignment + simplify + code-review + domain-check | 2.2–2.3 (once, plan-wide) |
| Step 6 preflight + artifact-check | 3 |
| Step 6 final review | 4 |
| Step 7 docs + semver | 5 |

**Step 2.4 still applies.** Three consecutive validation failures, unresolved
P0/P1 findings, or missing preconditions halt automation: report and ask. Never
mark sub-tasks/phases `Completed` around a blocker or skip a delayed gate.

## References

- [`references/plan-fast-skip-checks.md`](references/plan-fast-skip-checks.md): ledger contract and manual fallback.
- [`references/plan-fast-template.md`](references/plan-fast-template.md): `plan_fast.md` contract.
- [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md): agent-selection protocol (implementation, review, final-review, documentation roles).
- Fast tools: `dh_plan_fast_create`, `dh_plan_fast_read`, `dh_plan_fast_update_status`, `dh_plan_fast_sync`, `dh_plan_fast_skip_check`.
- `dh-execute-plan-task-fast`: executes one sub-task and records per-task ledger rows.
- `dh-review`: Plan Alignment Mode (`phase: pre-execution | plan-end`).
- `dh-simplify` / `dh-code-review` / `dh-domain-check`: plan-wide gates.
- `dh-preflight` / `dh-artifact-check` / `dh-final-review` / `dh-create-documentation` / `dh-semver`: end gates.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
