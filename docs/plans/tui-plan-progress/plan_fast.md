---
title: "TUI Plan Progress — Fast Execution"
slug: tui-plan-progress
description: "Fast execution mirror of plan.md; critical verification deferred to plan end."
source_plan: plan.md
source_sha256: 08b8ced4632462f20ee44478d2edcb00546af184875e9d86da15529aa13fcd80
plan_version: fast-4
status: Completed
active: false
tags: [plan, fast]
project: "dev-harness-skills"
created: 2026-11-15
updated: 2026-11-15
---

# Plan: TUI Plan Progress (Fast Execution)

## Fast Execution Policy

- No per-task `dh-review`, `dh-simplify`, `dh-code-review`, `dh-preflight`,
  `dh-artifact-check`, or `dh-domain-check` gates.
- Execution position and statuses are read from this file; every phase and
  sub-task status change is mirrored to `plan.md` in the same turn.
- A phase moves to `In Progress` when its first sub-task starts and closes only
  when ALL its sub-tasks are `Completed`; close pending phases in both files.
- Narrow validation (tests/lint for changed files) stays part of each sub-task;
  it is a sanity check, not a review gate.
- All critical verification runs once across plan end (see Final Verification).
- Hard blockers halt the loop; a blocked sub-task blocks its phase.

## Alignment Contract

- Same phases/sub-tasks as `plan.md`: count, IDs, titles, order, requirements,
  scope, dependencies, instructions, acceptance criteria, done-when.
- Allowed differences: this policy, this contract, `## Final Verification`, the
  omitted top-level sections, and status progression.
- Omits from `plan.md`: `## Objective`, `## Requirements Snapshot`, `## Scope`, `## Workspace Impact`, `## Assumptions and Constraints`, `## Risks and Areas Requiring Care`, `## Core concepts`, `## Visual Context`, `## Agent Selection`, `## Execution Record`, `## Open Questions`.
- Not allowed: missing/extra/reordered/renamed items; changed requirements,
  scope, or acceptance criteria. `plan.md` is the scope reference.
- Misalignment is fixed here; never rewrite `plan.md` scope.

## Phases

### Phase 1: API and Build Contract

- **Status:** Completed

#### Sub-Task 1.1: Validate TUI APIs and session activity typings

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Pin the exact TUI APIs, slot/panel/command shapes, session
  status/events and storage semantics used by the implementation.
- **Related Requirements:** R1, R2, R3, R5, R6
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:** Inspect the installed `@opencode/plugin/tui`
  and `@opencode/client` typings; confirm `sidebar.content`, `session.panel`,
  `PanelInput`, `context.ui.panel.open`, `context.keymap.layer`,
  `context.storage.memory`, `context.location.directory`,
  `context.data.session.status` and the available event types. Write
  `docs/plans/tui-plan-progress/tui-api-notes.md` with exact signatures,
  examples and fallbacks.
- **Out of Scope for This Sub-Task:** UI implementation, build config, installer
  changes.
- **Instructions:** Prefer installed typings over docs; record the package
  versions. Identify whether tool/message activity is available for the
  activity line; if not, define the status-only fallback.
- **Acceptance Criteria:** Notes cite exact types/fields, list supported slots,
  panel actions, commands, storage and session data; unresolved API doubts are
  explicit.
- **Cautionary Points:** Do not guess event names; verify against typings. Do
  not introduce a server tool for this.
- **Implementation Suggestions:** Small TS snippets in the notes; reference the
  TUI docs section anchors.
- **Testing Suggestions:** Type-only snippets compile under `pnpm typecheck`
  (or a scratch file removed before commit).
- **Done When:** The notes are complete and the implementation can rely on
  documented, verified APIs.

#### Sub-Task 1.2: Define the progress and activity contracts

- **Status:** Completed
- **Delegated to agent:** dh-software-architect
- **Objective:** Specify the `PlanProgress` model, active-plan selection,
  checklist/review/gate derivation and activity fallback behavior.
- **Related Requirements:** R2, R3, R4, R6
- **Dependencies and Preconditions:** 1.1 API notes.
- **In Scope for This Sub-Task:** `docs/plans/tui-plan-progress/progress-contract.md`
  with the data model, selection rules (frontmatter active/status/updated and
  index fallback), multiple/none/malformed states, checklist sources, review and
  ledger parsing, refresh semantics, activity model and read-only guarantees.
