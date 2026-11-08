# dev-harness-skills

An [OpenCode](https://opencode.ai) V2 plugin that bundles an opinionated development harness for plan-driven development with 7 agents and 17 skills.

## Features

- **Plan-driven loop**: Automated 5-step engineering lifecycle covering planning, phased execution, review, verification, and documentation.
- **Phased plans**: Dual-status progress tracking across phases and sub-tasks with strict halt-on-blocker safeguards.
- **7 agents and 17 skills**: Purpose-built agents and skills operating via runtime delegation without bundled commands or prompts.
- **`dh` MCP server (7 tools)**: A project-scope local stdio MCP server serves `dh_plan_read`, `dh_plan_update_status`, `dh_plan_create`, `dh_read_sheet`, `dh_update_sheet`, `dh_sheet_schema`, and `dh_logged_command` (Code Mode: `tools.dh.<tool>`). The plugin itself registers agents and skills only.
- **Full QA gate**: Thorough verification suite integrating Biome, Knip, jscpd, dependency-cruiser, OSV-Scanner, Semgrep, Vitest, and TypeScript.
- **Source-mode loading**: Automatic discovery by OpenCode via root `index.ts` with direct asset loading from the repository.

## Installation

### npx installer (recommended)

The installer materializes a self-contained plugin directory and wires the
`dh` MCP server for the selected scope:

```sh
# npm registry (after publication)
npx -y dev-harness-skills install --global
npx -y dev-harness-skills install --project --path .

# Git channel (available before publication / private use)
npx -y github:andrescevp/development-harness install --global
npx -y github:andrescevp/development-harness install --project --path .
```

| Scope | Plugin directory | MCP config |
|---|---|---|
| `--global` | `${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/opencode}/plugins/dev-harness-skills` | global `opencode.jsonc` |
| `--project` | `<project>/.opencode/plugins/dev-harness-skills` | `<project>/opencode.jsonc` |

- Re-running is idempotent; a newer CLI upgrades the managed copy.
- `--dry-run` reports intended changes; `--force` replaces an unmanaged target
  or a conflicting `dh` entry; `--no-mcp` skips config wiring.
- `status` reports plugin/config drift (`--json` for scripts);
  `uninstall` removes only installer-owned artifacts.
- A TTY prompts for global/project when no scope flag is given. Non-interactive
  runs must pass `--global` or `--project`; `--yes` never guesses a scope.
- **Restart OpenCode after installing** — plugins load at server startup.

```sh
npx -y dev-harness-skills status --global --json
npx -y dev-harness-skills uninstall --project --dry-run
```

### Managed via OpenCode CLI

`opencode plugin add` installs the plugin into OpenCode's **global**
configuration and does not wire MCP servers:

```sh
# npm registry (after publication)
opencode plugin add dev-harness-skills

# Git repository (available now; works with private repositories)
opencode plugin add github:andrescevp/development-harness
```

Then wire only the `dh` MCP entry (no second plugin copy):

```sh
npx -y dev-harness-skills install --global --mcp-only
# Git-wired installs:
npx -y dev-harness-skills install --global --mcp-only --mcp-source github
```

Choose one plugin channel: an `opencode plugin add` entry plus a managed copy
loads the plugin twice, and the CLI warns about it. To refresh a managed
plugin, `opencode plugin update`; remove it with `opencode plugin remove`.

### From source / development

Clone the repository, install dependencies, build the bundle (tsup bundle + dist/assets), and configure OpenCode:

```sh
git clone https://github.com/andrescevp/development-harness.git
cd development-harness
pnpm install
pnpm build
```

Then load via `file:///path/to/development-harness` in your `opencode.json` or
`opencode.jsonc` plugins array (or clone the repo into a `plugins/` folder):

```json
{
  "plugins": [
    "file:///path/to/development-harness"
  ]
}
```

The plugin installation above loads agents and skills only; the harness tools
require the project-scope `mcp.servers.dh` entry described in
[MCP server (`dh`)](#mcp-server-dh). For a git-only checkout, run
`npx -y github:andrescevp/development-harness install --project --mcp-only`.

## Quickstart

1. Check that the plugin loaded successfully:

```sh
opencode debug agents   # 7 dh-* agents (when the build surfaces plugin agents)
opencode debug config   # plugin entry, and mcp.servers.dh once wired
opencode mcp list       # expect: dh connected (server/status only)
```

The plugin also registers 17 skills (there is no skills debug subcommand on
v2.0.18 — see `skills/index.md`) and zero tools; the harness tools come from
the project-scope MCP server — see [MCP server (`dh`)](#mcp-server-dh).

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

### MCP server (`dh`)

The plugin registers **no tools**. The 7 harness tools are served by a local
stdio MCP server (`@modelcontextprotocol/server` v2), enabled **per project**
in that project's `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "servers": {
      "dh": {
        "type": "local",
        // npm channel (after publication); use
        // --package=github:andrescevp/development-harness for a Git-wired install.
        "command": ["npx", "-y", "--package=dev-harness-skills", "dev-harness-mcp"],
        "protocol": "2026-07-28",
        // Cold first npx install can take ~20–25 s; prewarm makes later starts fast.
        "timeout": { "startup": 300000 }
      }
    }
  }
}
```

| Tool | Purpose |
|---|---|
| `dh_plan_read` | Parse a phased plan (`docs/plans/<slug>/plan.md`) into structured JSON |
| `dh_plan_update_status` | Edit phase/sub-task status markers (phase completion is gated) |
| `dh_plan_create` | Scaffold a phased plan; optionally append the `index.md` row |
| `dh_read_sheet` | Query tabular data with DuckDB — csv by default; xlsx via a `read_xlsx(...)` query when the extension loads |
| `dh_update_sheet` | Apply UPDATE/INSERT/DELETE and write the CSV back |
| `dh_sheet_schema` | Describe columns as `name:type` |
| `dh_logged_command` | Run a command with its log in the OS temp dir (runs with the MCP server's OS permissions); return head/tail + log path |

Full inputs/returns contract: [`docs/LOADING.md` → Tools](docs/LOADING.md#tools).

Server key `dh` + tool `plan_read` → **`dh_plan_read`** (MCP host naming
`<server>_<tool>`); under Code Mode call `tools.dh.<tool>`. The older
`dh.<tool>` spelling belonged to the plugin's V2 tool namespace and is
retired. Consumer permission actions match `dh_*`. Full wiring, verification
(`opencode mcp list`), prewarm, and troubleshooting:
[`docs/LOADING.md`](docs/LOADING.md#mcp-server-dh).

## Agents & skills

The plugin defines 7 agents and 17 skills using the `@opencode/plugin` SDK. Zero tool or command transforms are registered.

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
| `dh-semver` | Analyzes commits since the last tag, determines the version bump, generates a changelog, and creates a local tag — harness adaptation of the global `semver` skill. |

## Development

Run development, test, and verification workflows with `pnpm`:

```sh
pnpm install
pnpm test
pnpm run audit
pnpm typecheck
pnpm build
node scripts/smoke-load.mjs
node scripts/smoke-mcp.mjs
node scripts/smoke-install.mjs
node scripts/smoke-pack.mjs
pnpm qa:check
pnpm qa:check:full
pnpm format:biome
```

Use `pnpm run audit` to run the harness consistency audit (`pnpm audit` runs pnpm's package security audit).

Docker test (opt-in; needs Docker and GitHub credentials for `--remote`):

```sh
scripts/docker-test.sh --local
scripts/docker-test.sh --remote --ref <branch>
```

The runner derives from the pinned `ghcr.io/anomalyco/opencode:2.0.18` image,
adds Node/npm/git/ssh/gcompat, mounts existing host Git credentials read-only,
and keeps HOME/XDG/OpenCode/project paths isolated. It is not part of the
offline `pnpm qa:check:full` gate.

## Repository layout

```text
index.ts         Root plugin entry point for OpenCode plugin discovery (source mode)
agents/          Markdown definitions and system prompts for the 7 bundled agents
skills/          Instructions, templates, and references for the 17 bundled skills
src/cli/         Installer CLI (args, scope, JSONC config, manifest, commands)
src/mcp/         Local stdio MCP server and workspace resolver
src/tools/       Plan/sheet/logged-command tool implementations
src/lib/         Shared assets, records, atomic writes, package metadata, main guard
scripts/         Audit, smoke tests (load/MCP/install/pack), Docker runner
docker/test/     Derived OpenCode test image (pinned 2.0.18)
test/            Vitest unit and registration tests
docs/            Plugin documentation, loading guides, release runbook, plans
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — Runtime contract: skills loop, phase lifecycle, tools, and delegation routing.
- [`docs/LOADING.md`](docs/LOADING.md) — Install channels, verification checklists, and troubleshooting.
- [`docs/RELEASING.md`](docs/RELEASING.md) — Manual npm publish runbook and post-publish verification.

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
