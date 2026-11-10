---
title: Harness Monorepo Awareness
slug: harness-monorepo-awareness
description: Make the bundled skills and agents workspace-aware so they behave predictably in standalone projects and in monorepos with nested standalone projects.
created: 2026-11-10
updated: 2026-11-10
status: Pending
active: true
tags: [plan]
project: dev-harness-skills
---

# Plan: Harness Monorepo Awareness

## Objective

Make the bundled skills and agents workspace-aware. Define a workspace contract
(workspace root vs package root vs plan root vs vault root), make `dh-setup`
detect monorepo layouts and generate a workspace map, scope plans/gates/reviews
to affected packages, and make docs, code graph, versioning, worktrees,
pause/resume and agent prompts workspace-aware — while keeping standalone
behavior unchanged.

The evidence base is the audit at
[`docs/audits/2026-11-10-skills-agents-standalone-monorepo.md`](../../audits/2026-11-10-skills-agents-standalone-monorepo.md),
the contract in [`sdd.md`](sdd.md), and the normative
[`workspace-contract.md`](workspace-contract.md).

## Requirements Snapshot

- **R1:** Workspace contract: define workspace root, package root, plan root and
  vault root; monorepo sessions start at the workspace root; `DH_WORKSPACE_ROOT`
  matches it; the `dh` tools and skills resolve `docs/plans` to the same path.
- **R2:** `dh-setup` detects pnpm/npm/yarn workspaces, Nx/Turbo/Lerna, Cargo
  workspaces, Go workspaces, Gradle/.NET solutions and `.gitmodules`, generates
  a workspace map and writes `DH_WORKSPACE_ROOT` guidance/config on consent.
- **R3:** `dh-planning`/`dh-grill-sdd` capture `## Workspace Impact` (affected
  packages, per-package commands, docs/version policy); the plan template gains
  the field without breaking the parser or legacy plans.
- **R4:** `dh-preflight`/`dh-artifact-check` iterate affected packages or use
  the workspace aggregate and report each package independently; no false green
  for skipped packages.
- **R5:** `dh-review`, `dh-code-review`, `dh-simplify` and `dh-final-review`
  scope diffs to affected package paths and cite package context.
- **R6:** `CODE_RULES.md` supports root defaults plus per-package overrides;
  documentation distinguishes workspace/package/vault roots and allows
  package-scoped docs.
- **R7:** `dh-code-query` routes to the workspace/package index; `dh-semver`
  supports fixed or independent monorepo policy; `dh-create-worktree`
  discovers root/submodule lifecycle files and aligns submodule branches;
  `dh-pause-plan`/`dh-resume-plan` can fingerprint affected packages;
  `dh-domain-check` uses the workspace package graph.
- **R8:** Agents embed workspace-first guidance; monorepo fixtures cover
  detection, gates, review scope and worktree lifecycle; full QA and docs pass.
- **R9:** The workspace-root `docs/plans` is the only plan root. Every executed
  plan records in `docs/plans/<slug>/plan.md` and in `docs/plans/index.md`: an
  execution summary, the real repository/path (nested project/submodule/
  worktree), the real plan path when mirrored, and the architectural changes.

## Scope

- Skill and agent instruction updates for the 26 bundled skills and 5 agents.
- `dh-setup` detection and a workspace-map reference file.
- Plan/SDD templates and planning skills; additive plan fields.
- Preflight/artifact-check, review/simplify/final-review scoping, CODE_RULES
  inheritance, docs roots, code graph routing, semver policy, worktree
  lifecycle discovery, pause/resume and domain mapping.
- Monorepo fixtures/tests, user-facing docs, AGENTS.md and CHANGELOG.
- Execution provenance: the plan's `## Execution Record` and the plans index
  record the real repo/path, mirrored plan path, summary and architectural
  changes; no package-local `docs/plans` directory is created.

## Assumptions and Constraints

- The `dh` MCP server remains the owner of plan I/O; new fields are additive and
  parser-compatible.
- Workspace-root `docs/plans` is the only plan root; package-local plan
  directories are not supported and are referenced from the execution record
  instead.
- Workspace detection is heuristic and requires user confirmation; standalone
  repositories with no markers keep working unchanged.
- No new agents are required; the capability-based delegation protocol and the
  5-agent roster stay intact.
- Validation runs through `dh-execute-cli`; no direct bash from skills.
- The plan must pass `pnpm qa:check:full` before sign-off.