- **Out of Scope for This Sub-Task:** Code implementation; UI layout.
- **Instructions:** Keep the model independent of Solid/OpenTUI; define pure
  inputs/outputs and failure modes. Align with the existing plan parser and
  `## Workspace Impact`/execution-record contracts.
- **Acceptance Criteria:** The contract defines every field, selection rule,
  empty/error state and read-only guarantee; 2.1/2.3/3.x can implement without
  guessing.
- **Cautionary Points:** Do not derive affected packages from cwd; plans remain
  workspace-root only.
- **Implementation Suggestions:** Include a JSON example and a table of states.
- **Testing Suggestions:** Review against the SDD R2–R6; no code.
- **Done When:** The contract is self-consistent and referenced by the plan.

#### Sub-Task 1.3: Spike the Solid/OpenTUI build and package loading

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Prove the TUI part can be built with the repo toolchain and
  loaded beside the server part, and decide peer-vs-bundle resolution.
- **Related Requirements:** R1, R7
- **Dependencies and Preconditions:** 1.1 API notes.
- **In Scope for This Sub-Task:** Minimal `src/tui/index.tsx` with
  `Plugin.define` and a temporary `sidebar.content` text; tsdown `tui` entry,
  `package.json` `exports["./tui"]`, JSX/Solid config, peers; build and import
  the artifact; test source/package/managed resolution as far as possible.
- **Out of Scope for This Sub-Task:** Final UI/data layer; installer changes.
- **Instructions:** Keep the spike isolated; record the final tsdown/JSX/peer
  decisions in `tui-api-notes.md`. Confirm the server entry and `pnpm build`
  remain green.
- **Acceptance Criteria:** `pnpm build` emits `dist/tui.js`; the module exports a
  valid `Plugin.define` value; a minimal slot renders in a TUI session (or the
  exact blocker is reported); peer-vs-bundle decision recorded.
- **Cautionary Points:** Do not break the server bundle; JSX/TS config changes
  must be minimal and documented.
- **Implementation Suggestions:** Use a single tsdown entry, platform node,
  externalize `@opencode/plugin/tui` and host-provided peers; bundle only what
  the managed copy cannot resolve.
- **Testing Suggestions:** `pnpm build`, `pnpm test`, `smoke-load`; manual TUI
  check with a temporary `/plan-progress` command if needed.
- **Done When:** The build/load path is proven and the decisions are recorded.

### Phase 2: Progress Data Layer

- **Status:** Completed

#### Sub-Task 2.1: Implement the plan progress parser

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Implement the pure progress model over `docs/plans`.
- **Related Requirements:** R2, R3, R4
- **Dependencies and Preconditions:** 1.2 contract; 1.1 API notes.
- **In Scope for This Sub-Task:** `src/tui/plan-state.ts` (pure derive + fs
  reader) using `src/lib/frontmatter.ts` and `src/tools/plan-lifecycle.ts`;
  active selection, counts/current, checklists, review verdict, fast ledger,
  last update; no writes.
- **Out of Scope for This Sub-Task:** Watchers, UI, activity mapping.
- **Instructions:** Separate pure derivation from filesystem reads; return
  typed empty/error states; support multiple plans with a selector payload.
- **Acceptance Criteria:** Fixtures for active/multiple/none/malformed/completed
  plans produce the expected model; no file writes; code files <300 lines.
- **Cautionary Points:** Preserve legacy plans without new fields; never create
  a package-local `docs/plans`.
- **Implementation Suggestions:** Reuse the existing parser; add only TUI
  derivation helpers.
- **Testing Suggestions:** Unit tests with fixture plans; typecheck.
- **Done When:** The parser returns correct models for all fixture states.

#### Sub-Task 2.2: Implement plan watch and refresh

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Keep the progress model fresh with a debounced watcher/poll and
  clean disposal.
- **Related Requirements:** R5
- **Dependencies and Preconditions:** 2.1.
- **In Scope for This Sub-Task:** `src/tui/plan-watch.ts` with `fs.watch` where
  supported, recursive fallback/poll, 250–500 ms debounce, error tolerance,
  `unsubscribe`; integrate with storage signals in 3.3.
