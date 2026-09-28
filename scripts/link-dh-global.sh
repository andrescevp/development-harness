#!/usr/bin/env bash
# link-dh-global.sh — expose the dh-prefixed agents + skills to opencode on
# hosts that do NOT load local directory plugins (v2.0.18 limitation):
# symlinks the repo's agents/*.md and skills/*/SKILL.md into
# ~/.config/opencode/{agents,skills}, where opencode natively discovers
# agents and skills. Idempotent; run again to refresh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"

mkdir -p "$CONF/agents" "$CONF/skills"

count_agents=0
for f in "$ROOT"/agents/*.md; do
  ln -snf "$f" "$CONF/agents/$(basename "$f")"
  count_agents=$((count_agents + 1))
done

count_skills=0
for d in "$ROOT"/skills/*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  mkdir -p "$CONF/skills/$name"
  ln -snf "$ROOT/skills/$name/SKILL.md" "$CONF/skills/$name/SKILL.md"
  count_skills=$((count_skills + 1))
done

echo "linked $count_agents agents + $count_skills skills into $CONF/{agents,skills}"
echo "verify: opencode debug agents | grep dh- ; opencode debug skills | grep dh-"