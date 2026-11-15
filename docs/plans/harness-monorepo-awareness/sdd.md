---
title: Harness Monorepo Awareness
slug: harness-monorepo-awareness
description: Make the bundled skills and agents workspace-aware so they behave predictably in standalone projects and in monorepos with nested standalone projects.
tags: [sdd, design, harness, skills, agents, monorepo, workspace]
project: dev-harness-skills
stack: markdown skills + TypeScript inventory/test tooling
created: 2026-11-10
updated: 2026-11-10
status: proposed
---

# Software Design Document: Harness Monorepo Awareness

## Problem Statement

The harness assumes a single `{project_root}` equal to the current working
directory. Plans, SDDs, reviews, diagrams and handoffs live under
`./docs/plans`; stack/tooling detection, `CODE_RULES.md`, QA gates, builds,
version tags and the Obsidian vault are all resolved at that one root.

In a monorepo with several standalone projects nested as workspace packages,
submodules, or sibling repositories, this assumption breaks down:

- The `dh` MCP server anchors `docs/plans` at its workspace root
  (`DH_WORKSPACE_ROOT` or `process.cwd()`), while skills write `./docs/plans`
  relative to their cwd. A package-scoped session can split plans between the
  tool and the skill.
- Stack and `CODE_RULES.md` detection is root-only; polyglot monorepos apply
  the wrong toolchain or rules to nested projects.
- Preflight and artifact checks execute one root command and can report green
  without validating every package.
- Reviews, simplify and final review use the full repository diff, so unrelated
  package changes contaminate findings.
- Versioning, documentation, code-graph queries and worktree lifecycles are
  repository-wide and do not understand nested project roots.
- The bundled agents have no workspace discovery step and inherit the same
  single-root assumptions.

The full audit is in
[`docs/audits/2026-11-10-skills-agents-standalone-monorepo.md`](../../audits/2026-11-10-skills-agents-standalone-monorepo.md).

## Goals / Non-Goals

- **Goals:**
  - Define a workspace contract: workspace root, project/package root, plan
    root, and the anchor rules that keep the `dh` MCP and the skills aligned.
  - Make `dh-setup` detect common monorepo layouts and generate a workspace map
    with per-package stacks, commands, docs roots, code-graph scope and
    worktree lifecycle scope.
  - Make planning, execution, gates, reviews, docs, graph queries, versioning,
    worktrees and pause/resume workspace-aware while preserving standalone
    behavior.
  - Record execution provenance: every executed plan keeps the workspace-root
    `docs/plans` as the only plan root and records the execution summary, the
    real repository/path (including nested projects, submodules and worktrees),
    the real plan path when mirrored, and the architectural changes in both the
    plan and the plans index.
  - Add workspace-first guidance to the bundled agents.
  - Cover the behavior with monorepo fixtures/tests and the full QA gate.
- **Non-goals:**
  - Replacing the harness loop, plan status model, or MCP tool names.
  - Automatically supporting every build system; detection is heuristic with
    an explicit workspace map.
  - Changing the agent roster or the capability-based delegation protocol.
  - Forcing one versioning policy; fixed and independent monorepo releases are
    both supported by policy.
  - Breaking legacy plans or existing `DH_WORKSPACE_ROOT` deployments.

## Requirements

- **R1 — Workspace contract:** document workspace root, package root, plan
  root and vault root; define that monorepo sessions start at the workspace
  root, `DH_WORKSPACE_ROOT` matches it, and `dh` plan paths and skill paths
  resolve to the same `docs/plans`. `dh-setup` must verify the anchor.
- **R2 — Detection and map:** `dh-setup` detects pnpm/npm/yarn workspaces,
  Nx/Turbo/Lerna, Cargo workspaces, Go workspaces, Gradle/.NET solutions and
  `.gitmodules`; it generates a workspace map (packages, stacks, test/build
  commands, docs roots, code-graph scope, worktree scope) and writes the
  `DH_WORKSPACE_ROOT` guidance/config when the user consents.
- **R3 — Planning and SDD:** `dh-planning` and `dh-grill-sdd` capture a
  `## Workspace Impact` with affected packages, per-package commands and the
  docs/version policy; the plan template gains the field without breaking the
  parser or legacy plans.
- **R4 — Gates:** `dh-preflight` and `dh-artifact-check` iterate affected
  packages or use the workspace aggregate (`pnpm -r`, `--filter`,
  `nx/turbo affected`), report each package independently and never report
  green for an unvalidated package.
- **R5 — Review scope:** `dh-review`, `dh-code-review`, `dh-simplify` and
  `dh-final-review` scope diffs to the affected package paths and report the
  package context in findings.
