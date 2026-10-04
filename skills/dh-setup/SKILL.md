---
name: dh-setup
description: >
  Audit system software, configure user MCPs/plugins, scaffold project QA (hooks + per-stack tools), bootstrap docs/architecture via dh-software-architect, and write harness directives into AGENTS.md. Use to check requirements or setup the environment.
license: MIT
compatibility: opencode
allowed-tools: read, write, edit, bash, websearch
metadata:
  audience: developers
  workflow: setup
---

# Harness Setup

Make sure the system, the user configuration, and the project are ready to run the dev harness. Work through the three layers in order; report findings per item (installed / missing / outdated) with the exact version detected.

## Step 1: System Software Audit

Check each required tool and guide installation when missing. Run the
verification command via `@dh-executor`; if a tool is missing, provide the
install command for the detected OS (linux/macOS; note Windows equivalents
where they differ) and re-verify.

| Tool | Required | Verify with | Install guidance (Linux/macOS) |
|------|----------|-------------|--------------------------------|
| Chrome | yes | `google-chrome --version` / `chromium --version` / open Chrome | distro package or https://www.google.com/chrome |
| uv | yes | `uv --version` | `curl -LsSf https://astral.sh/uv/install.sh | sh` (or `pipx install uv`) |
| nvm | yes | `command -v nvm` (shell function — source `~/.nvm/nvm.sh` first) | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash` |
| osv-scanner | yes | `osv-scanner --version` | `go install github.com/google/osv-scanner/cmd/osv-scanner@latest` or `brew install osv-scanner` |
| docker | yes | `docker --version` | distro package; enable the daemon (`systemctl enable --now docker` or Docker Desktop) |
| jq | yes | `jq --version` | https://jqlang.org/ — distro package or `brew install jq` |
| xq | yes | `xq --version` | https://github.com/sibprogrammer/xq — `go install github.com/sibprogrammer/xq/cmd/xq@latest` or `brew install sibprogrammer/xq` |
| yq | yes | `yq --version` | https://github.com/mikefarah/yq — `brew install yq` or download binary |
| graphify | yes | `graphify --version` | https://github.com/Graphify-Labs/graphify (v8 README) — `uv tool install graphifyy` (or `pipx install graphifyy`), then register the skill with `graphify install` |
| obsidian | optional | `command -v obsidian` (app + best-effort CLI) | https://obsidian.md — recommended when the project vault flow (dh-create-documentation) should sync live |
| notesmd-cli | optional | `notesmd --version` / `command -v notesmd` | https://github.com/Yakitrak/notesmd-cli — `yay -S notesmd-cli-bin` (Arch) / `brew install yakitrak/yakitrak/notesmd-cli` / release binary; used by dh-create-documentation for vault operations without Obsidian running |
| duckdb (CLI, optional) | optional | `duckdb --version` | https://duckdb.org — native CLI alternative to the plugin's bundled sheet tools (dh_read_sheet/dh_update_sheet use the duckdb npm package) |
| phpenv | optional | `phpenv --version` / `phpenv versions` | https://github.com/phpenv/phpenv — skip with a note when absent |

For anything missing, do NOT silently skip (except the optional items —
`phpenv`, `obsidian`, `notesmd-cli`): install it or report the blocker with
the exact command the user must run. `notesmd-cli` / `obsidian` support the
Obsidian vault workflow used by `dh-create-documentation` (vault = project
root, docs under `{project_root}/docs`) and the doc-search convention
(AGENTS.md → Generated documentation search).

**Vault check (project root):** a project root is an Obsidian vault when it
contains the `.obsidian/` folder. In Step 3, check for it; when absent,
INITIALIZE the vault at the project root:

```bash
# Initialize the vault (Obsidian marks a folder as a vault via .obsidian/)
mkdir -p .obsidian
printf '{}\n' > .obsidian/app.json
# Optional: full workspace file on first open; Obsidian CLI can open it:
obsidian open path="$PWD" 2>/dev/null || true
# Verify: notesmd-cli sees the vault without Obsidian running
notesmd-cli search-content "health" --vault "$(basename "$PWD")" 2>&1 | head -3 || true
```

Only initialize with the user's consent (adding `.obsidian/` to a repo
affects the project); add `.obsidian/` to `.gitignore` when it should stay
local.

## Step 2: User-Level Integrations (config choices — up to the user)

These are system/user-level integrations; verify they are present and offer
the configuration, but let the user decide whether to enable each.

**MCP servers** (add to `opencode.jsonc` `mcp` section; local servers run via
`npx`):

- chrome-devtools-mcp — https://github.com/ChromeDevTools/chrome-devtools-mcp
  ```jsonc
  "chrome-devtools": { "type": "local", "enabled": true, "command": ["npx", "-y", "chrome-devtools-mcp@latest"] }
  ```
- Playwright MCP — https://playwright.dev/docs/getting-started-mcp
  ```jsonc
  "playwright": { "type": "local", "enabled": true, "command": ["npx", "-y", "@playwright/mcp@latest"] }
  ```
- mobile-mcp — https://github.com/mobile-next/mobile-mcp
  ```jsonc
  "mobile-mcp": { "type": "local", "enabled": true, "command": ["npx", "-y", "mobile-mcp@latest"] }
  ```

**OpenCode plugin:** `opencode-rules` **latest v2 tag, beta versions for opencode v2** — https://github.com/frap129/opencode-rules
```jsonc
  "plugin": ["opencode-rules@v2.0.0-beta.3"]
