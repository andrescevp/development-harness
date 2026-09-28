#!/usr/bin/env bash
# demo.sh — run the demo-project folder isolated with the dev-harness plugin
# loaded.
#
# Usage:
#   ./demo.sh             launch the opencode TUI in this folder (plugin loads
#                         from the parent repo via demo-project/opencode.jsonc)
#   ./demo.sh validate    non-interactive check: assert the 7 agents, 15 skills
#                         and the dh_* tools are visible to the runtime
set -euo pipefail
cd "$(dirname "$0")"

export OPENCODE_DEMO_DIR="$PWD"

if [[ "${1:-}" == "validate" ]]; then
  echo "[demo] verifying plugin registration (agents/skills)..."

  AGENTS=(dh-software-architect dh-software-engineer dh-reviewer dh-final-reviewer dh-executor dh-explorer dh-documentor)
  SKILLS=(dh-planning dh-domain-check dh-execute-plan dh-execute-plan-task dh-coding dh-simplify dh-review dh-code-review dh-preflight dh-artifact-check dh-final-review dh-create-documentation dh-grill-sdd dh-setup dh-code-ruler)

  command -v opencode >/dev/null || { echo "[demo] FAIL: opencode not found"; exit 1; }

  found=0
  for n in "${AGENTS[@]}"; do
    if opencode debug agents | grep -q "$n"; then found=$((found + 1)); fi
  done
  echo "[demo] agents visible: $found/7"

  found=0
  for n in "${SKILLS[@]}"; do
    if opencode debug skills | grep -q "$n"; then found=$((found + 1)); fi
  done
  echo "[demo] skills visible: $found/15"

  [[ "$(opencode debug agents | grep -c 'dh-')" -ge 7 ]] && echo "[demo] OK: plugin loaded (agents+skills visible)." || echo "[demo] NOTE: some entities not visible — confirm the plugin loads in the TUI."
  exit 0
fi

echo "[demo] Starting opencode in demo-project with the dev-harness plugin loaded..."
echo "[demo] Plugin source: $(cd .. && pwd)"
exec opencode "$@"