## Risks and Areas Requiring Care

- **Anchor mismatch:** setting `DH_WORKSPACE_ROOT` without starting at the
  workspace root can still split paths. Setup must verify both and fail loudly.
- **Detection false positives:** a nested `package.json` does not always mean a
  workspace; require workspace markers plus user confirmation.
- **Polyglot command drift:** the workspace map is the source of truth; gates
  must report unknown packages instead of silently skipping.
- **Backward compatibility:** legacy plans omit the workspace fields; parser and
  templates must stay tolerant.
- **Scope creep:** 15 sub-tasks is broad; prioritize P0/P1 and keep each change
  independently reviewable.
- **Provenance drift:** a plan executed in a nested repo/worktree can lose the
  link to its real path or architectural changes. The execution record and
  index entry must be written before sign-off.

## Core concepts

- **Workspace root:** the repository that contains all nested projects; it owns
  `docs/plans`, the root `AGENTS.md`, the `dh` MCP entry and the root
  `WORKTREE_LIFECYCLE.md`.
- **Package root:** a nested standalone project (`apps/web`, `services/api`,
  `packages/core`, a submodule). It owns its stack, commands, optional
  `CODE_RULES.md`, docs and worktree lifecycle when it is an independent repo.
- **Plan root:** the directory where `docs/plans/<slug>/` lives. Default:
  workspace root.
- **Vault root:** the Obsidian vault. Default: workspace root; it may differ
  when `OBSIDIAN_VAULT` is set.
- **Affected packages:** the workspace packages a plan/sub-task changes; they
  drive the command matrix, diff scope and review scope.

Example: a pnpm workspace with `apps/web` (TS) and `services/api` (Python). The
workspace map records both stacks and their commands. A plan that changes only
`apps/web` runs `pnpm --filter web test` and `pnpm --filter web build`, and
review diffs only `apps/web/**`; `services/api` is reported as unaffected.

## Visual Context

None — no component or code architecture change; this plan changes harness
behavior contracts, detection, and documentation.

## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Architecture / design | dh-software-architect | Bundled architecture capability; owns the workspace contract and anchor rules. | bundled architecture capability |
| Implementation / engineering | dh-software-engineer | Bundled implementation capability; edits skills, templates, config and tests. | bundled implementation capability |
| Testing / QA | dh-software-engineer | No project-scoped QA agent exists; the implementation agent authors fixtures/tests and runs the gates. | bundled implementation capability |
| Review | dh-reviewer | Bundled scoped code review capability. | bundled review capability |
| Final review | dh-final-reviewer | Bundled plan-wide sign-off capability. | bundled final-review capability |
| Documentation | dh-documentor | Bundled documentation owner; updates AGENTS/README/LOADING/CHANGELOG and the audit cross-link. | bundled documentation capability |

Discovery: runtime list + project agent definitions; all six selected agents are
the bundled harness capabilities present in this runtime.

## Phases

### Phase 1: Workspace Contract and Detection

- **Status:** Completed

#### Sub-Task 1.1: Define the workspace contract and anchor rules

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Objective:** Produce the authoritative workspace contract used by every
  later sub-task: terminology, anchor rules, failure behavior and the
  start-at-workspace-root convention.
- **Related Requirements:** R1
- **Dependencies and Preconditions:** Approved SDD and audit. No code changes.
- **In Scope for This Sub-Task:** A design note at
  `docs/plans/harness-monorepo-awareness/workspace-contract.md` covering
  workspace/package/plan/vault roots, `DH_WORKSPACE_ROOT`, start-at-root, the
  MCP-vs-skill path rule, mismatch detection, and the standalone fallback.
- **Out of Scope for This Sub-Task:** User-facing docs (4.3), detection logic
  (1.2), tests (1.3).
- **Instructions:** Compare the audit P0 findings with
  `src/mcp/workspace.ts` and `docs/LOADING.md`; define one normative rule per
  root and a concrete mismatch error. Include a decision table for
  cwd/override combinations.
- **Acceptance Criteria:** The note defines all four roots, states the
  normative start/override behavior, lists the failure modes and the standalone
  fallback, and is linked from the plan.
- **Cautionary Points:** Do not introduce package-local plans by default; do not
  change the MCP tool schema; keep the contract implementation-agnostic.
- **Implementation Suggestions:** Use a compact decision table and a worked
  example (monorepo root vs package cwd).
