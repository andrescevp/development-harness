---
title: Workspace Contract — Roots, Anchoring and Execution Provenance
slug: harness-monorepo-awareness-workspace-contract
description: Authoritative contract for workspace root, package root, plan root and vault root; start-at-workspace-root anchoring rules, mismatch failure behavior, execution provenance and the standalone fallback.
tags: [contract, harness, workspace, monorepo, plans, r1, r9]
project: dev-harness-skills
plan: docs/plans/harness-monorepo-awareness/plan.md
created: 2026-11-10
updated: 2026-11-10
status: active
---

# Workspace Contract — Roots, Anchoring and Execution Provenance

Authoritative contract for sub-tasks 1.1–4.3 of [`plan.md`](plan.md) (R1, R9)
and [`sdd.md`](sdd.md). It fixes the **user-approved decision**: the
workspace-root `docs/plans` is the **only** plan root; package-local
`docs/plans` directories are **not supported** and are referenced by the
execution record instead.

**MUST / MUST NOT** are binding; **SHOULD** is a default overridable only by an
explicit, recorded user decision. Implementation-agnostic: the `dh` MCP tool
schema does not change.

## 1. Definitions

| Term | Definition | Owns |
|---|---|---|
| **Workspace root** (`W`) | The repository containing all nested projects: it holds `docs/plans`, the root `AGENTS.md`, the `dh` MCP entry and the root `WORKTREE_LIFECYCLE.md`. | Plan root, default vault root, workspace map, shared config/rules, root docs. |
| **Package root** (`P`) | A nested project in `W`: workspace package (`apps/web`, `services/api`, `packages/core`), submodule, nested standalone repo, or a worktree of these. | Its stack, commands, optional `CODE_RULES.md`, package docs, and its own `WORKTREE_LIFECYCLE.md` when it is an independent repo. |
| **Plan root** | Directory holding `docs/plans/<slug>/plan.md`, `sdd.md`, `tasks/`, `diagrams/`, `handoff.md`, `index.md`. | Exactly one value: `W`. |
| **Vault root** | Obsidian vault: `W` by default (when `git rev-parse --show-toplevel` agrees); `OBSIDIAN_VAULT` may override. | `<vault>/docs` only — never the plan root. |
| **Affected packages** | Workspace packages a plan/sub-task changes: they drive the command matrix, diff scope and review scope. | Declared in `## Workspace Impact` (sub-task 2.1), never "all packages". |

Root-level shared artifacts (`docs/`, `docs/plans`, `AGENTS.md`, root
`CODE_RULES.md` defaults, workspace config, root `WORKTREE_LIFECYCLE.md`) are
workspace-owned; package-owned artifacts never move above `P`.

## 2. Current implementation (evidence)

- **MCP root:** `DH_WORKSPACE_ROOT` when non-blank (trimmed), else the process
  cwd; a relative override resolves against that cwd; a blank cwd throws
  (`src/mcp/workspace.ts:20-36`).
- **Per-connection resolution:** the root is resolved once per connection and a
  server is built per connection (`src/mcp/stdio.ts:4-5,51-59,71-77`).
- **Plan anchor:** always `<workspaceRoot>/docs/plans`, never a process-cwd
  fallback (`src/tools/plan-paths.ts:10-18,25-28,36-53`; `src/mcp/server.ts:27`).
- **Host behavior:** the anchor is the process cwd — *the project directory
  opencode starts the server in* — overridable with
  `"environment": { "DH_WORKSPACE_ROOT": "/absolute/workspace" }`
  (`docs/LOADING.md:230-232`); plan I/O is anchored under
  `<workspace>/docs/plans` and escapes are rejected (`docs/LOADING.md:264-268`).
- **Skill anchor:** planning writes `./docs/plans/<slug>/plan.md` and may touch
  only `./docs/plans/...`, `diagrams/**` and `./docs/plans/index.md`
  (`skills/dh-planning/SKILL.md:13,18,53,98,104`).
- **Vault anchor:** vault = project root (`git rev-parse --show-toplevel`), docs
  under `{project_root}/docs`, `OBSIDIAN_VAULT` override
  (`skills/dh-create-documentation/SKILL.md:4,89,220,229-232`).
