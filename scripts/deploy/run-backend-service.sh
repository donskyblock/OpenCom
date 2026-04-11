#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE="${1:-}"
shift || true

if [[ -z "$SERVICE" ]]; then
  echo "Usage: ./scripts/deploy/run-backend-service.sh <core|node|media> [--replicas N] [--port PORT] [--name NAME] [--env-file FILE] [--image TAG] [--rebuild]"
  exit 1
fi

REPLICAS=1
HOST_PORT=""
NAME_PREFIX="opencom-${SERVICE}-local"
IMAGE_TAG="opencom-backend-${SERVICE}:local"
REBUILD=0

case "$SERVICE" in
  core)
    DEFAULT_ENV_FILE="$ROOT_DIR/backend/core.env"
    CONTAINER_PORT=8080
    SERVICE_PORT_VAR="CORE_PORT"
    ;;
  node)
    DEFAULT_ENV_FILE="$ROOT_DIR/backend/node.env"
    CONTAINER_PORT=8080
    SERVICE_PORT_VAR="NODE_PORT"
    ;;
  media)
    DEFAULT_ENV_FILE="$ROOT_DIR/backend/media.env"
    CONTAINER_PORT=8080
    SERVICE_PORT_VAR="MEDIA_PORT"
    ;;
  *)
    echo "[err] Unknown service: $SERVICE"
    exit 1
    ;;
esac

ENV_FILE="$DEFAULT_ENV_FILE"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --replicas)
      REPLICAS="$2"
      shift 2
      ;;
    --port)
      HOST_PORT="$2"
      shift 2
      ;;
    --name)
      NAME_PREFIX="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --image)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --rebuild)
      REBUILD=1
      shift
      ;;
    *)
      echo "[err] Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[err] Env file not found: $ENV_FILE"
  exit 1
fi

if [[ -z "$HOST_PORT" ]]; then
  case "$SERVICE" in
    core) HOST_PORT=3001 ;;
    node) HOST_PORT=3002 ;;
    media) HOST_PORT=3003 ;;
  esac
fi

echo "[info] Service: $SERVICE"
echo "[info] Env file: $ENV_FILE"
echo "[info] Replicas: $REPLICAS"
echo "[info] Base host port: $HOST_PORT"

if [[ "$REBUILD" == "1" ]] || ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  echo "[build] Building $IMAGE_TAG"
  docker build \
    --file "$ROOT_DIR/backend/Dockerfile" \
    --build-arg "SERVICE=$SERVICE" \
    --tag "$IMAGE_TAG" \
    "$ROOT_DIR/backend"
fi

for ((i=1; i<=REPLICAS; i++)); do
  INSTANCE_NAME="$NAME_PREFIX"
  INSTANCE_PORT="$HOST_PORT"
  if (( REPLICAS > 1 )); then
    INSTANCE_NAME="${NAME_PREFIX}-${i}"
    INSTANCE_PORT=$((HOST_PORT + i - 1))
  fi

  echo "[run] $INSTANCE_NAME on http://127.0.0.1:${INSTANCE_PORT}"
  docker rm -f "$INSTANCE_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$INSTANCE_NAME" \
    --restart unless-stopped \
    --env-file "$ENV_FILE" \
    -e PORT="$CONTAINER_PORT" \
    -e "$SERVICE_PORT_VAR=$CONTAINER_PORT" \
    -p "${INSTANCE_PORT}:${CONTAINER_PORT}" \
    "$IMAGE_TAG" >/dev/null
done

echo "[done] Started ${REPLICAS} ${SERVICE} container(s)."
