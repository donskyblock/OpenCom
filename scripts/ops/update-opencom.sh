#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DO_PULL=0
DO_BACKUP=0
SKIP_BUILD=0

print_usage() {
  cat <<'USAGE'
Usage: ./scripts/ops/update-opencom.sh [--pull] [--backup] [--skip-build]

Backend-only update flow:
  1) optionally pull latest code
  2) optionally create backup
  3) install backend dependencies
  4) build backend (unless --skip-build)
  5) run backend migrations
  6) restart backend services
USAGE
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "[ERROR] Required file missing: $file"
    exit 1
  fi
}

require_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo "[ERROR] Required directory missing: $dir"
    exit 1
  fi
}

load_backend_env() {
  local env_file="$ROOT_DIR/backend/.env"
  if [[ ! -f "$env_file" ]]; then
    echo "[ERROR] backend/.env not found"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  export CORE_HOST="${CORE_HOST:-127.0.0.1}"
  export NODE_HOST="${NODE_HOST:-0.0.0.0}"
  set +a
}

restart_service() {
  local service="$1"

  echo "Restarting service: $service"
  sudo systemctl restart "$service"

  if ! sudo systemctl is-active --quiet "$service"; then
    echo "[ERROR] Failed to restart service: $service"
    sudo systemctl status "$service" --no-pager || true
    exit 1
  fi

  echo "[ok] $service is running"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull) DO_PULL=1 ;;
    --backup) DO_BACKUP=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help|help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_usage
      exit 1
      ;;
  esac
  shift
done

require_dir "$ROOT_DIR/backend"
require_file "$ROOT_DIR/backend/.env"

if [[ $DO_PULL -eq 1 ]]; then
  echo "Pulling latest code..."
  git -C "$ROOT_DIR" pull --rebase
fi

if [[ $DO_BACKUP -eq 1 ]]; then
  backup_path="$ROOT_DIR/backups/opencom-$(date +%Y%m%d-%H%M%S).tar.gz"
  echo "Creating backup at $backup_path"
  "$ROOT_DIR/scripts/ops/migrate-portability.sh" export "$backup_path"
fi

load_backend_env

pushd "$ROOT_DIR/backend" >/dev/null

echo "Installing backend dependencies..."
npm ci

if [[ $SKIP_BUILD -eq 0 ]]; then
  echo "Building backend..."
  npm run build
else
  echo "Skipping backend build (--skip-build)."
fi

echo "Running backend migrations..."
npm run migrate:core
npm run migrate:node

popd >/dev/null

echo "Restarting backend services..."
restart_service opencom-core
restart_service opencom-node

echo "Update complete."