```

**External tool:** graphify — https://github.com/Graphify-Labs/graphify (v8)
- Install (Step 1): `uv tool install graphifyy` (or `pipx install graphifyy`).
- Register the skill for the assistant: `graphify install`.
- For an OpenCode project setup (as used in other projects):
  ```bash
  uv tool install graphifyy
  graphify install
  graphify install --project --platform opencode
  ```
- After setup, run opencode with `@graphify` as the message to initialize
  the code database (maps the project into a knowledge graph under
  `graphify-out/`: `graph.html`, `GRAPH_REPORT.md`, `graph.json`).

Verify with: `opencode plugin list` (plugins), `opencode debug config` (mcp
entries resolved). Report as "available — user decision" for each.

## Step 3: Project-Level Quality Gates

For the target project (current workdir or the given project):

**1. Pre-commit / husky or equivalent, with clear rules:**
- Install the project-appropriate hook runner: `husky` + `lint-staged` for
  JS/TS/pnpm projects; `pre-commit` (https://pre-commit.com) for Python and
  general repos; or a plain `.git/hooks/pre-commit` script when no native
  runner fits.
- Encode CLEAR rules in the hook: run formatting check, lint, and the fast
  test suite on staged changes; block the commit on any failure; allow a
  documented escape hatch (e.g. `--no-verify` with reason required) and
  document the rules in the hook file header + project README/AGENTS.md.
- Do not add hooks silently: hook policy belongs to the project — propose the
  rules, then create the hook on confirmation.

**2. QA toolset for the project's stack** (install + wire into a `qa:check`
script + CI where a workflow exists):

| Stack (marker) | Tools |
|----------------|-------|
| All | `osv-scanner` |
| Python (`pyproject.toml`, `requirements*.txt`) | `ruff`, `mypy`, `pyupgrade`, `bandit`, `copydetect` |
| JS/TS (`package.json`) | `biome`, `tsc`, `jscpd`, `knip`, `semgrep`, `dependency-cruiser` |
| PHP (`composer.json`) | `phpstan`, `deptrac`, `rector`, `phpcs`, `phpcpd` |
| Other language | Search (websearch) for the stack's equivalent tools — linter, formatter, type checker, test runner, dependency scanner, duplicate-code detector, unused-code detector — and use the same matrix shape |

**3. Verify setup:** run the project's `qa:check` (or the equivalent gate)
and confirm it exits 0; if pre-existing violations block the gate, report
them instead of silently disabling rules.

## Step 4: Architecture Documentation

Make sure the project has a **central architecture documentation directory**
and that existing architecture artifacts are accounted for.

**1. Explore first (via `@dh-executor`):** look for architecture files with
these probes and report what exists:

```bash
# candidate locations — report matches, do not modify anything yet
ls -d docs/architecture docs/adr docs/design docs/specs 2>/dev/null
ls docs/ARCHITECTURE.md docs/architecture.md ARCHITECTURE.md architecture.md 2>/dev/null
find . -maxdepth 3 -type f -name '*.md' \( -path '*/adr/*' -o -path '*/architecture/*' -o -path '*/design/*' \) -not -path './node_modules/*' 2>/dev/null
git ls-files | grep -iE 'architect|adr|design' | head -20   # tracked ones
```

**2. Decision interview — only when architecture files EXIST.** Ask the user
about each artifact (keep answers recorded in the report):

- **Up to date?** — are these documents still accurate (yes / no / partial)?
- **Movable?** — may they be **moved** into `docs/architecture/` to
  consolidate, or must they stay where they are (e.g., linked from a
  README/CI)?
- **Updatable?** — do they need **updating/rewriting** (delegate the refresh
  to `@dh-software-architect`) or archiving (old/obsolete)?
- **Tracked?** — are they **tracked in git**; if untracked, should they be
  committed, and is `docs/architecture/` itself tracked (else propose adding
  a `.gitkeep` + `.gitignore` line)? Should they be linked from the repo
  README?

Never move, update, archive, or commit anything without explicit
confirmation — this interview decides each item; the default is
**keep in place, keep as-is** until the user says otherwise.

**3. Create the architecture directory when absent** (with consent — it adds
a dir to the project): `mkdir -p {project_root}/docs/architecture`, and if
the repo would leave it empty/untracked, add `.gitkeep` (or an `index.md`
placeholder) and note the `.gitignore` choice.

**4. Create the architecture documentation when it does NOT exist:**
delegate to `@dh-software-architect` (architecture author) with a brief that
requires: a system/module overview, bounded contexts or module boundaries,
key decisions (ADR-style entries), and data/control flow — all under
`{project_root}/docs/architecture`, following the `dh-create-documentation`
conventions (vault = project root, docs under `{project_root}/docs`). Then
ensure an **index** (`README.md` in the architecture dir) links every
architecture document; the index and other generated docs are owned by
`@dh-documentor`.

## Step 5: Harness Directives in AGENTS.md

Ensure the **project root AGENTS.md** carries a section with the directives
to use this harness — so any agent working in the project knows the loop,
delegation, and plan tools. Idempotent: if a `## Dev Harness` section already
exists, review and update it instead of duplicating.

