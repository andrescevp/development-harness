#!/usr/bin/env bash
# docker-test.sh — npx installer smoke in a disposable, non-root container
# derived from the pinned official OpenCode image.
# Credentials are mounted read-only only when present; they are never copied
# into the image, printed, or written back. Temp config/project paths live
# under a host temp root removed on exit unless --keep. No env dumps.
set -euo pipefail
set +x

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd -P)
IMAGE=dev-harness-test:local
MODE=local
REF=develop
REF_GIVEN=0
KEEP=0
BUILD_IMAGE=1
NPM_CACHE_VOLUME=dev-harness-npm-cache

usage() {
  cat <<'EOF'
Run the npx installer smoke test in the derived OpenCode Docker image.

Usage: scripts/docker-test.sh [--local | --remote] [options]

Modes:
  --local            Pack this working tree and install the tarball (default).
                     Needs a host pnpm/npm toolchain; no GitHub credentials.
  --remote           Run `npx -y github:andrescevp/development-harness#<ref>`
                     in the container. Needs network access and GitHub creds.

Options:
  --ref <branch>     Git ref for --remote (default: develop).
  --keep             Keep the host temp root with logs and the project tree.
  --no-build         Use an existing image instead of rebuilding it.
  --image <tag>      Image tag to build/run (default: dev-harness-test:local).
  -h, --help         Show this help.

Notes:
  --remote requires ~/.ssh, ~/.git-credentials, or ~/.config/gh/hosts.yml.
  Existing credential paths are mounted read-only; ~/.gitconfig and ~/.ssh
  never enter the image. The raw official image has no Node/MCP toolchain, so
  `opencode debug agents` may be unavailable; that check is recorded/skipped.

Examples:
  scripts/docker-test.sh --local
  scripts/docker-test.sh --local --keep
  scripts/docker-test.sh --remote --ref develop
  scripts/docker-test.sh --remote --ref feature/my-branch --no-build
EOF
}

info() { printf '[docker-test] %s\n' "$*"; }
fail() { printf '[docker-test] error: %s\n' "$*" >&2; exit 1; }
usage_error() { printf '[docker-test] error: %s\n' "$*" >&2; usage >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) MODE=local ;;
    --remote) MODE=remote ;;
    --ref)
      [[ $# -ge 2 && -n "$2" ]] || usage_error 'option --ref requires a value'
      REF=$2
      REF_GIVEN=1
      shift
      ;;
    --keep) KEEP=1 ;;
    --no-build) BUILD_IMAGE=0 ;;
    --image)
      [[ $# -ge 2 && -n "$2" ]] || usage_error 'option --image requires a value'
      IMAGE=$2
      shift
      ;;
    -h|--help) usage; exit 0 ;;
    *) usage_error "unknown option: $1" ;;
  esac
  shift
done