- **Setup anchor:** setup targets "the current workdir or the given project"
  (`skills/dh-setup/SKILL.md:87`), checks the vault at the project root
  (`:47-49`) and wires the `dh` server **without** an `environment` block
  (`:116-130`); `WORKTREE_LIFECYCLE.md` and `docs/architecture` resolve at
  `{project_root}` (`:133-136,173-175`).

**Gap:** the MCP honors an override while skills resolve `./…` against their
session base — two rules for one path. That is the split this contract removes.

## 3. Decision: one plan root

1. `W/docs/plans` is the only plan root; `dh_*` tools and every skill MUST
   address the same directory.
2. `P/docs/plans` MUST NOT be created, scaffolded, or treated as a plan root —
   not even when `P` is an independent git repo, submodule or worktree.
3. Nested projects, submodules and worktrees are referenced by the execution
   record (§7) and the workspace map, never by a second plan tree.
4. An existing `P/docs/plans` is foreign/legacy: report it, do not write to it,
   do not delete it without explicit user confirmation.
5. SDDs, reviews, diagrams, handoffs and the index follow the plan root; none
   may be package-local.

## 4. Normative anchor rules

- **A1 — Start at the workspace root.** Every monorepo session MUST start
  OpenCode at `W`; the `dh` server cwd and the skill-relative base are that same
  project directory (`docs/LOADING.md:230-231`, `src/mcp/stdio.ts:71-77`).
- **A2 — Override equals the workspace root (absolute), or is unset.**
  `DH_WORKSPACE_ROOT` MUST be the absolute path of `W` when set; relative
  values MUST NOT be used (they depend on the cwd: `src/mcp/workspace.ts:33-35`).
- **A3 — Two sides, one directory.** MCP and skill resolution MUST agree after
  realpath normalization; a symlinked workspace is acceptable to the MCP
  (`src/tools/plan-paths.ts:55-61`), so comparisons MUST use `pwd -P`.
- **A4 — Skills never use bare `./docs/plans` outside `W`.** With a different
  session base, skills MUST resolve plans against the absolute workspace root
  **for read-only inspection only**; writes are blocked by A5/§6 unless cwd is
  `W` (or the override normalizes to it). `./docs/plans` is shorthand valid
  only when cwd = `W`.
- **A5 — Mismatch stops writes.** Any unresolved mismatch MUST fail loudly (§6)
  before the first write; read-only inspection is the only behavior a user may
  explicitly authorize under mismatch.
- **A6 — Plan I/O provider unchanged.** The `dh` MCP server owns plan I/O;
  skills use its tools when available and manual edits under the same anchor
  otherwise (`skills/dh-planning/SKILL.md:103`, `docs/LOADING.md:264-268`).
- **A7 — Vault is independent of the plan root.** `OBSIDIAN_VAULT` moves docs
  only; it MUST NOT move `docs/plans`
  (`skills/dh-create-documentation/SKILL.md:220`).
- **A8 — Package scope is declared, not derived from cwd.** Affected packages
  come from `## Workspace Impact`, never from the shell's location.
- **A9 — Standalone is the identity case.** No markers → `cwd = W = P = plan
  root` and today's behavior is preserved (§8).

## 5. Decision table — cwd × `DH_WORKSPACE_ROOT`

`W` = workspace root, `P` = package nested in `W`, `S` = standalone repo root;
"Skill dir" is where a skill's relative `./docs/plans` resolves.

| # | cwd | `DH_WORKSPACE_ROOT` | MCP plan dir | Skill dir | Verdict |
|---|---|---|---|---|---|
| 1 | `W` | unset | `W/docs/plans` | `W/docs/plans` | **OK — canonical** |
| 2 | `W` | `W` (absolute) | `W/docs/plans` | `W/docs/plans` | OK — redundant but valid |
| 3 | `W` | absolute `X ≠ W` | `X/docs/plans` | `W/docs/plans` | **Mismatch — stop** (§6.1) |
| 4 | `W` | relative (`../x`) | `resolve(cwd, value)` | `W/docs/plans` | **Reject — relative override** (A2; a coincidental resolve to `W` does not validate it) |
| 5 | `P` | unset | `P/docs/plans` | `P/docs/plans` | **Consistent but wrong root — stop** (§6.2) |
| 6 | `P` | absolute `W` | `W/docs/plans` | `P/docs/plans` | **Split — stop** (§6.1) |
| 7 | `P` | relative → `W` | `W/docs/plans` | `P/docs/plans` | **Split — stop** (A2, §6.1) |
| 8 | `S` | unset | `S/docs/plans` | `S/docs/plans` | OK — unchanged today |
| 9 | `S` | `S` (absolute) | `S/docs/plans` | `S/docs/plans` | OK |
| 10 | `S` | absolute `X ≠ S` | `X/docs/plans` | `S/docs/plans` | **Mismatch — stop** (§6.1) |