- **R6 — Rules and docs:** `CODE_RULES.md` supports root defaults plus
  per-package overrides; documentation distinguishes workspace/package/vault
  roots and allows package-scoped docs with frontmatter metadata.
- **R7 — Graph, versions, worktrees, lifecycle:** `dh-code-query` routes to
  the workspace or package index; `dh-semver` supports a fixed or independent
  monorepo policy; `dh-create-worktree` discovers root/submodule lifecycle
  files and aligns submodule branches; `dh-pause-plan`/`dh-resume-plan` can
  fingerprint affected packages; `dh-domain-check` uses the workspace package
  graph.
- **R8 — Agents and validation:** the architect, engineer, reviewer, final
  reviewer and documentor embed workspace-first guidance; monorepo fixtures
  cover detection, gates, review scope and worktree lifecycle; the full QA
  gate passes and docs/changelog are updated.
- **R9 — Execution provenance:** the workspace-root `docs/plans` is the only
  plan root (no package-local plan directories). Every executed plan records
  in `docs/plans/<slug>/plan.md` and in `docs/plans/index.md`: an execution
  summary, the real repository and path where the work happened (nested
  project/submodule/worktree), the real plan path when a plan is mirrored, and
  the architectural changes produced by the execution.

## Acceptance Criteria

- **AC1:** A monorepo session started at the workspace root with
  `DH_WORKSPACE_ROOT` set creates and reads plans at the same path with both
  the `dh` tools and the skills; a package-scoped session produces an explicit
  configuration error or a documented fallback, never split paths.
- **AC2:** `dh-setup` identifies at least pnpm workspaces, npm workspaces,
  Nx/Turbo, Cargo workspace, Go work and `.gitmodules`, and writes a
  user-approved workspace map containing those packages and their commands.
- **AC3:** Plans/SDDs include affected packages and per-package validation
  guidance; the parser accepts both legacy and workspace-aware plans.
- **AC4:** Preflight/artifact-check report per-package results or a documented
  aggregate, with no false green for a skipped package.
- **AC5:** Review/simplify/final-review limit diffs to affected packages and
  cite the package in each finding.
- **AC6:** Root `CODE_RULES.md` and package overrides are resolved and
  documented; docs, code graph, semver, worktree and pause/resume behavior is
  workspace-aware per R7.
- **AC7:** Agent prompts include workspace discovery/map usage and preserve
  standalone behavior.
- **AC8:** New fixtures/tests pass, `pnpm qa:check:full` is green, and the
  user-facing docs plus CHANGELOG describe the workspace contract.
- **AC9:** An executed plan contains an execution record with the summary, the
  real repository/path, the real plan path when mirrored, and the architectural
  changes; the same record is linked from `docs/plans/index.md`, and no
  package-local `docs/plans` directory is created.

## Assumptions and Constraints

- Filesystem and git are available; workspace detection is best-effort and
  must be confirmed by the user.
- The `dh` MCP server remains the owner of plan I/O; any new fields are
  additive and parser-compatible.
- The harness must keep working for standalone repositories with no workspace
  markers.
- Workspace-root `docs/plans` is the only plan root; package-local plan
  directories are not supported. Execution provenance references nested paths
  instead.
- No new agents are required; changes are skill, agent-prompt, config,
  template and test updates.
- Validation runs through `dh-execute-cli`; no direct bash from skills.

## Risks

- **Anchor mismatch:** setting `DH_WORKSPACE_ROOT` without starting at the
  workspace root may still split paths. Mitigation: setup verifies both and
  fails loudly.
- **Detection false positives:** a nested `package.json` does not always mean
  a workspace. Mitigation: require workspace markers plus user confirmation.
- **Polyglot command drift:** per-package commands vary; the workspace map is
  the source of truth and gates report unknown packages.
- **Backward compatibility:** plan/SDD fields and parser changes must not break
  legacy plans; keep additive fields optional.
- **Scope creep:** the audit lists many recommendations; the plan prioritizes
  P0/P1 first and leaves P2 refinements as independent sub-tasks.

## Open Questions

- **Resolved — plan root:** the workspace-root `docs/plans` is the only plan
  root; package-local plan directories are not supported. The execution record
  references the real repository/path and any mirrored plan path.
- Should versioning default to fixed (one tag) or independent (per package)?
  Default for this plan: detect the repo policy; fixed remains the fallback.
- Should worktree lifecycles be discovered automatically for submodules, or
  must the user list them in the root lifecycle file? Default: discover
  `WORKTREE_LIFECYCLE.md` at the workspace root and each submodule root, with
  user confirmation.
