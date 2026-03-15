#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.opencom-docker-state"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-opencom}"

pick_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE")
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE")
    return 0
  fi

  echo "[docker] Docker Compose is required."
  exit 1
}

compose() {
  "${COMPOSE_CMD[@]}" "$@"
}

is_target() {
  case "${1:-}" in
    all|node) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_services() {
  local target="$1"
  case "$target" in
    all)
      SERVICE_TARGETS=(mariadb-core mariadb-node redis core node frontend)
      ;;
    node)
      SERVICE_TARGETS=(mariadb-core mariadb-node redis core node)
      ;;
    *)
      echo "[docker] Unknown target: $target"
      exit 1
      ;;
  esac
}

run_backup_best_effort() {
  if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
    echo "[docker] No backend/.env yet, skipping automatic backup."
    return 0
  fi

  local missing=0
  local tool
  for tool in mysqldump mysql tar python3; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "[docker] Missing $tool, skipping automatic backup."
      missing=1
    fi
  done
  if [[ "$missing" -eq 1 ]]; then
    return 0
  fi

  if ! "$ROOT_DIR/scripts/ops/auto-backup.sh"; then
    echo "[docker] Automatic backup failed; continuing."
  fi
}

ensure_first_run_setup() {
  local mode="$1"
  mkdir -p "$STATE_DIR"
  local marker="$STATE_DIR/${mode}.initialized"
  if [[ -f "$marker" ]]; then
    return
  fi

  if [[ "$mode" == "dev" ]]; then
    echo "[docker/dev] First run detected, taking a backup and rebuilding local config."
    run_backup_best_effort
    "$ROOT_DIR/scripts/dev/reconfigure.sh" --yes
  else
    echo "[docker/prod] First run detected, taking a backup."
    run_backup_best_effort
  fi

  touch "$marker"
}

ensure_env_for_target() {
  local target="$1"
  if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
    echo "[docker] backend/.env is missing."
    if [[ "$MODE_NAME" == "dev" ]]; then
      echo "[docker] Re-run ./docker/dev up ${target} or ./scripts/dev/reconfigure.sh --yes."
    else
      echo "[docker] Create it first, for example with ./scripts/dev/init-env.sh."
    fi
    exit 1
  fi

  if [[ "$target" == "all" && ! -f "$ROOT_DIR/frontend/.env" ]]; then
    echo "[docker] frontend/.env is required for target 'all'."
    exit 1
  fi
}

print_usage() {
  cat <<USAGE
Usage:
  ./${MODE_PATH} [up] [all|node]
  ./${MODE_PATH} restart [all|node]
  ./${MODE_PATH} logs [all|node]
  ./${MODE_PATH} down
  ./${MODE_PATH} status
  ./${MODE_PATH} backup

Targets:
  all   full stack: databases, redis, core, node, frontend
  node  backend-only stack: databases, redis, core, node

First run behavior:
  dev   runs automatic backup (best effort) and full reconfigure once
  prod  runs automatic backup (best effort) once
USAGE
}

run_mode() {
  MODE_NAME="$1"
  MODE_PATH="$2"
  shift 2 || true

  pick_compose

  local action="${1:-up}"
  local target="all"

  if is_target "$action"; then
    target="$action"
    action="up"
  else
    shift || true
    if [[ $# -gt 0 ]]; then
      target="${1:-all}"
    fi
  fi

  case "$action" in
    up)
      ensure_first_run_setup "$MODE_NAME"
      ensure_env_for_target "$target"
      resolve_services "$target"
      echo "[docker/${MODE_NAME}] Starting target '${target}'"
      compose up -d --build "${SERVICE_TARGETS[@]}"
      ;;
    restart)
      ensure_env_for_target "$target"
      resolve_services "$target"
      echo "[docker/${MODE_NAME}] Restarting target '${target}'"
      compose up -d --build "${SERVICE_TARGETS[@]}"
      ;;
    logs)
      ensure_env_for_target "$target"
      resolve_services "$target"
      compose logs -f "${SERVICE_TARGETS[@]}"
      ;;
    down)
      echo "[docker/${MODE_NAME}] Stopping stack"
      compose down --remove-orphans
      ;;
    status)
      compose ps
      ;;
    backup)
      run_backup_best_effort
      ;;
    -h|--help|help)
      print_usage
      ;;
    *)
      echo "[docker/${MODE_NAME}] Unknown action: $action"
      print_usage
      exit 1
      ;;
  esac
}