- Row 5 **passes** an "MCP equals skill" check and still violates §3: the check
  MUST compare against the expected `W`, not only the two sides against each
  other.
- Rows 3, 4, 6, 7, 10 are the audit risk "setting `DH_WORKSPACE_ROOT` without
  starting at the workspace root can still split paths" (`plan.md:88-90`). No
  override repairs a session that did not start at `W`; only restarting there
  does.
- A `cd` inside a shell command moves only that command — never the server
  anchor, and never a legitimate way for a skill to "relocate" the workspace.

## 6. Mismatch behavior

### 6.1 Anchor mismatch (two different plan dirs)

```text
[workspace-anchor-mismatch]
  mcp_workspace_root:  /repo
  session_cwd:         /repo/apps/web
  mcp_plan_dir:        /repo/docs/plans
  skill_plan_dir:      /repo/apps/web/docs/plans
  resolution:          restart opencode at /repo; keep DH_WORKSPACE_ROOT unset
                       or set it to /repo (absolute). Do not write under
                       /repo/apps/web/docs/plans.
```

Name both roots and both plan dirs, state the remediation, write nothing, and
never "repair" the split by creating the missing plan directory.

### 6.2 Wrong plan root (both sides agree, root is a package)

```text
[plan-root-not-workspace-root]
  session_cwd:            /repo/apps/web
  plan_dir:               /repo/apps/web/docs/plans
  likely_workspace_root:  /repo            (marker: pnpm-workspace.yaml / WORKSPACE.md)
  resolution:             restart opencode at /repo and re-read the plan there;
                          package-local docs/plans is not supported.
```

### 6.3 The only confirmation exception

A mismatch MAY proceed **read-only** when the user explicitly authorizes it: the
report still lists both roots and no plan/doc/status write occurs. Write
operations are never authorized under mismatch — the answer is always "restart
at `W`".

## 7. Execution provenance

Every executed plan records where the work really happened, so the single plan
root stays auditable across nested repos, submodules and worktrees.

### 7.1 Fields — `docs/plans/<slug>/plan.md` → `## Execution Record`

Placed after `## Final Integration & Verification`, outside `## Phases`; legacy
plans without it MUST still parse.

| Field | Content |
|---|---|
| `Execution status` | `In progress` \| `Completed` \| `Completed with deferrals` \| `Not executed` |
| `Executed at` | `YYYY-MM-DD` the execution record was first written (T1); T3 may update it to the finalization date |
| `Workspace root` | Absolute path used for the run |
| `Repository kind` | `workspace` \| `nested project` \| `submodule` \| `worktree` |
| `Repository path` | Workspace-relative path that received the commits; `.` for the workspace root |
| `Branch / worktree` | Branch and worktree path when not the main checkout |
| `Commit range` | `<base>..<head>` (short SHAs; provisional at T1) |
| `Plan path` | `docs/plans/<slug>/plan.md` — the authoritative copy |
| `Mirrored plan path` | Optional non-authoritative copy in the real repo/worktree; `none` when absent; never created by the harness unless the user asks, and must link back to the authoritative plan |
| `Summary` | 2–5 bullets: what shipped |
| `Architectural changes` | ADRs/contracts/interfaces created or changed, or `None` |
| `References` | Review, handoff, evolution note and ADR links |

All fields are required once executed. Never record secrets, tokens,
environment dumps or full diffs. Paths inside the workspace MUST be
workspace-relative; absolute paths only for outside artifacts, marked as
references.

### 7.2 Fields — `docs/plans/index.md` → `## Execution Records`

