#!/usr/bin/env bash
# demo.sh — run the demo-project folder isolated with the dev-harness plugin
# loaded, or validate the setup.
#
# Usage:
#   ./demo.sh             launch the opencode TUI in this folder (the plugin
#                         loads from the parent repo via opencode.jsonc on
#                         hosts that support directory plugins; the 7 dh-*
#                         agents are also registered natively via the config
#                         agent map, so they are visible on every host)
#   ./demo.sh validate    verify: opencode version + config resolution + agent
#                         visibility + project-scope MCP connectivity + the
#                         in-process registration gate (harness suite)
set -euo pipefail
cd "$(dirname "$0")"

# Temp base for per-run server data dirs and logs (created once; a missing
# base would otherwise make mktemp fall back unpredictably).
TMP_ROOT="${TMPDIR:-/tmp}/opencode"
mkdir -p "$TMP_ROOT"

# Fresh opencode server per invocation (the long-lived shared server caches
# agent registrations; a fresh data dir forces a clean read of the config).
fresh() {
  XDG_DATA_HOME="$(mktemp -d "$TMP_ROOT/demo-XXXXXX")" opencode "$@"
}

# Same as fresh(), with a wall-clock bound (MCP startup may be slow on first
# run). macOS has no GNU timeout: fall back to gtimeout, else run unbounded.
fresh_limited() {
  local data_dir
  data_dir="$(mktemp -d "$TMP_ROOT/demo-XXXXXX")"
  if command -v timeout >/dev/null 2>&1; then
    XDG_DATA_HOME="$data_dir" timeout -k 10 120 opencode "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    XDG_DATA_HOME="$data_dir" gtimeout -k 10 120 opencode "$@"
  else
    echo "[demo] WARN: no timeout/gtimeout — running opencode unbounded" >&2
    XDG_DATA_HOME="$data_dir" opencode "$@"
  fi
}

AGENTS=(dh-software-architect dh-software-engineer dh-reviewer dh-final-reviewer dh-executor dh-explorer dh-documentor)

if [[ "${1:-}" == "validate" ]]; then
  command -v opencode >/dev/null || { echo "[demo] FAIL: opencode not found"; exit 1; }

  echo "[demo] 1/5 opencode version: $(opencode --version 2>/dev/null | head -1)"

  echo "[demo] 2/5 demo config resolved (plugins + agent map):"
  if fresh debug config 2>&1 | grep -q 'demo-project/opencode.jsonc'; then
    echo "      OK — demo-project/opencode.jsonc is part of the resolved config."
  else
    echo "      WARN — demo config not found in resolved documents."
  fi

  echo "[demo] 3/5 agent visibility (fresh server):"
  found=0
  for n in "${AGENTS[@]}"; do
    if fresh debug agents 2>/dev/null | grep -q "$n"; then found=$((found + 1)); fi
  done
  echo "      agents visible: $found/${#AGENTS[@]}"

  echo "[demo] 4/5 MCP server connectivity (project-scope, fresh data dir):"
  if [[ ! -f ../dist/mcp/stdio.js ]]; then
    echo "      MCP GATE: FAILED — missing ../dist/mcp/stdio.js (run \`pnpm build\` in the repo)"
    exit 1
  fi
  if ! fresh debug config 2>/dev/null | grep -q '\.\./dist/mcp/stdio\.js'; then
    echo "      MCP GATE: FAILED — this demo's opencode.jsonc is not providing mcp.servers.dh (../dist/mcp/stdio.js)"
    exit 1
  fi
  mcp_log="$TMP_ROOT/demo-mcp-list.$$.log"
  mcp_rc=0
  fresh_limited mcp list >"$mcp_log" 2>&1 || mcp_rc=$?
  mcp_line=$(grep -Ei '(^|[[:space:]])dh[[:space:]]+connected([[:space:]]|$)' "$mcp_log" | head -1 || true)
  if [[ $mcp_rc -eq 0 && -n "$mcp_line" ]]; then
    echo "      MCP GATE: ${mcp_line}"
  else
    echo "      MCP GATE: FAILED — 'dh' not connected (opencode mcp list exit $mcp_rc) — output tail:"
    tail -20 "$mcp_log" 2>/dev/null | sed 's/^/        /' || true
    echo "        hint: first run may be slow; check \`node ../dist/mcp/stdio.js < /dev/null\` exits 0 and the config's command path."
    exit 1
  fi

  echo "[demo] 5/5 in-process registration gate (harness test suite):"
  test_log="$TMP_ROOT/demo-validate-tests.$$.log"
  if (cd .. && NO_COLOR=1 pnpm test >"$test_log" 2>&1); then
    echo "      IN-PROCESS GATE: $(grep -E 'Tests +[0-9]+' "$test_log" | tail -1) — registration OK"
  else
    echo "      IN-PROCESS GATE: FAILED (see $test_log)"
    exit 1
  fi
  echo "[demo] validation complete."
  exit 0
fi

echo "[demo] Starting opencode in demo-project with the dev-harness plugin loaded..."
echo "[demo] Plugin source: $(cd .. && pwd) (directory form + native agent map)"
exec opencode "$@"