- **Testing Suggestions:** Architecture review against audit P0 evidence;
  verify every later sub-task can cite a contract section.
- **Done When:** The contract note exists, is self-consistent, and has no open
  anchor ambiguity.

#### Sub-Task 1.2: Detect monorepo layouts and generate the workspace map

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Extend `dh-setup` to detect monorepo layouts and generate a
  user-approved workspace map with packages, stacks, commands and scopes.
- **Related Requirements:** R1, R2
- **Dependencies and Preconditions:** 1.1 contract note.
- **In Scope for This Sub-Task:** A `skills/dh-setup/references/workspace-map.md`
  reference (detection markers, interview, template, validation); a compact
  Step 3 item in `skills/dh-setup/SKILL.md` (stay <250 lines); guidance to set
  `DH_WORKSPACE_ROOT` in `opencode.jsonc`; the map file at
  `{workspace_root}/WORKSPACE.md` (or `docs/WORKSPACE.md`) with per-package
  stacks, test/build commands, docs roots, code-graph scope and worktree scope.
- **Out of Scope for This Sub-Task:** Running the gates (2.2); changing the
  `dh` MCP schema; user-facing docs (4.3).
- **Instructions:** Detect `pnpm-workspace.yaml`, `package.json#workspaces`,
  `turbo.json`, `nx.json`, `lerna.json`, Cargo `[workspace]`, `go.work`,
  `settings.gradle`, `*.sln` and `.gitmodules`. Interview the user per package
  group; write the map only with consent; keep standalone behavior unchanged.
- **Acceptance Criteria:** `dh-setup` names every detection marker, links the
  reference, documents the `DH_WORKSPACE_ROOT` wiring and the map sections; the
  reference includes a template and a validation checklist.
- **Cautionary Points:** Do not treat every nested `package.json` as a
  workspace; do not overwrite an existing map without review; keep the skill
  under its line limit.
- **Implementation Suggestions:** Put the long matrix/template in the reference
  and keep SKILL.md to a short pointer, as done for code-graph-rag.
- **Testing Suggestions:** Structural test that `dh-setup` contains the markers
  and the reference link; lint/audit.
- **Done When:** The reference exists, `dh-setup` links it, and the map template
  covers detection, commands, docs, graph and worktrees.

#### Sub-Task 1.3: Verify the plan/docs anchor and add anchor tests

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add a verification step and regression tests that prove the
  MCP workspace and skill `docs/plans` paths align (or fail loudly).
- **Related Requirements:** R1
- **Dependencies and Preconditions:** 1.1 contract, 1.2 setup guidance.
- **In Scope for This Sub-Task:** A `dh-setup` verification checklist item
  (start at workspace root, set `DH_WORKSPACE_ROOT`, `dh_plan_read` and
  `./docs/plans` agree); tests for the documented anchor rules and for the
  workspace resolver's existing override behavior; a fixture for a monorepo
  root + package cwd mismatch.
- **Out of Scope for This Sub-Task:** Changing the MCP resolver semantics;
  package-local plans.
- **Instructions:** Use the existing `src/mcp/workspace.ts` tests as the base;
  add a documentation-contract test for the setup checklist and a mismatch
  fixture that asserts the documented failure/fallback.
- **Acceptance Criteria:** Tests fail if the setup checklist omits the anchor
  verification or if the contract note drops the mismatch rule; existing
  resolver tests stay green.
- **Cautionary Points:** Do not assert behavior that the MCP cannot enforce;
  document the human verification step explicitly.
- **Implementation Suggestions:** Keep the test file under 300 lines; use the
  existing temp-dir helpers.
- **Testing Suggestions:** `pnpm test`, `pnpm typecheck`, `pnpm lint:links`.
- **Done When:** The anchor verification is documented and covered by tests.

### Phase 2: Workspace-Aware Planning and Gates

- **Status:** Completed

#### Sub-Task 2.1: Add workspace impact to SDD and plan templates and planning skills

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add a `## Workspace Impact` contract to SDDs/plans and make
  planning capture affected packages, per-package commands and docs/version
  policy without breaking the parser.
- **Related Requirements:** R3, R6
- **Dependencies and Preconditions:** 1.1 contract, 1.2 workspace map.
- **In Scope for This Sub-Task:** `skills/dh-planning/references/phased-plan-template.md`,
  `src/tools/plan-template.ts`, `skills/dh-planning/SKILL.md`,
  `skills/dh-grill-sdd/SKILL.md`, and the fast template's omitted-section list;
  parser tolerance tests for legacy plans.