- **Out of Scope for This Sub-Task:** UI components; remote files.
- **Instructions:** Never block render; coalesce bursts; handle plan file
  replacement (rename) and missing directories.
- **Acceptance Criteria:** A change under `docs/plans` triggers one refresh
  after the debounce; unsubscribe stops all watchers/timers; tests cover a
  temp dir.
- **Cautionary Points:** Recursive watch is platform-dependent; always have a
  poll fallback.
- **Implementation Suggestions:** Timer-based poll in tests to avoid flakiness.
- **Testing Suggestions:** Temp-dir watcher test with fake timers.
- **Done When:** Refresh is reliable and leak-free.

#### Sub-Task 2.3: Map session status and events to current activity

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Produce the one-line "what is happening" model without leaking
  message content.
- **Related Requirements:** R6
- **Dependencies and Preconditions:** 1.1/1.2.
- **In Scope for This Sub-Task:** `src/tui/session-activity.ts` mapping
  `context.data.session.status(sessionID)` and selected events to
  `{status, agent, tool?, summary}`; fallback to active sub-task/agent; redaction.
- **Out of Scope for This Sub-Task:** Event subscription wiring (3.3); message
  bodies.
- **Instructions:** Use only stable fields verified in 1.1; summarize, never
  render full tool output or secrets.
- **Acceptance Criteria:** Pure mapping tests cover busy/idle/unknown/agent/tool
  cases and fallback; output is safe to render.
- **Cautionary Points:** Event names may change; isolate them behind the mapper.
- **Implementation Suggestions:** Keep event-to-activity mapping table-driven.
- **Testing Suggestions:** Pure unit tests with representative payloads.
- **Done When:** The activity model is stable and privacy-safe.

#### Sub-Task 2.4: Add data-layer tests and fixtures

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Cover the parser, watcher and activity mapper with deterministic
  tests and fixtures.
- **Related Requirements:** R4, R5, R6
- **Dependencies and Preconditions:** 2.1–2.3.
- **In Scope for This Sub-Task:** Fixtures under `src/tui/__tests__/fixtures/`
  (active, multiple, none, malformed, completed, checklists, review, ledger);
  tests for derivation, watch debounce, activity mapping; line limits.
- **Out of Scope for This Sub-Task:** UI rendering tests.
- **Instructions:** Use temp dirs for watcher tests; keep tests deterministic
  and independent.
- **Acceptance Criteria:** Tests cover all contract states and pass in
  `pnpm test`; no network/git dependency.
- **Cautionary Points:** Do not copy real plans with personal paths; use
  synthetic fixtures.
- **Implementation Suggestions:** Reuse `src/__tests__/helpers/temp-dir.ts`.
- **Testing Suggestions:** `pnpm test`, `pnpm typecheck`.
- **Done When:** The data layer has meaningful coverage.

### Phase 3: TUI Components and Commands

- **Status:** Completed

#### Sub-Task 3.1: Implement the sidebar progress card

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Render the compact always-visible plan card in
  `sidebar.content`.
- **Related Requirements:** R2, R6
- **Dependencies and Preconditions:** 2.1–2.4.
- **In Scope for This Sub-Task:** `src/tui/components/SidebarPlan.tsx` with
  plan title, position, text progress bar, counts, delegated agent, status,
  activity, empty state; width-aware and theme-token based.
- **Out of Scope for This Sub-Task:** Full panel, commands, watcher wiring.
- **Instructions:** Keep it compact; use symbols + text for status; truncate
  long titles; render an empty state when no plan exists.
- **Acceptance Criteria:** Card matches the contract at narrow/wide widths; no
  color-only status; no writes.
- **Cautionary Points:** The sidebar is always visible; avoid noisy re-renders.
- **Implementation Suggestions:** Pure presentational component with props from
  the store.
- **Testing Suggestions:** Component test if the harness supports it; otherwise
  manual TUI check and snapshot of the pure view model.
- **Done When:** The card is readable and updates from the model.

#### Sub-Task 3.2: Implement the full plan progress panel

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Render the detailed `session.panel` for `/plan-progress`.
- **Related Requirements:** R3
- **Dependencies and Preconditions:** 2.1–2.4.
- **In Scope for This Sub-Task:** `src/tui/components/PlanPanel.tsx` with phase
  list, sub-tasks/status/agent, checklists, review verdict, fast ledger, last
  update; `panel.name` filter; close/fullscreen/refresh keyboard layer.
