---
name: dh-resume-plan
description: >
  Resume a paused phased plan from docs/plans/<slug>/handoff.md: validate the
  contract, detect drift, rehydrate context, mark the handoff resumed, and
  continue via dh-execute-plan resume mode. Use when the user says "resume the
  plan", "continue where we stopped", "pick up the plan", or "resume after a
  pause".
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Resume a paused plan safely: validate `docs/plans/<slug>/handoff.md`, detect
drift, rehydrate the session context, and re-enter the execution loop through
`dh-execute-plan`. The handoff supplements `plan.md`; `plan.md` remains the
source of truth for task status — there is no `Paused` status.

**Use when:** the user asks to resume, continue, or pick up a paused plan, or
a paused handoff exists before execution starts.

**Non-goals:** resume never reimplements the execution loop, never changes
phase/sub-task statuses during rehydration, and never treats handoff claims as
plan truth.

## Core Rules

- **No destructive git.** Never run `reset`, `stash`, `checkout`, `clean`,
  `rebase`, `revert`, or switch/create branches; never discard uncommitted
  work. Every command in this skill is read-only except the handoff edit.
- **Validate before acting.** An invalid, unparseable, or incompatible
  handoff stops the resume; never guess fields or versions.
- **Handoff-only writes.** Do not change phase/sub-task statuses during
  rehydration. Edit only the handoff's `status`, `resumed_at`, `updated`, and
  Pause History, and only when execution is about to start.
- **One plan at a time.** Multiple paused plans → list them and ask.
- **Idempotent.** A `status: resumed` handoff is consumed: report it instead
  of silently executing again.
- **Git is optional.** Unverifiable drift is surfaced and confirmed before
  proceeding; never assume a clean state.
- **No secret or diff dumps.** Summarize evidence; never include secrets or
  full diffs.
- **Delegate execution.** Do not implement or orchestrate work here — hand
  off to `dh-execute-plan`.

## Workflow

### Step 0: Resolve the handoff

1. If the user passed a slug or path, resolve it to
   `docs/plans/<slug>/handoff.md` and `plan.md`.
2. Otherwise scan `docs/plans/*/handoff.md` for `status: paused`:
   - 0 paused handoffs → report none and suggest status-based
     `dh-execute-plan` (resume mode) or `dh-planning`; stop.
   - 1 paused handoff → use it.
   - More than 1 → list slug, position, and `paused_at`, then ask; do not
     auto-pick.
3. If the requested handoff is `status: resumed`, report that it was already
   consumed and offer a fresh pause + resume only if the user wants new
   context.

### Step 1: Validate the contract

Read the handoff, `plan.md` (prefer `dh_plan_read`; manual fallback per the
phased markers), and `sdd.md` when present. Require:

- integer `handoff_version: 1`; any unknown, missing, or higher version stops
  the resume (no migration guessing);
- `plan_slug` and `plan_path` matching the requested plan and existing on
  disk;
- every frontmatter field from the template, with its documented type;
- `worktree_fingerprint` present as a lowercase 64-hex string or `null`;
  missing or unknown stops the resume, and an unavailable hash is
  `unverifiable` with confirmation;
- all 11 required sections present and non-empty;
- `status: paused`.

If any check fails, stop and report the exact failure. Offer status-based
`dh-execute-plan` only with explicit user confirmation; never repair the
handoff by guessing or migrating it.

### Step 2: Detect drift (read-only)

Collect evidence and classify it as **clean**, **explainable**, or **material**:

- **Branch:** `git rev-parse --abbrev-ref HEAD` vs `branch`; literal `HEAD`
  with a null recorded `branch` is consistent (branch unverifiable), while a
  different branch or a newly detached HEAD is material.
- **HEAD ancestry:** `git rev-parse HEAD` vs `base_commit`, then
  `git merge-base --is-ancestor <base_commit> HEAD`. When it is not an
  ancestor, material. When it is an ancestor, run
  `git diff --name-only <base_commit>..HEAD` and list
  `git log --oneline <base_commit>..HEAD` as evidence: unrelated paths are
  explainable, but any changed path intersecting the handoff's recorded
  in-flight/uncommitted paths or `plan.md` is material and must be asked
  about.
- **Worktree:** compare the path set from `git status --porcelain=v1` (minus
  the handoff and `*.tmp`) with the recorded paths first; missing, unexpected,
  or dirty-state mismatch changes are material/explainable as before. When the
  set matches, recompute `worktree_fingerprint` over those paths
  (`git hash-object` per file, `DELETED` when missing, sorted lines, SHA-256)
  and compare: any difference is material. A null/uncomputable fingerprint is
  unverifiable and requires confirmation — never clean or explainable.