- **Out of Scope for This Sub-Task:** Per-package gate execution (2.2); the MCP
  plan tool schema (additive only if unavoidable).
- **Instructions:** Add `## Workspace Impact` after `## Scope` with affected
  packages, commands, docs root and version policy; update the SDD template
  similarly; keep the field optional for standalone plans and ignored by the
  existing parser.
- **Acceptance Criteria:** New plans/SDDs include the section; legacy plans
  parse unchanged; planning asks for affected packages when a workspace map
  exists.
- **Cautionary Points:** Do not put the section inside `## Phases`; do not break
  the plan fixture; keep fast-mode omitted-section lists in sync.
- **Implementation Suggestions:** Use a compact table:
  `Package | Stack | Test | Build | Docs | Version policy`.
- **Testing Suggestions:** Fixture parse tests for legacy/new plans; plan
  creation test; `pnpm test`.
- **Done When:** Templates, skills and parser tolerate the new section and
  standalone plans remain valid.

#### Sub-Task 2.2: Make preflight and artifact-check package-aware

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make the release gates validate affected packages (or the
  workspace aggregate) and report per-package results.
- **Related Requirements:** R4
- **Dependencies and Preconditions:** 2.1 workspace impact; 1.2 map.
- **In Scope for This Sub-Task:** `skills/dh-preflight/SKILL.md`,
  `skills/dh-artifact-check/SKILL.md`, and a shared
  `skills/dh-preflight/references/workspace-gates.md` (command patterns for
  pnpm/npm/yarn, Nx/Turbo, Cargo, Go; aggregate vs affected; unknown-package
  behavior).
- **Out of Scope for This Sub-Task:** Installing tools; changing the project's
  CI; running real builds in this repo.
- **Instructions:** Read `## Workspace Impact` from the plan; iterate the
  affected package commands or use the aggregate; report every package with
  pass/fail/skipped; never report green for an unvalidated package.
- **Acceptance Criteria:** The skills describe package selection, command
  patterns, per-package reporting and the unknown-package failure; the
  reference includes a validation checklist.
- **Cautionary Points:** `pnpm -r` may not exist for every workspace; detect the
  aggregator; avoid running destructive builds; keep the skills concise.
- **Implementation Suggestions:** Reuse the workspace map as the command source;
  put long command matrices in the reference.
- **Testing Suggestions:** Structural tests for the required phrases/markers;
  a fixture plan with two affected packages.
- **Done When:** Gates are package-aware and no skipped package can hide behind
  a green aggregate.

#### Sub-Task 2.3: Scope review, simplify and final-review diffs to affected packages

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Scope diffs and findings to the affected packages so unrelated
  workspace changes do not contaminate reviews.
- **Related Requirements:** R5
- **Dependencies and Preconditions:** 2.1 workspace impact.
- **In Scope for This Sub-Task:** `skills/dh-review/SKILL.md`,
  `skills/dh-code-review/SKILL.md`, `skills/dh-simplify/SKILL.md`,
  `skills/dh-final-review/SKILL.md`, and a shared
  `skills/dh-review/references/workspace-diff-scope.md` (path derivation,
  `git diff -- <paths>`, package labels in findings).
- **Out of Scope for This Sub-Task:** Changing review severity or agent
  selection; full-repo audits requested by the user.
- **Instructions:** Derive the package paths from `## Workspace Impact`; use
  `git diff -- <paths>`; label each finding with the package; for final review,
  report packages not touched as "unaffected".
- **Acceptance Criteria:** Each review skill documents the path filter and the
  package label; standalone behavior remains the full diff; a two-package
  fixture demonstrates that unrelated changes are excluded.
- **Cautionary Points:** Root-level files (workspace config, docs) may need to
  be included explicitly; do not silently drop them.
- **Implementation Suggestions:** Centralize the path formula in the reference
  and link it from the four skills.
- **Testing Suggestions:** Structural tests for the filter language; a fixture
  diff with two packages and an unrelated root change.
- **Done When:** Reviews are package-scoped, root-level shared files are
  handled, and standalone behavior is unchanged.

