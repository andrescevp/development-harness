# dev-harness-skills

An [OpenCode](https://opencode.ai) V2 plugin that bundles an opinionated development harness for plan-driven development with 7 agents and 16 skills.

## Features

- **Plan-driven loop**: Automated 5-step engineering lifecycle covering planning, phased execution, review, verification, and documentation.
- **Phased plans**: Dual-status progress tracking across phases and sub-tasks with strict halt-on-blocker safeguards.
- **7 agents and 16 skills**: Purpose-built agents and skills operating via runtime delegation without bundled commands or prompts.
- **Plan lifecycle tools**: Built-in `dh_plan_read`, `dh_plan_update_status`, and `dh_plan_create` tools for programmatic plan management in `docs/plans`.
- **DuckDB sheet tools**: Integrated tools (`dh_read_sheet`, `dh_update_sheet`, `dh_sheet_schema`) for SQL querying and editing of tabular data.
- **Logged executor strategy**: `dh_logged_command` captures full command execution logs in the OS temp directory while streaming head/tail windows.
- **Full QA gate**: Thorough verification suite integrating Biome, Knip, jscpd, dependency-cruiser, OSV-Scanner, Semgrep, Vitest, and TypeScript.
- **Source-mode loading**: Automatic discovery by OpenCode via root `index.ts` with direct asset loading from the repository.

## Installation

### Global (all projects)

Clone the repository into your global OpenCode plugins directory:

```sh
git clone https://github.com/andrescevp/development-harness.git ~/.config/opencode/plugins/dev-harness-skills
cd ~/.config/opencode/plugins/dev-harness-skills && pnpm install
```

OpenCode automatically discovers plugin package directories containing an `index.ts` entry under its plugins folder. **Restart OpenCode after cloning** — plugins load at server startup; a session started before the install shows nothing. The plugin registers its 7 `dh-*` agents and 15 `dh-*` skills automatically (requires `@opencode/plugin` ≥ 2.0.20; pinned `^2.0.20` in the repo).

### Per-project

To scope the harness to a specific project, clone into the project plugins folder with the same install step:

```sh
mkdir -p <project>/.opencode/plugins
git clone https://github.com/andrescevp/development-harness.git <project>/.opencode/plugins/dev-harness-skills
cd <project>/.opencode/plugins/dev-harness-skills && pnpm install
```

### Managed via OpenCode CLI

Install the plugin directly using the OpenCode CLI:

```sh
opencode plugin add github:andrescevp/development-harness
```

This works with private repositories through your existing Git credentials. To refresh the plugin:

```sh
opencode plugin update
```

### From source / development

Clone the repository, install dependencies, build the bundle (tsup bundle + dist/assets), and configure OpenCode:

```sh
git clone https://github.com/andrescevp/development-harness.git
cd development-harness
pnpm install
pnpm build
```

Then load via `file:///path/to/dev-harness-skills` in your `opencode.json` or `opencode.jsonc` plugins array:

```json
{
  "plugins": [
    "file:///path/to/dev-harness-skills"
  ]
}
```

## Quickstart

1. Check that the plugin loaded successfully:

```sh
opencode debug agents
opencode debug skills
```

Confirm that the 7 `dh-` agents and 15 `dh-` skills appear and that zero commands are registered.

2. Audit your environment and initialize QA:

Ask `@dh-software-architect` to run `dh-setup` to audit system tools and configure project QA hooks.

3. Establish project coding conventions:

Run `dh-code-ruler` to interview requirements, inspect codebase patterns, and generate `CODE_RULES.md` at the project root.

4. Plan and implement features:

Run `dh-grill-sdd` to generate requirements (`sdd.md`), create a phased plan using `dh-planning`, and execute it with `dh-execute-plan`.

## How it works

Plan execution inside the plugin runs the 5-step skills loop:

1. `dh-planning` — Prepares phased plans, validating architectural constraints with `dh-domain-check`.
2. `dh-execute-plan` — Iterates through phases in sequential order and executes their sub-tasks:
   - 2.1 `dh-execute-plan-task` — Implements the sub-task code using `dh-coding`.
   - 2.2 `dh-simplify` — Refactors and simplifies changed code for clarity and reuse.
   - 2.3 `dh-review` + `dh-code-review` — Verifies acceptance criteria and code correctness.
   - 2.4 Hard blockers — If 3 consecutive validation failures occur or unresolved P0/P1 review findings arise, the loop stops and asks the user for guidance.
3. `dh-preflight` + `dh-artifact-check` — Runs static analysis, tests, and build artifact validation.
4. `dh-final-review` — Reports per-phase completion and provides final plan-level sign-off.
5. `dh-create-documentation` — Generates and updates project documentation.

### Phased plan model

Plans are stored under `docs/plans/<slug>/plan.md` using a phased structure. Every phase and sub-task maintains a dual status marker (`Pending`, `In Progress`, or `Completed`). A phase cannot transition to `Completed` until all of its sub-tasks are marked `Completed`. When a hard blocker is reached, automation halts immediately so that blockers are never bypassed.

### Bundled tools

The plugin registers custom V2 tools under the `dh` namespace:

- **Plan lifecycle**: `dh_plan_read` parses phased plans into structured JSON, `dh_plan_update_status` safely edits status markers, and `dh_plan_create` scaffolds new phased plans.
- **Logged execution**: `dh_logged_command` runs commands locally while directing full output to a file in the system temporary directory, returning head and tail line windows.
- **Tabular sheets**: `dh_read_sheet`, `dh_update_sheet`, and `dh_sheet_schema` provide DuckDB-backed querying, updating, and schema inspection for CSV and XLSX files.

## Agents & skills

The plugin defines 7 agents and 16 skills using `@opencode/plugin` (`Plugin.define`). Zero command transforms are registered.

### Agents

| Agent | Role |
|---|---|
| `dh-software-architect` | Senior architect for system design, planning, plan execution orchestration, and documentation. |
| `dh-software-engineer` | Senior software engineer handling all sub-task implementation and TDD coding. |
| `dh-reviewer` | Scoped code reviewer evaluating changes against sub-task criteria and code quality. |
| `dh-final-reviewer` | Final reviewer conducting full diff review and plan-level sign-off. |
| `dh-executor` | Execution agent running commands, tests, builds, and validation via logged command strategy. |
| `dh-explorer` | Codebase exploration agent using fast glob, grep, and targeted reads. |
| `dh-documentor` | Documentation agent responsible for creating, updating, and maintaining project documentation. |

### Skills

| Skill | Role |
|---|---|
| `dh-planning` | Creates phased plans in `docs/plans/<slug>/plan.md`. |
| `dh-domain-check` | Validates domain boundaries and SOLID design during planning and execution. |
| `dh-contingency` | Generates Plan A/B/C architectural alternatives with risk, complexity, and trade-off analysis. |
| `dh-execute-plan` | Orchestrates the end-to-end execution and status tracking of phased plans. |
| `dh-execute-plan-task` | Executes an individual sub-task by delegating to `@dh-software-engineer`. |
| `dh-coding` | Applies TDD best practices and enforces rules from `CODE_RULES.md`. |
| `dh-simplify` | Streamlines changed code to remove redundancy and reduce complexity. |
| `dh-review` | Verifies sub-task implementations against specified acceptance criteria. |
| `dh-code-review` | Inspects code changes for security, robustness, and style conformance. |
| `dh-preflight` | Executes the full test, lint, and static analysis verification suite. |
| `dh-artifact-check` | Validates build artifacts, distribution packages, and deployment scripts. |
| `dh-final-review` | Performs final plan-level verification and delivers completion verdicts. |
| `dh-create-documentation` | Generates and updates documentation in the project docs directory. |
| `dh-grill-sdd` | Conducts interactive requirement interviews to produce `sdd.md` specification documents. |
| `dh-setup` | Audits system tools, user plugins, MCPs, and project quality configuration. |
| `dh-code-ruler` | Interviews users and inspects code to generate project-level `CODE_RULES.md`. |

## Development

Run development, test, and verification workflows with `pnpm`:

```sh
pnpm install
pnpm test
pnpm run audit
pnpm typecheck
pnpm build
node scripts/smoke-load.mjs
pnpm qa:check
pnpm qa:check:full
pnpm format:biome
```

Use `pnpm run audit` to run the harness consistency audit (`pnpm audit` runs pnpm's package security audit).

## Repository layout

```text
index.ts         Root plugin entry point for OpenCode plugin discovery (source mode)
agents/          Markdown definitions and system prompts for the 7 bundled agents
skills/          Instructions, templates, and references for the 16 bundled skills
src/             TypeScript source code, asset loaders, type definitions, and tools
scripts/         Audit, asset packaging, and smoke-testing scripts
test/            Vitest unit and registration tests
docs/            Plugin documentation, loading guides, and phased implementation plans
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — Runtime contract: skills loop, phase lifecycle, tools, and delegation routing.
- [`docs/LOADING.md`](docs/LOADING.md) — Plugin loading methods, verification checklists, and troubleshooting.

## Contributing

Contributions are welcome. Please follow these workflow practices:

1. Fork the repository and create a branch following Git Flow conventions:
   - `feature/*` branched from `develop` for planned work
   - `bugfix/*` branched from `develop` for fixes to in-development work
   - `release/*` branched from `develop` when cutting a release
   - `hotfix/*` branched from `main` for production fixes
2. Follow Conventional Commits for all commit messages (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
3. Run the full QA gate and ensure all checks pass before opening a Pull Request:

```sh
pnpm qa:check:full
```