- **Plan hash:** recompute `plan_sha256` and compare; a mismatch is material
  and overrides any worktree "explainable" classification for `plan.md` —
  report the overall result as material, never as merely explainable. A null
  recorded hash is unverifiable; if the hashing tool is unavailable while the
  recorded hash is non-null, mark plan integrity unverifiable and require
  confirmation before continuing.
- **Conflicts:** `git diff --name-only --diff-filter=U` reporting paths is
  material.
- **Unverifiable:** no git, `branch`/`base_commit` null, missing commits, or
  unavailable tooling → mark the check unverifiable, say so in the summary,
  and require confirmation before proceeding; never treat unverifiable as
  clean.

On material drift, present the evidence and ask: continue anyway, re-pause
with `dh-pause-plan`, or abort. Never auto-reconcile with destructive commands
and never continue silently.

### Step 3: Reconcile plan against handoff

Recompute the plan position with the same priority as `dh-execute-plan`
Step 1 (first `In Progress` phase → its first `In Progress`/`Pending`
sub-task; otherwise the first sub-task of the first `Pending` phase).

- Multiple `In Progress` phases or sub-tasks, or null `phase_index`/
  `subtask_index` with candidates in `## Current Position` → list the
  candidates and ask which one to continue; never silently take the first by
  execute-plan priority. Carry the ambiguity into the Step 4 summary.
- Handoff sub-task now `Completed` → the plan advanced: note it and use the
  plan position.
- Plan statuses moved backwards relative to the handoff → stop and ask.
- `blocked: true` or open P0/P1 findings → re-present the blocker before
  continuing.
- No remaining work → report completion and suggest `dh-final-review`.

### Step 4: Rehydrate context

Print a concise summary (do not dump the whole handoff):

- goal and current phase/sub-task;
- `progress`, completed, and in-flight work;
- uncommitted paths and unverified git checks;
- decisions, blockers, and risks;
- ambiguities from Step 3;
- validation to re-run and the ordered next steps.

Ask for confirmation only when drift was material or unverifiable (non-git
workspace, null recorded hash, or missing hashing tool), the plan and handoff
disagree, or Step 3 surfaced an ambiguous position; otherwise proceed to
Step 5.

### Step 5: Consume and delegate

When execution is about to start:

1. Verify `dh-execute-plan` is available before consuming the handoff. If it
   is unavailable, report the exact resume instruction and leave
   `status: paused` so the handoff is not consumed without execution.
2. Edit `docs/plans/<slug>/handoff.md`: set `status: resumed`, set
   `resumed_at` and `updated` to the current ISO-8601 UTC timestamp, append a
   `resumed` row to Pause History, and preserve every prior row. Do not
   rewrite the paused `## Snapshot` narrative; only these fields and the
   history row change.
3. Never touch `plan.md` statuses or any other file.
4. Invoke `dh-execute-plan` in resume mode for the slug so it continues from
   the plan position (first `In Progress` phase → first
   `In Progress`/`Pending` sub-task).

If execution pauses again, `dh-pause-plan` reopens the handoff and appends
history.

## Error Handling

- **No handoff:** report it; suggest status-based `dh-execute-plan` or
  `dh-planning`.
- **Corrupt or unparseable handoff:** stop; repair or remove the invalid
  handoff before re-pausing — `dh-pause-plan` will not overwrite it.
- **Unknown handoff version:** stop; never migrate or guess — repair or remove
  it before re-pausing.
- **Slug/path mismatch:** stop; report both values.
- **Plan missing:** stop; restore `plan.md` before re-pausing —
  `dh-pause-plan` will not write without a readable plan.
- **Already resumed:** report consumed; do not re-run silently.
- **No remaining work:** report completion; suggest `dh-final-review`.
- **Material drift:** present evidence; ask continue / re-pause / abort.
- **Non-git or unverifiable:** warn, ask for confirmation, continue only with
  consent.
- **Multiple paused plans:** list and ask; never auto-pick.
- **Handoff write failure:** stop; report the error and that execution did not
  start.

Every case stops with a concrete next action — never a destructive fix.

## Loop Integration (bundled)

Resume re-enters the harness loop at step 2 (`dh-execute-plan` resume mode).
Pause is cross-cutting and may occur at loop step 2.4 hard blockers or when a
session ends. Resume does not replace the execution loop and performs no plan
status mutation — the orchestrator owns status transitions.

## References

- [`../dh-pause-plan/references/handoff-template.md`](../dh-pause-plan/references/handoff-template.md): the `handoff.md` contract this skill validates.
- `dh-pause-plan`: writes and refreshes the handoff, including re-pause.
- `dh-execute-plan`: the execution loop resume mode this skill delegates to.
- `dh-review`: source of open P0/P1 findings that may block the resume.
- `dh-final-review`: recommended when no work remains.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
