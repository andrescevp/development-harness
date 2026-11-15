---
title: TUI Plan Progress
slug: tui-plan-progress
description: Add an OpenCode TUI part to dev-harness-skills that shows live plan-execution progress in the sidebar and a full session panel (phases, sub-tasks, checklists, current agent/activity).
created: 2026-11-15
updated: 2026-11-15
status: Pending
active: true
tags: [plan]
project: dev-harness-skills
---

# Plan: TUI Plan Progress

## Objective

Add a `./tui` part to the `dev-harness-skills` package so users can follow plan
execution without leaving OpenCode: an always-visible sidebar card with the
active plan, position, progress, delegated agent and current activity, plus a
`/plan-progress` session panel with the full phase/sub-task list, statuses,
checklists, review/gate state and last update. Read-only and local-first.

## Requirements Snapshot

- **R1:** The package exports `./tui`; OpenCode loads the TUI part beside the
  server part; plugin id `dev-harness-skills.tui`; setup returns cleanup.
- **R2:** A `sidebar.content` card shows the active plan, phase/sub-task
  position, completed/total counts, a text progress bar, delegated agent,
  status and one-line activity; readable at narrow widths and color-safe.
- **R3:** A `session.panel` opened by `/plan-progress` (and palette) shows every
  phase/sub-task with status, delegated agent, checklists, review verdict,
  fast-mode ledger state and last update; close/fullscreen/refresh work.
- **R4:** A pure parser resolves the active plan from the workspace
  `docs/plans`, derives progress/checklists, is read-only and handles
  none/multiple/malformed plans.
- **R5:** Plan changes refresh with debounce/throttle; watchers/timers dispose on
  cleanup; local workspace only for v1.
- **R6:** Current activity maps session status/events (agent/tool) with a
  fallback to the active sub-task/agent; no secrets or full message contents.
- **R7:** A tsdown TUI entry produces `dist/tui.js`; `package.json` exposes
  `./tui` with OpenTUI/Solid peers; the managed installer ships the TUI artifact
  and package exports; the server packaging is unchanged.
- **R8:** Docs explain loading/usage/limitations; unit/smoke tests and
  `pnpm qa:check:full` pass; 5 agents + 26 skills remain unchanged.

## Scope

- New TUI code under `src/tui/`: parser, watcher, activity mapper, components,
  plugin setup.
- `sidebar.content` card and `session.panel`; `/plan-progress` slash/palette
  command; refresh key.
- Build/package wiring: `exports["./tui"]`, tsdown entry, JSX/Solid config,
  peers, managed installer artifact.
- Tests/fixtures for the parser/watcher/activity; TUI bundle smoke/manual
  verification.
- User docs, CHANGELOG, plan close-out.

## Workspace Impact

- **Workspace root:** `None — standalone repository`
- **Affected packages:** `None — standalone`
- **Shared paths:** `None`

## Assumptions and Constraints

- Target OpenCode V2 TUI API as documented on 2026-11-15; exact session-status
  and event shapes are validated in 1.1 against the installed typings.
- The TUI part runs locally and reads the local workspace; remote-server plan
  files are out of scope v1.
- Plans stay at the workspace root and keep the phased format; no parser format
  change.
- Checklists come from existing markdown (checkboxes, Done When/acceptance,
  final verification); no new plan fields for v1.
- The TUI is read-only: no status, checklist, review or plan edits.
- No new server tools/MCP changes; the server build and plugin registration
  stay unchanged.
- The managed installer remains self-contained; TUI peers must resolve from the
  host or be bundled after the 1.3 spike.

## Risks and Areas Requiring Care

- **TUI API drift:** session status/events may differ from docs; pin the
  installed typings and implement fallbacks.
- **JSX/Solid build:** tsdown/oxc JSX and OpenTUI peer resolution may need a
  spike; do not disturb the server build.
- **Managed-install resolution:** a managed copy without `node_modules` may not
  resolve `solid-js`/`@opentui`; decide bundle-vs-peer in 1.3.
