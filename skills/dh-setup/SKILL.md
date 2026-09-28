---
name: dh-setup
description: >
  Verify and prepare everything the dev-harness needs to run properly: audit
  system software (chrome, uv, nvm, osv-scanner, docker, jq, xq, yq, graphify,
  optional phpenv) and guide installation for anything missing; list and
  configure user-level integrations — MCP servers (chrome-devtools-mcp,
  playwright MCP, android-remote-control-mcp), the opencode-rules plugin
  (>= v2), and the graphify external tool — as config choices left to the
  user; and scaffold project-level quality gates: pre-commit/husky or
  equivalent hooks with clear rules, plus the QA toolset for the project's
  stack (All: osv-scanner; Python: ruff/mypy/pyupgrade/bandit/copydetect;
  JS/TS: biome/tsc/jscpd/knip/semgrep/dependency-cruiser; PHP:
  phpstan/deptrac/rector/phpcs/phpcpd; other stacks: research equivalents).
  Use when asked to "check system requirements", "install the harness
  prerequisites", "setup the environment", "configure mcp/plugins", "add
  pre-commit/husky", or before first use of the harness on a new machine.
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
| graphify | yes | `graphify --version` | https://github.com/Graphify-Labs/graphify — follow repo install (CLI/npm/deno) |
| phpenv | optional | `phpenv --version` / `phpenv versions` | https://github.com/phpenv/phpenv — skip with a note when absent |

For anything missing, do NOT silently skip (except `phpenv`): install it or
report the blocker with the exact command the user must run.

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
- android-remote-control-mcp — https://github.com/danielealbano/android-remote-control-mcp
  (follow that repository's install instructions)

**OpenCode plugin:** `opencode-rules` **>= v2** — https://github.com/frap129/opencode-rules
- Add to `opencode.jsonc` `"plugins"`: `"opencode-rules@latest"` (verify the
  installed version is v2+; `opencode plugin list` shows the loaded version).

**External tool:** graphify — https://github.com/Graphify-Labs/graphify
- Installed at Step 1; add any project key/alias configuration per the repo docs.

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

## Verification Checklist

- [ ] Step 1: every required system tool present with version (phpenv optional)
- [ ] Step 2: user-level MCPs/plugins verified and enabled per user decision
- [ ] Step 3: hooks installed with documented rules; QA toolset wired and gate green
- [ ] Report produced: per-tool status table + any blockers with exact commands