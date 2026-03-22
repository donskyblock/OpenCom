#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_ID="${1:-default-server}"

print_usage() {
  cat <<USAGE
Usage: ./scripts/ops/start-server.sh [server-id]

Starts or restarts a single OpenCom server-node instance under PM2.
If no server-id is provided, defaults to 'default-server'.

Examples:
  ./scripts/ops/start-server.sh                    # Start default server
  ./scripts/ops/start-server.sh my-gaming-server   # Start specific server
USAGE
}

load_backend_env() {
  local env_file="$ROOT_DIR/backend/.env"
  if [[ ! -f "$env_file" ]]; then
    echo "[err] backend/.env not found. Run ./scripts/dev/init-env.sh first."
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  # Configure for reverse proxy (localhost only)
  export NODE_HOST="${NODE_HOST:-0.0.0.0}"
  export NODE_ID="$SERVER_ID"
  set +a
}

start_server() {
  local app_name="opencom-node-${SERVER_ID}"
  echo "[start] Server Node via PM2: $SERVER_ID (${app_name})"
  pushd "$ROOT_DIR/backend" >/dev/null
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[err] pm2 is not installed. Install it first (for example: npm i -g pm2)."
    exit 1
  fi
  if [[ ! -f "packages/server-node/dist/index.js" ]]; then
    echo "[err] Build artifacts not found. Run: npm run build"
    exit 1
  fi
  if pm2 describe "$app_name" >/dev/null 2>&1; then
    pm2 restart "$app_name" --update-env
  else
    pm2 start packages/server-node/dist/index.js --name "$app_name" --update-env
  fi
  pm2 status "$app_name"
  popd >/dev/null
}

case "${1:-}" in
  -h|--help|help)
    print_usage
    ;;
  *)
    load_backend_env
    start_server
    ;;
esac