#### Sub-Task 2.4: Add root and package CODE_RULES inheritance

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Support root `CODE_RULES.md` defaults plus per-package
  overrides, and make `dh-coding`/`dh-code-ruler` resolve them.
- **Related Requirements:** R6
- **Dependencies and Preconditions:** 1.2 workspace map; 2.1 workspace impact.
- **In Scope for This Sub-Task:** `skills/dh-coding/SKILL.md`,
  `skills/dh-code-ruler/SKILL.md`, and a short
  `skills/dh-coding/references/code-rules-resolution.md` with the inheritance
  order, package detection and conflict rule.
- **Out of Scope for This Sub-Task:** Writing concrete rules for every package;
  changing the 300-line code limit.
- **Instructions:** Define resolution: package `CODE_RULES.md` wins over root
  for files in that package; root applies to shared/root files; report the
  resolved file in the implementation report.
- **Acceptance Criteria:** Both skills describe the inheritance order and the
  package root source; the reference includes a worked example; standalone
  behavior (single root file) is unchanged.
- **Cautionary Points:** Avoid two rule sources silently merging; define an
  explicit precedence and conflict report.
- **Implementation Suggestions:** Use the workspace map's package roots; keep
  the reference short.
- **Testing Suggestions:** Structural tests for the precedence phrases; a
  fixture with root + package rules.
- **Done When:** Rule resolution is explicit, package-aware and standalone-safe.

#### Sub-Task 2.5: Record execution provenance and architectural changes in plan and index

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Define and implement the execution-record contract: the
  workspace root is the only plan root; every executed plan records its
  summary, real repository/path, mirrored plan path and architectural changes
  in `plan.md` and in the plans index.
- **Related Requirements:** R9
- **Dependencies and Preconditions:** 1.1 contract; 2.1 workspace impact.
- **In Scope for This Sub-Task:** `skills/dh-planning/references/phased-plan-template.md`
  (`## Execution Record`), `src/tools/plan-template.ts` scaffold,
  `docs/plans/index.md` `## Execution Records` table, and short instructions
  in `dh-execute-plan`, `dh-execute-plan-fast`, `dh-final-review` and
  `dh-create-documentation` for filling the record.
- **Out of Scope for This Sub-Task:** Filling this plan's own execution record
  (that happens when the plan is executed) and changing the plan status model.
- **Instructions:** Add an `## Execution Record` section after
  `## Final Integration & Verification` with: execution status/date, real
  repository and path, real plan path (when mirrored), worktree/branch/commit
  range, summary, architectural changes and references. Add a
  `## Execution Records` table to `docs/plans/index.md` with columns: slug,
  real repo/path, plan path, summary, architectural changes, date. State that
  package-local `docs/plans` directories are not supported.
- **Acceptance Criteria:** Template and scaffold include the section; the index
  has the table; execution/review skills say when and how to fill it; a legacy
  plan without the section still parses; the main 7-column index table and the
  `dh_plan_create` append behavior remain unchanged.
- **Cautionary Points:** Keep the parser tolerant; do not put the section
  inside `## Phases`; never record secrets or full diffs; the real repo path
  must be repository-relative when possible.
- **Implementation Suggestions:** Use a compact field list and one index row
  per executed plan; link the contract note.
- **Testing Suggestions:** Parser fixtures with and without the section; index
  format test; `pnpm lint:links`.
- **Done When:** The execution record contract is documented, scaffolded,
  indexed and parser-tolerant.

### Phase 3: Workspace-Aware Docs, Graph, Versions and Worktrees

- **Status:** Completed

#### Sub-Task 3.1: Distinguish workspace, package and vault roots in documentation

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make documentation choose the correct root and allow
  package-scoped docs without breaking the single-vault model.
- **Related Requirements:** R6
- **Dependencies and Preconditions:** 1.2 workspace map; 1.1 contract.
- **In Scope for This Sub-Task:** `skills/dh-create-documentation/SKILL.md`,
  `agents/dh-documentor.md`, and a short reference for the vault/workspace/
  package decision; frontmatter `project`/`package` guidance; evolution notes
  stay at the workspace root.
- **Out of Scope for This Sub-Task:** Migrating existing docs; changing the
  vault location for standalone projects.
- **Instructions:** Add a decision table: workspace docs → root `docs/`;
  package docs → `{package}/docs/` with `package` frontmatter; vault override
  via `OBSIDIAN_VAULT`; evolution/observation notes always workspace-root.
