#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DO_PULL=0
DO_BACKUP=0
SKIP_BUILD=0

load_backend_env() {
  local env_file="$BACKEND_DIR/.env"

  if [[ ! -f "$env_file" ]]; then
    echo "[ERROR] backend/.env not found. Run ./scripts/init-env.sh first, or use --init-env."
    exit 1
  fi

  echo "[db-setup] Loading backend/.env"
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

load_backend_env

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull) DO_PULL=1 ;;
    --backup) DO_BACKUP=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--pull] [--backup] [--skip-build]"
      exit 1
      ;;
  esac
  shift
done

if [[ $DO_PULL -eq 1 ]]; then
  echo "Pulling latest code..."
  git -C "$ROOT_DIR" pull --rebase
fi

if [[ $DO_BACKUP -eq 1 ]]; then
  backup_path="$ROOT_DIR/backups/opencom-$(date +%Y%m%d-%H%M%S).tar.gz"
  echo "Creating backup at $backup_path"
  "$ROOT_DIR/scripts/migrate-portability.sh" export "$backup_path"
fi

echo "Installing backend dependencies..."
npm --prefix "$ROOT_DIR/backend" install

echo "Installing frontend dependencies..."
npm --prefix "$ROOT_DIR/frontend" install

echo "Running database migrations..."
npm --prefix "$ROOT_DIR/backend" run migrate:core
npm --prefix "$ROOT_DIR/backend" run migrate:node

if [[ $SKIP_BUILD -eq 0 ]]; then
  echo "Building backend packages..."
  npm --prefix "$ROOT_DIR/backend" run build

  echo "Building frontend..."
  npm --prefix "$ROOT_DIR/frontend" run build
fi

echo "Update complete."
