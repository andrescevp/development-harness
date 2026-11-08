---
name: dh-pause-plan
description: >
  Pause, suspend, stop, end a session on, or hand off a phased plan: snapshot
  the active phase/sub-task, git/worktree state, decisions, blockers,
  validation, and next steps into docs/plans/<slug>/handoff.md without changing
  plan statuses or code. Use when the user says "pause the plan", "stop here",
  "end this session", "hand off", or "save progress" on an in-progress plan.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Write a durable handoff for a phased plan so the next session resumes without
re-deriving context. Pause writes `./docs/plans/<plan-slug>/handoff.md` beside
`plan.md` and changes nothing else.

**Use when:** the user asks to pause, suspend, stop, end the session, hand
off, or save progress on an in-progress plan; or loop step 2.4 hits a hard
blocker (see `dh-execute-plan-task`).

**Non-goals:** the handoff is a sidecar — `plan.md` remains the source of
truth for task status (`Pending` / `In Progress` / `Completed`). There is no
`Paused` status and no plan frontmatter flag. Pause never advances the loop,
implements work, edits code, or replaces `dh-review` / `dh-final-review`.

## Core Rules

- **Read-only for code and plan state.** Never change phase/sub-task
  statuses, never edit `plan.md` or source files, never commit, stash, reset,
  checkout, or switch branches. The only file written is
  `docs/plans/<plan-slug>/handoff.md`.
- **Commands via the `dh-execute-cli` skill.** Run every git snapshot and
  verification command through that skill; never run bash directly.
- **No secrets.** Never record secrets, tokens, credentials, API keys,
  passwords, environment values, full diffs, or file contents; record paths,
  commit ids, and one-line summaries only.
- **No invented evidence.** Record only validation and completion results
  actually observed; unrun checks are `not run`, unavailable tools are
  `unavailable`. Never fabricate a pass.
- **Never guess.** Resolve one active plan and one active position; when
  candidates are ambiguous, record the ambiguity and ask.
- **Idempotent re-pause.** Refresh the snapshot, reset `resumed_at: null`,
  append one history row, and preserve every prior history row.
- **Git is optional.** When git is unavailable, write `null` for `branch`,
  `base_commit`, and `worktree_dirty`, note it, and continue.
- **Keep it readable.** Target ≤150 lines of handoff content; summarize,
  never dump logs or large output.
- **Do not delegate implementation.** Pause collects and writes; it never
  invokes implementation or review agents.

## Workflow

### Step 0: Resolve the plan

1. If the user passed a slug or path, resolve it to
   `./docs/plans/<slug>/plan.md` and verify it exists and is readable.
2. Otherwise scan `docs/plans/*/plan.md` and classify each plan: active =
   frontmatter `status: In Progress` or any phase/sub-task `In Progress`
   (plans often keep frontmatter `Pending` while execution advances).
   - Exactly one active plan → use it.
   - Multiple active plans → list each slug with its position and ask; do
     not guess.
3. No active plan, but at least one plan exists and every plan is `Completed`
   → suggest `dh-final-review`; write no handoff.
4. No active plan, plans exist, and not all are `Completed` → list every slug
   with its frontmatter status and ask which one to pause; an explicit
   slug/path argument still resolves directly. Never auto-pick.
5. No plans at all → suggest `dh-planning`; stop.

### Step 1: Read the plan and locate the position

Use `dh_plan_read` (`{ slug }` → structured JSON: meta, phases, subTasks).
Fallback when the tool is unavailable: read `plan.md` manually with the phased
markers (`## Phases` → `### Phase N:` → `#### Sub-Task N.M:` and the first
`- **Status:**` bullet). These tools are exposed by the project-scope `dh` MCP
server; under Code Mode they are called as `tools.dh.<tool>`, and `dh_<tool>`
is the tool's normalized name (permission actions match `dh_*`).

Compute:

- phase and sub-task counts (total and `Completed`); `progress` is the
  sub-task ratio `"completed/total"`.
- current position with the same priority as `dh-execute-plan` Step 1:
  1. first `In Progress` phase → its first `In Progress` or `Pending` sub-task;
  2. otherwise the first sub-task of the first `Pending` phase;
  3. otherwise (all sub-tasks `Completed`) no pause is needed — suggest
     `dh-final-review`.
