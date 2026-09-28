#!/usr/bin/env bash
# demo.sh — run the demo-project folder isolated with the dev-harness plugin
# loaded, or validate the setup.
#
# Usage:
#   ./demo.sh             launch the opencode TUI in this folder (the plugin
#                         loads from the parent repo via opencode.jsonc on
#                         hosts that support directory plugins)
#   ./demo.sh validate    verify: config resolution + plugin load status +
#                         the in-process registration gate (harness test suite)
set -euo pipefail
cd "$(dirname "$0")"

AGENTS=(dh-software-architect dh-software-engineer dh-reviewer dh-final-reviewer dh-executor dh-explorer dh-documentor)

if [[ "${1:-}" == "validate" ]]; then
  command -v opencode >/dev/null || { echo "[demo] FAIL: opencode not found"; exit 1; }

  echo "[demo] 1/3 opencode version: $(opencode --version 2>/dev/null | head -1)"

  echo "[demo] 2/3 demo config resolved (plugins entry):"
  if opencode debug config 2>&1 | grep -q '"plugins"'; then
    echo "      OK — demo-project/opencode.jsonc is read and carries a plugins entry."
  else
    echo "      WARN — plugins entry not found in resolved config."
  fi

  echo "[demo] 3/3 plugin load + registration:"
  found=0
  for n in "${AGENTS[@]}"; do
    if opencode debug agents 2>/dev/null | grep -q "$n"; then found=$((found + 1)); fi
  done
  echo "      agents visible in host: $found/${#AGENTS[@]}"
  echo "      NOTE: opencode v2.0.18 does not load directory/local plugins"
  echo "      (documented limitation). The authoritative in-process gate is the"
  echo "      harness test suite, run next:"
  if (cd .. && pnpm test >/tmp/opencode/demo-validate-tests.log 2>&1); then
    tail -1 /tmp/opencode/demo-validate-tests.log | grep -q "passed" \
      && echo "      IN-PROCESS GATE: $(grep -E 'Tests +[0-9]+' /tmp/opencode/demo-validate-tests.log | tail -1) — registration OK" \
      || echo "      IN-PROCESS GATE: suite passed"
  else
    echo "      IN-PROCESS GATE: FAILED (see /tmp/opencode/demo-validate-tests.log)"
    exit 1
  fi
  echo "[demo] validation complete."
  exit 0
fi

echo "[demo] Starting opencode in demo-project with the dev-harness plugin loaded..."
echo "[demo] Plugin source: $(cd .. && pwd) (directory form; supported from opencode v2 hosts that load local plugins)"
exec opencode "$@"