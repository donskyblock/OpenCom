#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "backend/ not found"
  exit 1
fi

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
4) Start core (dev)
5) Start server node (dev)
6) Start server node with voice debug
7) Build backend workspaces
8) Exit

EOF
}

while true; do
  print_menu
  read -r -p "Select an option [1-8]: " choice
  case "${choice}" in
    1) run_cmd npm install ;;
    2) run_cmd npm run migrate:core ;;
    3) run_cmd npm run migrate:node ;;
    4) run_cmd npm run dev:core ;;
    5) run_cmd npm run dev:node ;;
    6) run_cmd npm run dev:voice-debug ;;
    7) run_cmd npm run build ;;
    8) exit 0 ;;
    *) echo "Invalid option." ;;
  esac
done