- the next sub-task in order and the active sub-task's remaining work.

If multiple phases or multiple sub-tasks are `In Progress`, record the
candidates explicitly in `## Current Position` and null the ambiguous index
fields instead of guessing; ask the user when the next action depends on it.
If the plan has no phases/sub-tasks or unrecognized statuses, stop and report.

### Step 2: Collect read-only evidence

Run only read-only commands; never capture full diffs or file contents.

- Git (optional): `git rev-parse --abbrev-ref HEAD` (branch — if it returns
  `HEAD`, the repository is detached: set `branch: null` and record the short
  SHA in `## Snapshot`, never the literal `HEAD`), `git rev-parse HEAD`
  (`base_commit`), `git status --porcelain=v1`, `git diff --stat`,
  `git log --oneline -5`. Exclude the handoff being written
  (`docs/plans/<slug>/handoff.md`) and atomic-write `*.tmp` files from the
  path list; `worktree_dirty` reflects the remaining paths. If the handoff is
  the only untracked path, record `worktree_dirty: false` — the handoff is
  the artifact, not in-flight work.
- `worktree_fingerprint`: over the non-handoff, non-`*.tmp` paths, build
  `status<TAB>path<TAB>content-hash` lines (`git hash-object -- <path>` for
  existing files, `DELETED` when missing), sort them, SHA-256 the
  newline-joined block, and record lowercase 64-hex; `null` when git or a
  hashing tool is unavailable (path set/content unknown). For an untracked
  directory entry (`?? dir/`), expand it with
  `git ls-files --others --exclude-standard -- <dir>/` and hash each file,
  using a deterministic `DIR_EMPTY` sentinel when empty; record the expanded
  file paths (not the directory) in the path list so resume compares the same
  set. Refresh it on re-pause from current content.
- `plan_sha256`: `sha256sum docs/plans/<slug>/plan.md` or
  `shasum -a 256 docs/plans/<slug>/plan.md`; `null` when neither exists.
- Integrity snapshot: when `plan_sha256` is `null` (or always, as a cheap
  check), capture `git status --porcelain -- docs/plans/<slug>/plan.md` as a
  pre-write snapshot. If git is also unavailable, mark integrity
  `unverifiable` and say so in `## Validation State` / `## Resume Checklist`.
- Review: read `docs/plans/<slug>/tasks/review.md` when present; list open
  P0/P1 findings by id with the review path, note P2/P3 without copying text.
- SDD: when `docs/plans/<slug>/sdd.md` exists, record the binding constraint
  ids that affect continuation (path + ids only).
- Validation state: commands and observed outcomes from this session;
  everything else is `not run` / `unavailable`.

### Step 3: Compose the handoff

Write `./docs/plans/<slug>/handoff.md` following
[`references/handoff-template.md`](references/handoff-template.md) exactly —
do not restate or extend the contract here.

- Frontmatter: every field in the template table, with `handoff_version: 1`,
  `status: paused`, `resumed_at: null`, `updated` = `paused_at` (ISO-8601
  UTC), `created` preserved on re-pause, `worktree_fingerprint` refreshed from
  current content like `worktree_dirty`, and `next_action` equal to
  `## Next Steps` step 1. Quote timestamps and `subtask_index`.
- Sections: `## Snapshot`, `## Current Position`, `## Work Completed`,
  `## Work In Flight`, `## Uncommitted Changes`,
  `## Decisions and Rationale`, `## Blockers and Risks`,
  `## Validation State`, `## Next Steps`, `## Resume Checklist`,
  `## Pause History`.
- `blocked: true` only for a hard blocker or open P0/P1 finding; explain it in
  `## Blockers and Risks`.
- Uncommitted changes: paths grouped modified/added/deleted/untracked
  (directories expanded to files) with a one-line purpose, excluding
  `docs/plans/<slug>/handoff.md` and `*.tmp`; `None` when clean,
  `Unverifiable` without git.
- Re-pause: regenerate the changeable body sections (`## Work In Flight`,
  `## Uncommitted Changes`, `## Blockers and Risks`, `## Validation State`,
  `## Next Steps`, `## Current Position`, `## Snapshot`) from current state;
  keep `created` and every Pause History row; preserve `## Work Completed`
  and `## Decisions and Rationale` entries unless they changed. Never delete
  history.