- **Acceptance Criteria:** Docs skill and documentor agent state the decision
  table and the frontmatter fields; standalone behavior is unchanged; the audit
  P2 doc finding is addressed.
- **Cautionary Points:** `git rev-parse --show-toplevel` may differ from the
  workspace root in submodules; use the workspace map when present.
- **Implementation Suggestions:** Keep the decision table in a reference and
  link it from both files.
- **Testing Suggestions:** Structural tests for the decision-table phrases;
  check-links.
- **Done When:** Documentation roots are explicit and package-scoped docs are
  supported.

#### Sub-Task 3.2: Route code-graph queries by workspace or package

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make `dh-code-query` and the setup reference route queries to
  the workspace or package index instead of assuming `$PWD`.
- **Related Requirements:** R7
- **Dependencies and Preconditions:** 1.2 workspace map.
- **In Scope for This Sub-Task:** `skills/dh-code-query/SKILL.md`,
  `skills/dh-setup/references/code-graph-rag.md`, and a short query-routing
  table (workspace index vs package index, `--workspace`/`--repo-path`, stale
  checks).
- **Out of Scope for This Sub-Task:** Installing cgr; indexing real monorepos.
- **Instructions:** Read the workspace map; default to the workspace index;
  allow a package index when the user asks; state the index scope in every
  answer; keep `cgr status` as the availability check.
- **Acceptance Criteria:** The skill documents index selection and the answer
  template names the index scope; the setup reference explains per-package vs
  workspace indexing; standalone behavior is unchanged.
- **Cautionary Points:** A query against the wrong index returns false
  negatives; require an explicit scope when multiple indexes exist.
- **Implementation Suggestions:** Add a `--workspace` example and a package
  example; keep the deterministic query rules.
- **Testing Suggestions:** Structural tests for the routing phrases; audit.
- **Done When:** Queries are scoped and the answer states which index was used.

#### Sub-Task 3.3: Define the monorepo versioning policy in dh-semver

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Support fixed and independent monorepo versioning without
  breaking single-package releases.
- **Related Requirements:** R7
- **Dependencies and Preconditions:** 1.2 workspace map.
- **In Scope for This Sub-Task:** `skills/dh-semver/SKILL.md` and a short
  policy reference (fixed vs independent, per-package tags/changelog,
  release-train rules, confirmation before tagging).
- **Out of Scope for This Sub-Task:** Publishing packages; changing the
  existing tag/version algorithm for standalone repos.
- **Instructions:** Ask/detect the policy from the workspace map; fixed = one
  tag/version for the workspace; independent = per-package tags with package
  names; keep tags local until the user confirms.
- **Acceptance Criteria:** The skill describes both policies, the detection
  source and the standalone fallback; the safety rules (no push without
  confirmation) remain.
- **Cautionary Points:** Do not infer independent versioning from multiple
  `package.json` files alone; require explicit policy.
- **Implementation Suggestions:** Use the workspace map's `Version policy`
  column; keep the output template.
- **Testing Suggestions:** Structural tests for both policies; audit.
- **Done When:** The versioning policy is explicit and configurable.

#### Sub-Task 3.4: Discover worktree lifecycles and align submodule branches

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make `dh-create-worktree` discover lifecycle files at the
  workspace and submodule roots and align submodule branches.
- **Related Requirements:** R7
- **Dependencies and Preconditions:** 1.2 workspace map; `dh-execute-plan`'s
  submodule branch note.
- **In Scope for This Sub-Task:** `skills/dh-create-worktree/SKILL.md` and a
  short reference (discovery order, submodule branch alignment, nested
  standalone repo handling, failure behavior).
- **Out of Scope for This Sub-Task:** Creating worktrees automatically;
  changing the existing six lifecycle phases.
- **Instructions:** Discover `WORKTREE_LIFECYCLE.md` at the workspace root and
  each submodule root; run the root phases and the matching submodule phases;
  align branches with the main repo; require user confirmation.
- **Acceptance Criteria:** The skill documents discovery and submodule
  alignment, the reference lists the order and failures, and the existing
  same-branch reuse rule remains.
- **Cautionary Points:** Submodules may not have a lifecycle file; missing is
  not an error unless the user requires it; never force remove.
- **Implementation Suggestions:** Reuse the execute-plan submodule rule; keep
  the root lifecycle as the default.