- **File watching:** recursive `fs.watch` differs across platforms; use a
  bounded poll fallback and dispose watchers.
- **UI noise:** the sidebar is always visible; keep the card compact and the
  detailed panel opt-in.
- **Privacy:** never render secrets, message bodies or full tool output; show
  plan/session metadata only.

## Core concepts

- **TUI part:** the `./tui` export of the package, defined with
  `Plugin.define` from `@opencode/plugin/tui`; it runs in the terminal process.
- **Slot:** JSX contribution point (`sidebar.content`, `session.panel`, ...)
  registered with `context.ui.slot({ append, render })`.
- **Session panel:** a slot contribution selected by `panel.name` and opened
  with `context.ui.panel.open("dev-harness-skills.plan")`; the host owns sizing
  and focus.
- **Progress model:** pure data derived from `docs/plans/*/plan.md`:
  `{ slug, title, status, phases[], counts, current, checklists, review, ledger,
  updatedAt }`.
- **Activity line:** `{ status, agent, tool?, summary }` derived from
  `context.data.session.status(sessionID)` and TUI events, falling back to the
  active sub-task's delegated agent.

## Visual Context

Architecture diagram:
[diagrams/architecture.md](diagrams/architecture.md).

## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Architecture / design | dh-software-architect | Bundled architecture capability; defines the progress/activity contracts. | bundled architecture capability |
| Implementation / engineering | dh-software-engineer | Bundled implementation capability; TUI code, build and tests. | bundled implementation capability |
| Testing / QA | dh-software-engineer | No project QA agent; the implementation agent authors and runs the gates. | bundled implementation capability |
| Review | dh-reviewer | Bundled scoped review capability. | bundled review capability |
| Final review | dh-final-reviewer | Bundled plan sign-off capability. | bundled final-review capability |
| Documentation | dh-documentor | Documentation owner for TUI docs and CHANGELOG. | bundled documentation capability |

Discovery: runtime list + project agent definitions; all six are the bundled
harness capabilities available in this runtime.

## Phases

### Phase 1: API and Build Contract

- **Status:** Pending

#### Sub-Task 1.1: Validate TUI APIs and session activity typings

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending

#### Sub-Task 2.1: Implement the plan progress parser

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending

#### Sub-Task 3.1: Implement the sidebar progress card

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending

#### Sub-Task 4.1: Wire the TUI build, package exports and peers

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending
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

- **Status:** Pending
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

## Final Integration & Verification

- **System-Wide Test:** Build the package; load the TUI part with an active plan
  fixture; verify the sidebar card, `/plan-progress` panel, refresh after a plan
  status change, empty state with no plan, and multiple-plan selection. Verify
  source/package/managed install modes load the TUI part and the server smoke
  tests remain green.
- **Completion Checklist:**
  - [ ] All 4 phases and 14 sub-tasks `Completed`.
  - [ ] TUI card and panel render with real plan data and refresh.
  - [ ] Data-layer tests and TUI smoke pass.
  - [ ] `pnpm qa:check:full` green.
  - [ ] Docs/CHANGELOG and execution record/index updated.
  - [ ] No new skills/agents; counts stay 5 agents + 26 skills.
  - [ ] Standalone and workspace plan resolution respected.

## Execution Record

- **Execution status:** Not executed
- **Executed at:** —
- **Workspace root:** —
- **Repository kind:** —
- **Repository path:** —
- **Branch / worktree:** —
- **Commit range:** —
- **Plan path:** `docs/plans/tui-plan-progress/plan.md`
- **Mirrored plan path:** `none`
- **Summary:** —
- **Architectural changes:** —
- **References:** —

## Open Questions

- Exact session activity fields (status-only vs tool/message) are resolved by
  1.1; the fallback is the active sub-task + delegated agent.
- Multiple active plans: selector with the latest suggested; confirm during 1.2.
- Managed-install TUI peer resolution: decided by 1.3 (bundle vs host peers).
- Remote-server plan files: deferred after v1.