One row per executed plan (table under `## Execution Records` in
`docs/plans/index.md`):

`| Slug | Executed in (repo/path) | Plan path | Mirrored plan path | Summary | Architectural changes | Date |`

It MUST point to the authoritative plan path; a mirrored copy is named **in
addition**, never instead. The `## Plans` 7-column table stays **last** so
`dh_plan_create`'s EOF append lands in it; the `## Execution Records` table
precedes it and its append behavior is unchanged.

### 7.3 Timing (mandatory order)

| When | What | Writer |
|---|---|---|
| T1 — execution loop ends (all sub-tasks `Completed`), before final review | Write `## Execution Record` with every field; `Execution status: In progress` | `dh-execute-plan` / `-fast` |
| T2 — `dh-final-review` sign-off | Verify T1 exists, is complete and consistent with the diff — blocking finding if not | `dh-final-review` |
| T3 — after Approve / Approve with comments, before the plan is marked `Completed` | Set `Execution status` (`Completed` / `Completed with deferrals`), finalize `Commit range` and `Executed at`, add/update the `## Execution Records` row (§7.2) | `dh-execute-plan` / `-fast` |
| T4 — documentation close-out | Link the evolution note and mirror path | `dh-create-documentation` |
| T5 — re-execution/continuation | Update the same record; never append a second | executing skill |

A resumed plan keeps its first `Executed at` and records the final commit range;
a blocked plan keeps `Not executed` until sign-off exists. The plan's completion
checklist asserts T3 landed; a missing or stale record is a blocking finding, not
a P3 note.

## 8. Standalone fallback

No workspace markers (no workspace map, `pnpm-workspace.yaml#packages`,
`package.json#workspaces`, `turbo.json`, `nx.json`, `lerna.json`, Cargo
`[workspace]`, `go.work`, `settings.gradle`, `*.sln`, `.gitmodules`):

| Aspect | Standalone behavior (unchanged) |
|---|---|
| Roots | `cwd = W = P = plan root = vault root` |
| Config | `DH_WORKSPACE_ROOT` unset is valid; if set it MUST equal the cwd |
| Plans | `./docs/plans/...` keeps its current meaning |
| Gates/reviews | Single toolchain, full diff |
| Provenance | Record written with `Repository kind: workspace`, `Repository path: .` |

Nothing here may require a standalone repo to add a map, a
`DH_WORKSPACE_ROOT` entry, or a workspace marker.

## 9. Worked example — pnpm workspace

```text
/repo                      ← W: pnpm-workspace.yaml (packages: apps/*, services/*), docs/plans, AGENTS.md
├── apps/web               ← P1 (TS): pnpm --filter web {test,build}
└── services/api           ← P2 (Python): uv run pytest, uv run ruff check
```

Plan `checkout-flow` changes only `apps/web`; `## Workspace Impact` lists
`apps/web` (affected) and `services/api` (unaffected).

| Session | cwd | Override | What happens | Verdict |
|---|---|---|---|---|
| A | `/repo` | unset | Plan at `/repo/docs/plans/checkout-flow/plan.md`; gates `pnpm --filter web test` and `pnpm --filter web build`; review diff `apps/web/**`; `services/api` reported unaffected | **Correct** |
| B | `/repo/apps/web` | unset | Both sides resolve `/repo/apps/web/docs/plans` — a package-local plan root is born | **Stop** (§6.2) |
| C | `/repo/apps/web` | `/repo` | Tools read `/repo/docs/plans`, skills write `/repo/apps/web/docs/plans` | **Stop** (§6.1) |
| Fix | restart at `/repo` | unset or `/repo` | Identical to A; record `Repository kind: workspace`, `Repository path: .` | — |

If the plan also changes `services/api`, that package joins
`## Workspace Impact`; the plan still lives only at `/repo/docs/plans`.

## 10. Failure modes and verification

### 10.1 Failure modes