- **Testing Suggestions:** Structural tests for discovery/alignment; a fixture
  with two submodule lifecycle files.
- **Done When:** Worktree lifecycle discovery and submodule alignment are
  explicit and safe.

#### Sub-Task 3.5: Add package-aware pause/resume and workspace domain mapping

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Reduce false drift in pause/resume and map bounded contexts
  from the workspace package graph.
- **Related Requirements:** R7
- **Dependencies and Preconditions:** 1.2 workspace map; 2.1 workspace impact.
- **In Scope for This Sub-Task:** `skills/dh-pause-plan/SKILL.md`,
  `skills/dh-resume-plan/SKILL.md`, `skills/dh-domain-check/SKILL.md`, and a
  short reference for the package fingerprint and package-graph mapping.
- **Out of Scope for This Sub-Task:** Changing the handoff schema version;
  forcing per-package handoffs.
- **Instructions:** Fingerprint the affected package paths from the plan; mark
  unrelated dirty packages as out-of-scope, not drift; in domain check, use the
  workspace map/package graph before top-level directory heuristics.
- **Acceptance Criteria:** Handoff records the package scope; resume ignores
  unrelated packages or reports them separately; domain check documents the
  package-graph source.
- **Cautionary Points:** Keep the existing repo-wide fallback when no workspace
  map exists; never hide dirty files that belong to the plan.
- **Implementation Suggestions:** Add a `## Package Scope` section to the
  handoff reference; keep it optional.
- **Testing Suggestions:** Structural tests for the package scope and graph
  phrases; handoff contract tests.
- **Done When:** Pause/resume and domain checks are package-aware with a
  repo-wide fallback.

### Phase 4: Agents, Fixtures and Release

- **Status:** Completed

#### Sub-Task 4.1: Add workspace-first guidance to the bundled agents

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make every bundled agent consult the workspace map and state
  the affected package scope before acting.
- **Related Requirements:** R8
- **Dependencies and Preconditions:** 1.2 map; 2.x skills.
- **In Scope for This Sub-Task:** `agents/dh-software-architect.md`,
  `agents/dh-software-engineer.md`, `agents/dh-reviewer.md`,
  `agents/dh-final-reviewer.md`, `agents/dh-documentor.md`; a shared short
  directive (workspace map → affected packages → scoped actions).
- **Out of Scope for This Sub-Task:** Changing agent modes, tools, or the
  capability-selection protocol.
- **Instructions:** Add a "Workspace first" section to each agent: read
  `WORKSPACE.md`/map when present, name affected packages, use package-scoped
  commands/diffs/docs, fall back to the single root.
- **Acceptance Criteria:** All five agents include the directive; standalone
  behavior remains unchanged; audit R8 is addressed.
- **Cautionary Points:** Keep the agent files under the 300-line limit; avoid
  duplicating the full map schema.
- **Implementation Suggestions:** Use the same three-bullet directive in every
  agent and link the map reference.
- **Testing Suggestions:** Frontmatter/audit tests; structural test for the
  directive.
- **Done When:** Every agent is workspace-first and standalone-safe.

#### Sub-Task 4.2: Add monorepo fixtures and tests and run the full QA gate

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Prove the workspace behavior with fixtures and the full gate.
- **Related Requirements:** R1-R8
- **Dependencies and Preconditions:** All previous sub-tasks.
- **In Scope for This Sub-Task:** Fixtures for pnpm/npm workspaces, Nx/Turbo,
  Cargo workspace, Go work and submodules; tests for detection, plan/SDD
  fields, diff scoping, rule resolution, docs roots, graph routing, version
  policy, worktree discovery and pause/resume; `pnpm qa:check:full`.
- **Out of Scope for This Sub-Task:** Real external builds; publishing;
  installing new toolchains.
- **Instructions:** Keep fixtures small and text-only; assert the documented
  contracts rather than running real package managers where possible; fix any
  gate failures.
- **Acceptance Criteria:** New tests pass, legacy tests pass, `pnpm
  qa:check:full` is green, and each R has at least one test or structural
  assertion.
- **Cautionary Points:** Do not bake machine-specific paths into fixtures; keep
  the full gate runtime reasonable.
- **Implementation Suggestions:** Reuse temp-dir helpers; isolate fixtures per
  layout; prefer structural assertions for skill prose and parser tests for
  plan fields.
- **Testing Suggestions:** `pnpm qa:check:full`; targeted vitest runs; audit.
- **Done When:** The gate is green and the workspace contracts are covered.