- History: a brand-new handoff appends a `paused` row; refreshing an existing
  `paused` handoff appends `re-paused`; a pause after a prior resume reopens
  the cycle (keep `created`) and appends `re-paused`. Keep every prior row —
  never delete, reorder, or rewrite history.

### Step 4: Validate before reporting

1. Frontmatter parses as YAML with exactly the template fields and types,
   `handoff_version: 1`, `status: paused`, `resumed_at: null`,
   `plan_slug` / `plan_path` matching the plan directory, and
   `worktree_fingerprint` as a lowercase 64-hex string or `null`; when `null`,
   state that content drift is `unverifiable` — never fabricate it.
2. All 11 required sections are present and non-empty.
3. Plan integrity: recompute the SHA-256 of `docs/plans/<slug>/plan.md` and
   compare it with the Step 2 `plan_sha256`. When both are non-null they must
   match; a mismatch is a hard stop — never claim success. Optionally snapshot
   `git status --porcelain -- docs/plans/<slug>/plan.md` before and after the
   write and record pre-existing dirtiness as evidence; never require the file
   to be clean — active sub-task markers and untracked plan files legitimately
   show up there. If hashing is unavailable and a pre-write snapshot exists,
   compare the pre/post porcelain snapshots. Otherwise (hashing unavailable
   and no pre-write snapshot, or git unavailable too), mark integrity
   `unverifiable` in `## Validation State` and `## Resume Checklist` and never
   claim the plan is unchanged.
4. Secret scan — inspect every hit and redact real values before continuing
   (generic prose about secrets is expected):
   `rg -ni "api[_-]?key|secret|password|bearer\s|token|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY" docs/plans/<slug>/handoff.md`

Fix issues by editing only the handoff; never commit, checkout, revert, or
touch `plan.md`. Re-run every check before reporting and never report a check
you did not run.

### Step 5: Report

Report concisely:

- handoff path and pause timestamp;
- active phase/sub-task and `progress`;
- `blocked` state and open findings (ids only);
- the exact resume instruction: run `dh-resume-plan` for
  `docs/plans/<slug>/plan.md` (slug: `<slug>`);
- every ambiguity, unavailable tool (git, hashing), or redaction applied.

If `dh-resume-plan` is not installed in this environment, say so and stop —
do not resume by editing plan statuses.

## Error Handling

- **No plan found:** suggest `dh-planning`; write nothing.
- **Multiple active plans:** list them with positions and ask; do not guess.
- **Plan deleted or unreadable:** stop, report the path; write nothing.
- **Invalid existing handoff** (unparseable YAML, missing `handoff_version`, or
  an unknown version): stop and report — never overwrite or migrate it.
- **Write failure:** report the error and whether a partial file exists; never
  claim a handoff was written.
- **Non-git workspace:** record `null` git fields, note it in `## Snapshot`,
  and continue; resume degrades to `plan_sha256` plus file evidence.
- **Already-completed plan:** suggest `dh-final-review`; no handoff.
- **Ambiguous position:** record candidates in `## Current Position`.
- **Secret found:** write `[redacted]`, note it in `## Snapshot`, re-run the
  scan.

## Loop Integration (bundled)

Pause is a cross-cutting lifecycle skill, not a loop step: it can run at any
point and never advances the loop or changes statuses. Use it especially at
loop step 2.4 hard blockers or when a session ends mid-plan. Resume returns to
`dh-execute-plan` resume mode (first `In Progress` phase → its first
`In Progress`/`Pending` sub-task). Pause does not replace `dh-review`, the
orchestrator's phase lifecycle, or `dh-final-review`.

## References

- [`references/handoff-template.md`](references/handoff-template.md): the `handoff.md` contract (fields, sections, lifecycle, redaction).
- `dh-execute-plan`: position priority and resume mode this skill mirrors.
- `dh-resume-plan`: consumer that validates the handoff and re-enters execution.
- `dh-review`: source of open P0/P1 findings recorded in the handoff.
- `dh-final-review`: recommended when the plan is already complete.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
