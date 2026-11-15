---
title: TUI Plan Progress
slug: tui-plan-progress
description: Add an OpenCode TUI part to dev-harness-skills that shows live plan-execution progress in the sidebar and a full session panel (phases, sub-tasks, checklists, current agent/activity).
tags: [sdd, design, harness, tui, opencode, plans]
project: dev-harness-skills
stack: TypeScript + Solid/OpenTUI + OpenCode TUI plugin API
created: 2026-11-15
updated: 2026-11-15
status: proposed
---

# Software Design Document: TUI Plan Progress

## Problem Statement

Plan execution is currently observable only by opening
`docs/plans/<slug>/plan.md`, `plan_fast.md`, `tasks/review.md` or the
`docs/plans/index.md` table. During a long execution the TUI shows the
conversation but not the harness state: which phase/sub-task is active, how much
is complete, which delegated agent is responsible, what checklist remains, and
what the session is doing right now. Users must repeatedly leave the TUI and
inspect files to answer "where are we?" and "what is happening?".

OpenCode V2 TUI plugins can contribute JSX to `sidebar.content` and
`sidebar.footer`, register `session.panel` contributions opened from commands,
and read session data/events from the TUI context. The harness already has a
server part; adding a `./tui` part alongside it is the natural integration point.

References:
- [OpenCode TUI plugins](https://opencode.ai/v2/docs/build/plugins/cli)
  (`Session panels`, `Slots`, `Commands and keymaps`, `Storage`).
- Existing server plugin: `src/plugin.ts`; plan tooling:
  `src/tools/plan-lifecycle.ts`, `src/tools/plan-paths.ts`.

## Goals / Non-Goals

- **Goals:**
  - Ship a TUI part (`./tui`) in the same `dev-harness-skills` package, loaded
    automatically beside the server part.
  - Show an always-visible **sidebar card** with the active plan, progress,
    current phase/sub-task, delegated agent and a one-line current activity.
  - Provide a **full session panel** (`/plan-progress`) with the phase list,
    every sub-task status/agent, checklists, review/gate state and last update.
  - Keep the display **read-only**; no plan status mutations from the TUI.
  - Refresh on plan-file changes without blocking the UI; handle no active plan,
    multiple plans, malformed plans and missing files gracefully.
  - Preserve standalone and monorepo workspace behavior; resolve plans at the
    workspace root, never a package-local `docs/plans`.
  - Package and install the TUI part in all supported modes (source, npm
    package, managed installer).
- **Non-Goals:**
  - Editing plan statuses, sub-tasks, checklists or reviews from the TUI.
  - Remote-server plan files (v1 reads the local workspace; remote support is a
    follow-up).
  - New MCP tools or server tools for progress; the TUI reads plans directly for
    v1.
  - Notifications, web/GUI panels, or auto-opening the panel.
  - Replacing `dh-execute-plan`/`dh-review` or the existing plan tooling.

## Requirements

- **R1 — TUI part:** the package exports `./tui`; OpenCode loads it beside the
  server part; the plugin id is prefixed (`dev-harness-skills.tui`); setup
  returns a cleanup function.
- **R2 — Sidebar progress:** a `sidebar.content` contribution shows the active
  plan title/slug, phase and sub-task position, completed/total counts, a
  text-based progress bar, the current sub-task's delegated agent, its status,
  and a one-line current session activity. It must remain readable at narrow
  widths and use theme tokens plus symbols/text (not color alone).
- **R3 — Session panel:** a `session.panel` contribution opened by
  `/plan-progress` (and a palette command) shows every phase and sub-task with
  status, delegated agent, checklists (plan checkboxes, Done When/acceptance
  items and the final verification checklist), review verdict, fast-mode
  skipped-check ledger state, and the last plan update. Keyboard: close,
  fullscreen, refresh.
- **R4 — Progress model:** a pure parser resolves the active plan from the
  workspace `docs/plans` (frontmatter `active`/`status`/`updated`, index row as
  fallback), parses phases/sub-tasks via the existing plan format, derives
  counts/current position/checklists, and never writes. Multiple active plans
  are surfaced as a selector; none/malformed plans show an empty/error state.
- **R5 — Refresh:** plan file changes are reflected without UI jank (watch or
  bounded poll with debounce/throttle); watchers and timers are disposed on
  cleanup; the parser runs off the render path where practical. Local workspace
  only for v1.
- **R6 — Current activity:** derive a concise "what is happening" line from the
  session data/events (session status, current message/agent/tool where
  available); fall back to the active sub-task + delegated agent when the
  session data is unavailable or idle.
- **R7 — Packaging/build:** a tsdown TUI entry produces `dist/tui.js`;
  `package.json` exposes `./tui` and declares OpenTUI/Solid peers; JSX builds
  under the repo toolchain; `@opencode/plugin/tui` resolves at runtime; the
  managed installer copies the TUI artifact and its package exports; existing
  server packaging is unchanged.
- **R8 — Docs and tests:** user docs explain the sidebar, `/plan-progress`,
  loading (`opencode.jsonc`/`cli.json`) and limitations; unit tests cover the
  parser/watcher/activity mapping; a smoke test loads the TUI bundle; the full
  QA gate passes. No new bundled skills or agents; counts stay 5 agents + 26
  skills.

## Acceptance Criteria

- **AC1:** With a built package and the plugin enabled, the TUI shows the
  sidebar card when an active plan exists and hides/degrades cleanly when none
  exists.
- **AC2:** The sidebar card shows plan, position, counts, progress, delegated
  agent, status and activity, and updates within a short debounce after a plan
  file changes.
- **AC3:** `/plan-progress` opens a panel listing every phase/sub-task with
  statuses/agents and checklists; close/fullscreen/refresh work; the panel is
  read-only.
- **AC4:** The parser selects exactly one active plan (or asks/selects when
  multiple), handles missing/malformed plans, and never writes to `docs/plans`.
- **AC5:** Activity line reflects session status/agent/tool when available and
  falls back to the active sub-task/agent; no secrets or full message contents
  are rendered.
- **AC6:** Plan resolution respects the workspace root (no package-local
  `docs/plans`) and works in standalone and monorepo layouts.
- **AC7:** Source, npm tarball and managed-install modes all load the TUI part;
  the installer manifest/checks include `dist/tui.js`; existing server smoke
  tests remain green.
- **AC8:** Unit/smoke tests and `pnpm qa:check:full` pass; docs describe usage,
  loading and the local-only v1 limitation.

## Assumptions and Constraints

- Target OpenCode V2 TUI API as documented on 2026-11-15; exact session-status
  and event shapes are validated in Phase 1 against the installed typings.
- The TUI part runs in the local terminal process and can read the local
  workspace; remote-server plan files are out of scope for v1.
- Plans remain at the workspace root and keep the existing phased format; no
  parser format change is required.
- Checklist display is derived from existing markdown (checkboxes,
  `Done When`/acceptance criteria, final verification); no new plan fields are
  required for v1.
- No new server tools or MCP changes; the TUI is a presentation layer.
- The managed installer remains self-contained; TUI runtime peers must resolve
  from the OpenCode host or be bundled after the Phase 1 build spike.

## Risks

- **TUI API drift:** session status/event shapes may differ from the docs;
  Phase 1 pins the installed typings and writes fallbacks.
- **JSX/Solid build:** tsdown/oxc JSX configuration and OpenTUI peer resolution
  may need a build spike; keep the server build untouched.
- **Managed-install resolution:** a managed copy without `node_modules` may not
  resolve `solid-js`/`@opentui`; decide bundle-vs-peer after the spike.
- **File watching:** recursive `fs.watch` differs across platforms; use a
  bounded poll fallback and dispose watchers.
- **UI noise:** the sidebar is always visible; keep the card compact and make
  the detailed panel opt-in.
- **Read-only safety:** never expose secrets/message bodies; show plan and
  session metadata only.

## Open Questions

- Should the v1 activity line use `session.status` only, or also the current
  tool/message event? Phase 1 validates what is available and chooses the
  richest stable signal.
- Should multiple active plans auto-select the most recently updated one or
  require a selector? Proposed: selector, with the latest as a suggestion.
- Should the sidebar include a compact footer status in addition to
  `sidebar.content`? Proposed: one card only; revisit after visual review.
- Is the TUI part loaded for source-mode `file://` plugins without a build?
  Proposed: require `pnpm build` for TUI; document the build step.
- Remote-server support: defer; record as a follow-up after v1.