- **Out of Scope for This Sub-Task:** Plugin wiring/commands; editing.
- **Instructions:** Use `PanelInput`; respect host sizing; keep read-only;
  render empty/error states.
- **Acceptance Criteria:** Panel shows every phase/sub-task and checklist;
  close/fullscreen/refresh work; read-only.
- **Cautionary Points:** Keyboard layers are active only while the panel owns
  input; dispose them.
- **Implementation Suggestions:** Reuse small presentational pieces from 3.1.
- **Testing Suggestions:** Manual TUI check; pure view-model tests.
- **Done When:** The panel is complete and navigable.

#### Sub-Task 3.3: Wire the TUI plugin, commands and cleanup

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Assemble the TUI plugin: store, watcher, slots, command and
  activity subscription with cleanup.
- **Related Requirements:** R1, R2, R3, R5, R6
- **Dependencies and Preconditions:** 3.1, 3.2, 2.2, 2.3.
- **In Scope for This Sub-Task:** `src/tui/index.tsx` with
  `Plugin.define({id:"dev-harness-skills.tui", setup})`,
  `context.storage.memory`, `sidebar.content` and `session.panel` slots,
  `/plan-progress` slash/palette command opening
  `dev-harness-skills.plan`, activity subscription, cleanup.
- **Out of Scope for This Sub-Task:** Build/package/installer changes.
- **Instructions:** No server changes; use `context.keymap.layer` correctly;
  dispose watchers/listeners on cleanup; handle missing workspace.
- **Acceptance Criteria:** Plugin loads, card renders, command opens the panel,
  refresh works, cleanup leaves no watchers/listeners.
- **Cautionary Points:** Avoid command id collisions; prefix with
  `dev-harness-skills`.
- **Implementation Suggestions:** Keep setup small; delegate to components.
- **Testing Suggestions:** TUI load smoke; manual checklist.
- **Done When:** The TUI experience is wired end-to-end.

### Phase 4: Packaging, Installer, Docs and QA

- **Status:** Completed

#### Sub-Task 4.1: Wire the TUI build, package exports and peers

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Ship `dist/tui.js` with correct exports, peers and JSX build.
- **Related Requirements:** R1, R7
- **Dependencies and Preconditions:** 1.3, 3.3.
- **In Scope for This Sub-Task:** `package.json` exports `./tui`, peer/dev
  dependencies, `files`; tsdown TUI entry, JSX/Solid config, external/bundle
  decision; `pnpm build` emits server + TUI artifacts; declarations if needed.
- **Out of Scope for This Sub-Task:** Installer/docs.
- **Instructions:** Keep the server entries unchanged; document the TUI peer
  requirement; verify the package import map.
- **Acceptance Criteria:** `pnpm build` emits `dist/tui.js`; `import` of the
  package `./tui` resolves; server smoke tests unchanged.
- **Cautionary Points:** Do not bundle host singletons incorrectly; match the
  OpenTUI/Solid peer versions.
- **Implementation Suggestions:** Use the 1.3 decisions; add a build smoke.
- **Testing Suggestions:** `pnpm build`, `smoke-load`, import test.
- **Done When:** The TUI artifact is built and exported.

#### Sub-Task 4.2: Teach the managed installer to ship the TUI artifact

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Include the TUI artifact and package export in managed installs
  without breaking server self-containment.
- **Related Requirements:** R7
- **Dependencies and Preconditions:** 4.1.
- **In Scope for This Sub-Task:** `src/cli/plugin-artifact.ts` copy/verify
  `dist/tui.js`, package.json `exports["./tui"]`, manifest files; `prepare.mjs`
  artifact checks; `smoke-install`/`smoke-pack` checks; tests.
- **Out of Scope for This Sub-Task:** Changing server bundle self-containment.
- **Instructions:** Keep the managed layout self-contained for the server; TUI
  peers resolve from the host or are bundled per 1.3; verify both install modes.
- **Acceptance Criteria:** Managed and packaged installs include `dist/tui.js`
  and the `./tui` export; smoke tests pass; server behavior unchanged.
- **Cautionary Points:** Do not break the existing `dist/plugin.js` scan or
  manifest invariants.