| Symptom | Cause | Required action |
|---|---|---|
| `dh_plan_read` returns a package path while `./docs/plans` exists at `W` | cwd = `P`, override unset (row 5) | Stop; restart at `W`; do not write the package plan |
| `dh_plan_read` says "missing" although `./docs/plans/<slug>/plan.md` exists | override points at another repo (rows 3/4/10) | Stop with §6.1; fix or remove the override |
| Two plan trees appear (root + package) | mixed sessions over time | Report; adopt the workspace copy; never auto-delete the foreign one; record the decision |
| Setup "passes" but a later session splits | check compared MCP vs skill, not vs expected `W` | Re-run the `W`-based check (§10.2) |
| Root unchanged after editing `opencode.jsonc` | root resolves per connection (`src/mcp/stdio.ts:4-5`); long-lived servers keep the old root (`docs/LOADING.md:277,294-298`) | Restart opencode; re-verify |
| `git rev-parse --show-toplevel` returns the submodule | submodules are their own toplevel | Use the workspace map/`WORKSPACE.md` (plus `--show-superproject-working-tree` when available) — never git toplevel alone |
| `pnpm-workspace.yaml` present but no workspace | settings-only file without a `packages:` key (this repo: `pnpm-workspace.yaml:1-9`) | Require markers **plus** user confirmation; never infer from one file |

### 10.2 `dh-setup` verification (Step 3 / checklist)

1. `pwd -P` equals `W` (the directory holding the map/markers and
   `docs/plans`).
2. `git rev-parse --show-toplevel` equals `W`; inside a submodule also check
   `git rev-parse --show-superproject-working-tree`.
3. `DH_WORKSPACE_ROOT` is unset or an **absolute** path equal to `W`; when
   written it goes in the `dh` entry's `environment` block
   (`docs/LOADING.md:231-232`).
4. `dh_plan_read` on an existing plan returns a `path`
   (`docs/LOADING.md:251`) starting with `<W>/docs/plans`.
5. No `<P>/docs/plans` exists for any package; if one does, report it.
6. Restart opencode after wiring/editing the entry, repeat 1–4, and record the
   result in the setup report.

### 10.3 `dh-execute-plan` verification

1. Before Step 1: assert the session base equals the workspace root of the
   intended plan — a mismatch is a hard blocker (§6), not a warning.
2. Before the first status write: confirm the path the tools report equals the
   path the skills would edit.
3. Before marking the plan `Completed`: confirm the §7.1 record is finalized
   (`Execution status` set, commit range recorded) and the §7.2 index row exists;
   otherwise stop and report.

## 11. Consumption map

| Sub-task | Cites |
|---|---|
| 1.2 setup detection/map | §1, A1–A3, §10.1–10.2 |
| 1.3 anchor tests | §5, §6, §10.2 |
| 2.1 workspace impact | §1 (affected packages), A8 |
| 2.2 per-package gates | §1 (affected packages), A8, §5 |
| 2.3 scoped review | §1 (affected packages), A8, §5 |
| 2.4 CODE_RULES inheritance | §1 (package root), §8 |
| 2.5 execution provenance | §3, §7 |
| 3.1 docs/vault roots | §1 (vault root), A7 |
| 3.2 code-graph routing | §1 (package vs workspace scope) |
| 3.3 version policy | §1 (workspace/package roots), §8 |
| 3.4 worktrees/submodules | §3, §10.1 |
| 3.5 pause/resume + domain | §1 (affected packages), §5, §6 |
| 4.1 agent guidance | §4, §8 |
| 4.2 fixtures/tests | §5, §6, §10 |
| 4.3 user docs | whole document |

## 12. References

- [`plan.md`](plan.md) — sub-task 1.1, R1/R9, resolved plan-root question.
- [`sdd.md`](sdd.md) — R1, R9, AC1, AC9.
- [`../../audits/2026-11-10-skills-agents-standalone-monorepo.md`](../../audits/2026-11-10-skills-agents-standalone-monorepo.md) — P0 anchor finding.
- Code: [`workspace.ts`](../../../src/mcp/workspace.ts),
  [`plan-paths.ts`](../../../src/tools/plan-paths.ts),
  [`stdio.ts`](../../../src/mcp/stdio.ts).
- [`../../LOADING.md`](../../LOADING.md) — `dh` MCP anchoring.
- Skills: [`dh-planning`](../../../skills/dh-planning/SKILL.md),
  [`dh-create-documentation`](../../../skills/dh-create-documentation/SKILL.md),
  [`dh-setup`](../../../skills/dh-setup/SKILL.md).
