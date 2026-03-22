#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "backend/ not found"
  exit 1
fi

load_backend_env() {
  local env_file="${BACKEND_DIR}/.env"
  if [[ ! -f "${env_file}" ]]; then
    echo "[warn] backend/.env not found. PM2 starts may fail until env vars are configured."
    return
  fi
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
}

run_cmd() {
  echo
  echo ">>> $*"
  (cd "${BACKEND_DIR}" && "$@")
}

print_menu() {
  cat <<'EOF'

OpenCom Server Node Manager
1) Install backend dependencies
2) Run core migrations
3) Run server-node migrations
4) Start/restart core (PM2)
5) Start/restart server node (PM2)
6) Start/restart server node with voice debug (PM2)
7) Build backend workspaces
8) Exit

EOF
}

load_backend_env

while true; do
  print_menu
  read -r -p "Select an option [1-8]: " choice
  case "${choice}" in
    1) run_cmd npm install ;;
    2) run_cmd npm run migrate:core ;;
    3) run_cmd npm run migrate:node ;;
    4) run_cmd npm run start:core ;;
    5) run_cmd npm run start:node ;;
    6) run_cmd bash -lc 'if pm2 describe opencom-node >/dev/null 2>&1; then DEBUG_HTTP=1 DEBUG_VOICE=1 LOG_LEVEL=debug pm2 restart opencom-node --update-env; else DEBUG_HTTP=1 DEBUG_VOICE=1 LOG_LEVEL=debug pm2 start packages/server-node/dist/index.js --name opencom-node --update-env; fi' ;;
    7) run_cmd npm run build ;;
    8) exit 0 ;;
    *) echo "Invalid option." ;;
  esac
done
