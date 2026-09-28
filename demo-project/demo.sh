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
#   ./demo.sh validate    verify: config resolution + agent visibility +
#                         the in-process registration gate (harness suite)
set -euo pipefail
cd "$(dirname "$0")"

# Fresh opencode server per invocation (the long-lived shared server caches
# agent registrations; a fresh data dir forces a clean read of the config).
fresh() {
  XDG_DATA_HOME="$(mktemp -d /tmp/opencode/demo-XXXXXX)" opencode "$@"
}

AGENTS=(dh-software-architect dh-software-engineer dh-reviewer dh-final-reviewer dh-executor dh-explorer dh-documentor)

if [[ "${1:-}" == "validate" ]]; then
  command -v opencode >/dev/null || { echo "[demo] FAIL: opencode not found"; exit 1; }

  echo "[demo] 1/4 opencode version: $(opencode --version 2>/dev/null | head -1)"

  echo "[demo] 2/4 demo config resolved (plugins + agent map):"
  if fresh debug config 2>&1 | grep -q 'demo-project/opencode.jsonc'; then
    echo "      OK — demo-project/opencode.jsonc is part of the resolved config."
  else
    echo "      WARN — demo config not found in resolved documents."
  fi

  echo "[demo] 3/4 agent visibility (fresh server):"
  found=0
  for n in "${AGENTS[@]}"; do
    if fresh debug agents 2>/dev/null | grep -q "$n"; then found=$((found + 1)); fi
  done
  echo "      agents visible: $found/${#AGENTS[@]}"

  echo "[demo] 4/4 in-process registration gate (harness test suite):"
  if (cd .. && pnpm test >/tmp/opencode/demo-validate-tests.log 2>&1); then
    echo "      IN-PROCESS GATE: $(grep -E 'Tests +[0-9]+' /tmp/opencode/demo-validate-tests.log | tail -1) — registration OK"
  else
    echo "      IN-PROCESS GATE: FAILED (see /tmp/opencode/demo-validate-tests.log)"
    exit 1
  fi
  echo "[demo] validation complete."
  exit 0
fi

echo "[demo] Starting opencode in demo-project with the dev-harness plugin loaded..."
echo "[demo] Plugin source: $(cd .. && pwd) (directory form + native agent map)"
exec opencode "$@"