#### Sub-Task 4.3: Update user-facing docs, plan index and CHANGELOG

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Objective:** Document the workspace contract and the new behavior for users
  and future agents.
- **Related Requirements:** R8
- **Dependencies and Preconditions:** 1.1 contract; 4.2 green gate.
- **In Scope for This Sub-Task:** `AGENTS.md`, `README.md`,
  `docs/LOADING.md`, `skills/index.md` (no count change), `CHANGELOG.md`, and
  the audit cross-link; the plan index row description.
- **Out of Scope for This Sub-Task:** Rewriting historical plans/evolution
  notes; changing skill counts.
- **Instructions:** Summarize the four roots, the start-at-workspace-root rule,
  `DH_WORKSPACE_ROOT`, the workspace map, per-package gates/reviews, docs and
  version policy; keep the CHANGELOG entry under `[Unreleased]`.
- **Acceptance Criteria:** Docs are internally consistent, links resolve, the
  audit is linked, and the CHANGELOG describes the change.
- **Cautionary Points:** Do not duplicate the full map schema; link the
  reference; preserve unrelated docs.
- **Implementation Suggestions:** Update the docs after the behavior is final;
  run `pnpm lint:links`.
- **Testing Suggestions:** `pnpm lint:links`, `pnpm run audit`.
- **Done When:** User docs and CHANGELOG describe the workspace contract and all
  links resolve.

## Final Integration & Verification

- **System-Wide Test:** Build a temp pnpm workspace with `apps/web` (TS) and
  `services/api` (Python) plus a submodule-like nested root; run the documented
  setup/detection, planning workspace impact, per-package gates, scoped review,
  docs root decision, graph routing (documented), version policy, worktree
  discovery and pause/resume fallback; assert the standalone path still works.
- **Completion Checklist:**
  - [x] All sub-tasks and phases `Completed`.
  - [x] `pnpm qa:check:full` green.
  - [x] Every audit P0/P1 finding is addressed or explicitly deferred with a
        recorded reason.
  - [x] No legacy plan/parser regression.
  - [x] Docs, plan index, CHANGELOG and the audit cross-link are updated.
  - [ ] The plan's `## Execution Record` and the index execution row contain
        the real repo/path, mirrored plan path, summary and architectural
        changes.
  - [x] Standalone repositories with no workspace markers behave exactly as
        before.

## Execution Record

- **Execution status:** In progress
- **Executed at:** 2026-11-11
- **Workspace root:** `/home/andres/workspace/dev-harness-skills`
- **Repository kind:** workspace
- **Repository path:** `.`
- **Branch / worktree:** `feature/harness-monorepo-awareness` (main checkout)
- **Commit range:** `7e2eb14..uncommitted` (finalized at T3)
- **Plan path:** `docs/plans/harness-monorepo-awareness/plan.md`
- **Mirrored plan path:** `none`
- **Summary:**
  - Added the workspace contract, workspace map detection and anchor verification.
  - Added Workspace Impact and Execution Record contracts, per-package gates and
    scoped reviews, and root/package CODE_RULES inheritance.
  - Added workspace-aware docs roots, code-graph routing, semver policy,
    worktree/submodule discovery, and package-scope pause/resume/domain mapping.
  - Added workspace-first agent guidance, monorepo fixtures/tests, and user docs.
- **Architectural changes:** workspace/package/plan/vault root model;
  `DH_WORKSPACE_ROOT` + start-at-root anchor; workspace map and per-package
  command matrix; package-scoped gates/reviews; root/package CODE_RULES
  precedence; docs-root decision; code-graph index routing; fixed/independent
  semver policy; root/submodule worktree lifecycle; package-scope pause/resume;
  execution provenance in plan + index.
- **References:** [audit](../../audits/2026-11-10-skills-agents-standalone-monorepo.md),
  [contract](workspace-contract.md), [reviews](tasks/).

## Open Questions

- **Resolved — plan root:** the workspace-root `docs/plans` is the only plan
  root; package-local plan directories are not supported. Execution provenance
  references the real repository/path and any mirrored plan path.
- Versioning default: fixed (one tag) unless the workspace map detects/chooses
  independent releases; confirm with the user at release time.
- Worktree lifecycle discovery for submodules: discover automatically, but
  require confirmation before running nested lifecycle steps.