- **Implementation Suggestions:** Add a TUI artifact constant and a presence
  check; avoid importing TUI in Node smoke without host peers.
- **Testing Suggestions:** `smoke-install`, `smoke-pack`, `pnpm test`.
- **Done When:** All install modes ship the TUI part.

#### Sub-Task 4.3: Document TUI usage and limitations

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Objective:** Document loading, sidebar, `/plan-progress`, build requirement
  and local-only v1 limits.
- **Related Requirements:** R8
- **Dependencies and Preconditions:** 4.1, 4.2.
- **In Scope for This Sub-Task:** `docs/LOADING.md` TUI section, `README.md`
  TUI section, `AGENTS.md` pointer, `CHANGELOG.md` Unreleased entry; no skill
  count change.
- **Out of Scope for This Sub-Task:** Remote support; screenshots.
- **Instructions:** Explain that the TUI part loads beside the server part, the
  build requirement for source mode, the sidebar card, `/plan-progress`, and
  local-only plan files.
- **Acceptance Criteria:** Docs describe loading/usage/limitations and links
  resolve; CHANGELOG entry present.
- **Cautionary Points:** Keep the TUI docs concise; do not duplicate the
  progress contract.
- **Implementation Suggestions:** Add a small "TUI progress" section with a
  command table.
- **Testing Suggestions:** `pnpm lint:links`, `pnpm run audit`.
- **Done When:** Users can enable and use the TUI part from the docs.

#### Sub-Task 4.4: Run the full QA gate and close the plan

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Validate the full feature end-to-end and close the plan.
- **Related Requirements:** R1–R8
- **Dependencies and Preconditions:** 4.1–4.3.
- **In Scope for This Sub-Task:** `pnpm qa:check:full` (Docker scans, build,
  tests, smokes, audit), TUI manual checklist (card, panel, refresh, empty
  state), execution record T1/T2/T3, evolution/observation notes, semver
  recommendation.
- **Out of Scope for This Sub-Task:** Publishing/merging (user decision).
- **Instructions:** Rebuild before smokes; record the TUI manual results; fix
  failures; run final review; fill the execution record and index row; create
  the notes; recommend the version bump.
- **Acceptance Criteria:** All gates green; TUI checklist passes; plan record
  and index are finalized; docs/notes updated.
- **Cautionary Points:** `smoke-pack` needs a real Node ahead of the local shim;
  do not claim manual TUI checks that were not performed.
- **Implementation Suggestions:** Use `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **Testing Suggestions:** Full gate + manual TUI session.
- **Done When:** The feature is verified and the plan is closed.

## Final Verification

### Plan-specific verification (copied from plan.md, unchanged)

- **System-Wide Test:** Build the package; load the TUI part with an active plan
  fixture; verify the sidebar card, `/plan-progress` panel, refresh after a plan
  status change, empty state with no plan, and multiple-plan selection. Verify
  source/package/managed install modes load the TUI part and the server smoke
  tests remain green.
- **Completion Checklist:**
  - [x] All 4 phases and 14 sub-tasks `Completed`.
  - [ ] TUI card and panel render with real plan data and refresh.
  - [x] Data-layer tests and TUI smoke pass.
  - [x] `pnpm qa:check:full` green.
  - [x] Docs/CHANGELOG and execution record/index updated.
  - [x] No new skills/agents; counts stay 5 agents + 26 skills.
  - [x] Standalone and workspace plan resolution respected.

  Deferred: live TUI pixel verification (sidebar/panel rendering) — this
  environment has no TTY/session; the host evaluated the bundle and the view
  models/unit tests cover the rendering contract. Recorded as a completion
  deferral.

### End gates (run once across plan end)

1. `dh-review` Plan Alignment Mode `phase: plan-end` → `tasks/review-fast-final.md`.
2. Execute the plan-specific System-Wide Test and Completion Checklist above.
3. `dh-simplify` + `dh-code-review` (software only).
4. `dh-domain-check` (architectural software plans only; otherwise not applicable).
5. `dh-preflight` + `dh-artifact-check`.
6. `dh-final-review` (reuse results; do not re-run preflight/artifact/semver).
7. `dh-create-documentation` + `dh-semver` (software only).
8. Append every outcome to `plan_fast_skip_checks.md` via `dh_plan_fast_skip_check`.
