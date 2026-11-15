# Plans Index

## Execution Records

Rows are added when a plan is executed. The workspace-root plan remains the only plan root; the record points to the real repository/path, the mirrored plan path when applicable, the summary and the architectural changes.

| Slug | Executed in (repo/path) | Plan path | Mirrored plan path | Summary | Architectural changes | Date |
|---|---|---|---|---|---|---|
| tui-plan-progress | workspace: . | docs/plans/tui-plan-progress/plan.md | docs/plans/tui-plan-progress/plan_fast.md | TUI sidebar card + /plan-progress panel, plan progress data layer/activity, packaging/installer and tests | TUI part (`./tui`), host-peer model, read-only progress pipeline, managed TUI artifact, `@opencode/plugin` 2.2.7 pin | 2026-11-15 |
| harness-monorepo-awareness | workspace: . | docs/plans/harness-monorepo-awareness/plan.md | none | Workspace contract/map, per-package gates/reviews, docs/graph/semver/worktrees, agent guidance, fixtures | Workspace roots/anchor; Workspace Impact + Execution Record; package-scoped gates/reviews; CODE_RULES precedence; docs roots; graph routing; semver policy; worktree/submodule lifecycle; package-scope pause/resume | 2026-11-11 |

## Plans

| Title | Slug | Description | Created | Updated | Status | Active |
|---|---|---|---|---|---|---|
| Dev Harness V2 Plugin | dev-harness-v2-plugin | Build a standalone OpenCode V2 plugin in dev-harness-skills — 7 agents + 15 skills wired into a planning → execution → review → release loop, packaged via @opencode/plugin (Plugin.define, agent+skill transforms) | 2026-09-27 | 2026-09-28 | Completed | No |
| Dev Harness Phases and Tools | dev-harness-phases-and-tools | Extend the completed plugin: phased plan model across planning/execute-plan/execute-plan-task/review/final-review, harness-namespace plan lifecycle tools (plan_read, plan_update_status, plan_create) registered by the plugin, and removal of the permission key from bundled agent frontmatters | 2026-09-28 | 2026-09-28 | Completed | No |
| Dev Harness Audit Fixes | dev-harness-audit-fixes | Close 2026-10-11 audit gaps (points 1,2,3,4,7): bundled dh-semver skill (global semver adapted to the harness), dot-namespace tool refs, 7 agents + 17 skills counts, @opencode/plugin version consistency, audit script comment; source-map-js security override (GHSA-68fv-2mgg-jv7q) | 2026-10-18 | 2026-10-19 | Completed | No |
| Plugin Tools to MCP Server | plugin-tools-to-mcp | Remove opencode plugin tool registration (hard cut) and serve all 7 harness tools from a project-scope local MCP stdio server built on @modelcontextprotocol/server v2, started via npx from the git repo (bin dev-harness-mcp); atomic naming flip to dh_* / tools.dh.* across docs, skills, agents and configs | 2026-10-19 | 2026-10-19 | Completed | No |
| npx Install Entrypoint | npx-install-entrypoint | Add an npx-runnable dev-harness CLI (install/status/uninstall) that materializes the plugin into global or project OpenCode scope and wires mcp.servers.dh with JSONC-preserving, idempotent, ownership-safe operations; publishable npm package installable via npm and opencode plugin add (npm + Git specs), plus a Docker test env derived from ghcr.io/anomalyco/opencode with read-only host Git credential mounts | 2026-10-21 | 2026-10-21 | Pending | Yes |
| Pause and Resume Plan Skills | pause-resume-plan-skills | Add dh-pause-plan and dh-resume-plan with a versioned handoff.md sidecar, drift-safe resume, an execute-plan guard, a handoff contract test, and a 19-skill inventory/docs update | 2026-11-07 | 2026-11-07 | Completed | No |
| Agent Selection and Utility Skills | agent-selection-utility-skills | Replace hardcoded dh-agent delegation with runtime agent selection and migrate dh-executor/dh-explorer to dh-execute-cli/dh-explore skills | 2026-11-08 | 2026-11-08 | Completed | No |
| Harness Monorepo Awareness | harness-monorepo-awareness | Make the bundled skills and agents workspace-aware for standalone and nested monorepo projects: workspace/anchor contract, setup detection and workspace map, per-package gates/reviews, docs/graph/version/worktree handling, agent guidance and fixtures | 2026-11-10 | 2026-11-11 | Completed | No |
| TUI Plan Progress | tui-plan-progress | Add a `./tui` part with a sidebar progress card and a `/plan-progress` session panel for the active plan: parser, watcher, activity line, Solid/OpenTUI components, build/installer packaging, tests and docs | 2026-11-15 | 2026-11-15 | Completed | No |