[[ $REF_GIVEN -eq 1 && $MODE != remote ]] && usage_error '--ref is only valid with --remote'
[[ "$REF" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || usage_error "invalid --ref: $REF"
[[ "$REF" != *..* ]] || usage_error "invalid --ref: $REF"
command -v docker >/dev/null 2>&1 || fail 'docker is required'
[[ "$IMAGE" != -* ]] || usage_error "invalid --image: $IMAGE"
[[ -n "${HOME:-}" ]] || fail 'HOME is not set'
if [[ "$MODE" == local ]]; then
  command -v pnpm >/dev/null 2>&1 || fail 'pnpm is required for --local (host build)'
  command -v npm >/dev/null 2>&1 || fail 'npm is required for --local (npm pack)'
fi

declare -a MOUNT_ARGS=()
declare -a ENV_ARGS=()
declare -a CREDENTIAL_PATHS=()
# Mount an existing host path read-only. Missing paths are skipped so Docker
# never creates root-owned host files/directories in the user's home.
mount_credential() {
  local src=$1 dst=$2
  if [[ ! -e "$src" ]]; then
    info "skip mount: $src (not present)"
    return 0
  fi
  [[ "$src" == /* ]] || fail "mount source must be absolute: $src"
  [[ "$src" != *","* ]] || fail "mount source contains a comma (--mount cannot express it): $src"
  MOUNT_ARGS+=(--mount "type=bind,src=$src,dst=$dst,readonly")
  CREDENTIAL_PATHS+=("$src")
  info "mount: $src -> $dst (read-only)"
}

# sha256 of every readable mounted credential file, without printing any
# contents. Unreadable files are skipped (the binds are read-only anyway).
snapshot_credentials() {
  local path
  for path in "${CREDENTIAL_PATHS[@]}"; do
    if [[ -d "$path" ]]; then
      (cd -- "$path" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum 2>/dev/null || true)
    elif [[ -f "$path" ]]; then
      sha256sum -- "$path" 2>/dev/null || true
    fi
  done | sha256sum | awk '{print $1}'
}

has_github_credentials() {
  if [[ -d "$HOME/.ssh" ]] && find "$HOME/.ssh" -maxdepth 1 -type f -print -quit | grep -q .; then
    return 0
  fi
  [[ -f "$HOME/.git-credentials" ]] && return 0
  [[ -f "$HOME/.config/gh/hosts.yml" ]] && return 0
  return 1
}

if [[ -n "${GIT_CONFIG_GLOBAL:-}" ]]; then
  [[ -f "$GIT_CONFIG_GLOBAL" ]] || fail "GIT_CONFIG_GLOBAL is not a file: $GIT_CONFIG_GLOBAL"
  GITCONFIG_SOURCE=$GIT_CONFIG_GLOBAL
else
  GITCONFIG_SOURCE=$HOME/.gitconfig
fi
mount_credential "$GITCONFIG_SOURCE" /home/tester/.gitconfig
mount_credential "$HOME/.ssh" /home/tester/.ssh
mount_credential "$HOME/.git-credentials" /home/tester/.git-credentials
mount_credential "$HOME/.config/gh" /home/tester/.config/gh
if [[ "$MODE" == remote ]] && ! has_github_credentials; then
  fail '--remote needs GitHub credentials: ~/.ssh, ~/.git-credentials, or ~/.config/gh/hosts.yml'
fi

TMP_BASE=${TMPDIR:-/tmp}
[[ -d "$TMP_BASE" ]] || fail "temporary directory does not exist: $TMP_BASE"
TMP_ROOT=$(mktemp -d "${TMP_BASE%/}/dev-harness-docker.XXXXXX")
[[ "$TMP_ROOT" != *","* ]] || fail "temp root contains a comma (--mount cannot express it): $TMP_ROOT"
RUNTIME_DIR=$TMP_ROOT/runtime
PROJECT_DIR=$TMP_ROOT/project
mkdir -p "$RUNTIME_DIR/home/.config" "$RUNTIME_DIR/opencode" "$PROJECT_DIR"

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ $KEEP -eq 1 ]]; then
    info "kept temp root: $TMP_ROOT"
  else
    rm -rf -- "$TMP_ROOT"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

MOUNT_ARGS+=(--mount "type=volume,src=$NPM_CACHE_VOLUME,dst=/home/tester/.npm")
MOUNT_ARGS+=(--mount "type=bind,src=$RUNTIME_DIR,dst=/tmp/dh-test")
MOUNT_ARGS+=(--mount "type=bind,src=$PROJECT_DIR,dst=/work/project")
ENV_ARGS+=(
  --env HOME=/home/tester
  --env XDG_CONFIG_HOME=/tmp/dh-test/home/.config
  --env OPENCODE_CONFIG_DIR=/tmp/dh-test/opencode
  --env npm_config_cache=/home/tester/.npm
  --env npm_config_update_notifier=false
  --env NO_COLOR=1
  --env GIT_TERMINAL_PROMPT=0
)
if [[ -n "${GIT_SSH_COMMAND:-}" ]]; then
  ENV_ARGS+=(--env "GIT_SSH_COMMAND=$GIT_SSH_COMMAND")
fi
if [[ $BUILD_IMAGE -eq 1 ]]; then
  info "building $IMAGE (UID=$(id -u), GID=$(id -g))"
  docker build \
    --build-arg "UID=$(id -u)" \
    --build-arg "GID=$(id -g)" \
    --file "$REPO_ROOT/docker/test/Dockerfile" \
    --tag "$IMAGE" \
    "$REPO_ROOT"
else
  info "using existing image $IMAGE (--no-build)"
fi

CREDENTIAL_BEFORE=
if [[ ${#CREDENTIAL_PATHS[@]} -gt 0 ]]; then
  CREDENTIAL_BEFORE=$(snapshot_credentials)
fi

run_container() {
  docker run --rm \
    "${MOUNT_ARGS[@]}" \
    "${ENV_ARGS[@]}" \
    --workdir /work/project \
    --entrypoint sh \
    "$IMAGE" -lc "$1" 2>&1 | sed -E 's#(https?://)[^/@[:space:]]+@#\1***@#g'
}

# Mode scripts write install.json/status.json before invoking this checker.
cat >"$RUNTIME_DIR/check-installed.sh" <<'CHECK'
set -eu
node - <<'NODE'
const fs = require('node:fs');
const read = (name) => JSON.parse(fs.readFileSync('/tmp/dh-test/' + name, 'utf8'));
const install = read('install.json');
const status = read('status.json');
const target = '/work/project/.opencode/plugins/dev-harness-skills';
const checks = [
  [install.scope === 'project', 'install scope'],
  [install.changed === true, 'install changed'],
  [install.mcp?.action === 'inserted', 'install mcp inserted'],
  [install.target === target, 'install target'],
  [status.scope === 'project', 'status scope'],
  [status.installed === true, 'status installed'],
  [status.mcp?.status === 'matching', 'status mcp matching'],
  [status.target === target, 'status target'],
];
for (const [ok, label] of checks) {
  if (!ok) throw new Error('assertion failed: ' + label);
}
console.log('[container] install/status JSON assertions passed');
NODE
node --input-type=module - <<'NODE'
const mod = await import('file:///work/project/.opencode/plugins/dev-harness-skills/dist/plugin.js');
const plugin = mod.default;
if (typeof plugin?.id !== 'string' || plugin.id === '' || typeof plugin?.setup !== 'function') {
  throw new Error('installed plugin bundle is not a Plugin.define value');
}
const agents = [];
const skills = [];
const ctx = {
  agent: { transform: async (fn) => fn({ update: (id) => agents.push(id) }) },
  skill: { transform: async (fn) => fn({ add: (skill) => skills.push(skill.name) }) },
};
await plugin.setup(ctx);
if (agents.length !== 7 || skills.length !== 17) {
  throw new Error(`setup registered ${agents.length} agents and ${skills.length} skills; expected 7/17`);
}
console.log(`[container] setup registered ${agents.length} agents and ${skills.length} skills from installed assets`);
NODE
agents_out=/tmp/dh-test/agents.txt
if timeout 30 opencode debug agents >"$agents_out" 2>/tmp/dh-test/agents.err; then
  count=$(grep -oE 'dh-[a-z0-9-]+' "$agents_out" | sort -u | wc -l | tr -d ' ')
  echo "[container] opencode debug agents surfaced $count dh-* agent(s)"
  if [ "$count" -ne 7 ]; then
    echo "[container] note: this opencode CLI does not surface plugin agents via debug agents; setup-stub registration above is the assertion"
  fi
else
  echo "[container] note: opencode debug agents unavailable in this image; setup-stub registration above is the assertion"
fi
CHECK

if [[ "$MODE" == local ]]; then
  info 'building host artifacts'
  (cd -- "$REPO_ROOT" && pnpm build)
  info 'packing the working tree'
  tarball=$(cd -- "$REPO_ROOT" && npm pack --ignore-scripts --pack-destination "$TMP_ROOT" | tail -n 1)
  case "$tarball" in
    /*) archive=$tarball ;;
    *) archive=$TMP_ROOT/$tarball ;;
  esac
  [[ -f "$archive" ]] || fail "npm pack did not produce a tarball: $tarball"
  MOUNT_ARGS+=(--mount "type=bind,src=$archive,dst=/pkg.tgz,readonly")
  info "tarball: $archive"
  # shellcheck disable=SC2016  # container-side variables are intentional
  read -r -d '' LOCAL_SCRIPT <<'SCRIPT' || true
set -euo pipefail
export PATH="/tmp/dh-test/npm/bin:$PATH"
echo "[container] node $(node -v), npm $(npm -v)"
npm install --global --prefix /tmp/dh-test/npm --ignore-scripts \
  --prefer-offline --no-audit --no-fund /pkg.tgz
dev-harness --version
dev-harness install --project --path /work/project --yes --json | tee /tmp/dh-test/install.json
dev-harness status --project --path /work/project --json | tee /tmp/dh-test/status.json
sh /tmp/dh-test/check-installed.sh
SCRIPT
  run_container "$LOCAL_SCRIPT"
else
  info "running remote npx install at ref '$REF'"
  ENV_ARGS+=(--env "DH_REF=$REF")
  # shellcheck disable=SC2016  # container-side variables are intentional
  read -r -d '' REMOTE_SCRIPT <<'SCRIPT' || true
set -euo pipefail
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new}"
echo "[container] npx github:andrescevp/development-harness#$DH_REF"
npx -y "github:andrescevp/development-harness#${DH_REF}" install --project --path /work/project --yes --json | tee /tmp/dh-test/install.json
npx -y "github:andrescevp/development-harness#${DH_REF}" status --project --path /work/project --json | tee /tmp/dh-test/status.json
sh /tmp/dh-test/check-installed.sh
SCRIPT
  run_container "$REMOTE_SCRIPT"
fi

if [[ ${#CREDENTIAL_PATHS[@]} -gt 0 ]]; then
  CREDENTIAL_AFTER=$(snapshot_credentials)
  [[ "$CREDENTIAL_BEFORE" == "$CREDENTIAL_AFTER" ]] || fail 'mounted credential files changed during the run'
  info "credential sources unchanged (${#CREDENTIAL_PATHS[@]} path(s), checksums match)"
fi

info "docker test passed ($MODE mode, image $IMAGE)"