**If AGENTS.md is absent:** create it with the section below.

**Append/replace the section** (validate with the user; keep existing
AGENTS.md content untouched):

```markdown
## Dev Harness

This project is managed with the dev-harness plugin (dev-harness-skills):

- **Plans:** phased plans live in `docs/plans/<slug>/plan.md` (phases →
  sub-tasks with `Pending | In Progress | Completed` markers); the format
  contract is the phased-plan template. Use `dh_plan_read` /
  `dh_plan_update_status` / `dh_plan_create` instead of manual edits when
  available.
- **Loop:** plan with `dh-planning` (SDD first via `dh-grill-sdd` when
  absent), execute with `dh-execute-plan` → `dh-execute-plan-task`
  (delegating implementation to `@dh-software-engineer`), simplify with
  `dh-simplify`, review with `dh-review` + `dh-code-review`, gate with
  `dh-preflight` + `dh-artifact-check`, sign off with `dh-final-review`,
  document with `dh-create-documentation`.
- **Delegation:** implementation → `@dh-software-engineer`; architecture →
  `@dh-software-architect`; execution/validation → `@dh-executor`; review →
  `@dh-reviewer` / `@dh-final-reviewer`; exploration → `@dh-explorer`;
  generated docs (outside docs/plans) → `@dh-documentor`.
- **Blockers halt automation:** 3 consecutive validation failures or
  unresolved P0/P1 review findings stop the loop — report and ask for
  guidance; never mark a phase Completed around a blocker.
- **Architecture docs:** maintained under `docs/architecture/` (see the
  index there); refresh via `@dh-software-architect`.
```

## Verification Checklist

- [ ] Step 1: every required system tool present with version (phpenv optional)
- [ ] Step 2: user-level MCPs/plugins verified and enabled per user decision
- [ ] Step 3: hooks installed with documented rules; QA toolset wired and gate green
- [ ] Step 4: architecture artifacts explored + interview answers recorded (if files exist); `docs/architecture/` created; docs created via `@dh-software-architect` when absent; index present
- [ ] Step 5: project AGENTS.md has the harness directives section (updated, not duplicated)
- [ ] Report produced: per-tool status table + any blockers with exact commands

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
