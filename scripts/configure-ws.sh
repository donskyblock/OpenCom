#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"
WS_DOMAIN="ws.opencom.online"
WS_IP=""
WS_PORT="9443"
FORCE_INSECURE="0"
DIRECT_IP="0"
AUTO_FALLBACK_IP="1"

usage() {
  cat <<USAGE
Usage: ./scripts/configure-ws.sh [options]

Configures OpenCom env files for direct websocket hosting (frontend via nginx, WS direct).

Options:
  --domain <host>         Websocket domain host (default: ws.opencom.online)
  --ip <ip>               Direct websocket IP fallback (e.g. 37.114.58.186)
  --port <port>           Websocket port (default: 9443)
  --insecure              Force plain ws:// (sets VITE_GATEWAY_WS_INSECURE=1)
  --direct-ip             Set VITE_GATEWAY_WS_URL directly to the provided --ip endpoint
  --no-auto-fallback-ip   Disable automatic fallback to --ip if domain is unreachable
  --backend-env <path>    Backend env file (default: backend/.env)
  --frontend-env <path>   Frontend env file (default: frontend/.env)
  -h, --help              Show this help

Examples:
  ./scripts/configure-ws.sh --domain ws.opencom.online --ip 37.114.58.186
  ./scripts/configure-ws.sh --ip 37.114.58.186 --direct-ip --insecure
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      WS_DOMAIN="${2:-}"; shift 2 ;;
    --ip)
      WS_IP="${2:-}"; shift 2 ;;
    --port)
      WS_PORT="${2:-}"; shift 2 ;;
    --insecure)
      FORCE_INSECURE="1"; shift ;;
    --direct-ip)
      DIRECT_IP="1"; shift ;;
    --no-auto-fallback-ip)
      AUTO_FALLBACK_IP="0"; shift ;;
    --backend-env)
      BACKEND_ENV="${2:-}"; shift 2 ;;
    --frontend-env)
      FRONTEND_ENV="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ "$DIRECT_IP" == "1" && -z "$WS_IP" ]]; then
  echo "--direct-ip requires --ip <address>" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKEND_ENV")" "$(dirname "$FRONTEND_ENV")"
touch "$BACKEND_ENV" "$FRONTEND_ENV"

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

SCHEME="wss"
if [[ "$FORCE_INSECURE" == "1" ]]; then
  SCHEME="ws"
fi

WS_HOST="$WS_DOMAIN"
if [[ "$DIRECT_IP" == "1" ]]; then
  WS_HOST="$WS_IP"
fi

WS_URL="${SCHEME}://${WS_HOST}:${WS_PORT}/gateway"

# Backend: make WS listener reachable externally.
upsert_env "$BACKEND_ENV" "CORE_GATEWAY_HOST" "0.0.0.0"
upsert_env "$BACKEND_ENV" "CORE_GATEWAY_PORT" "$WS_PORT"
upsert_env "$BACKEND_ENV" "NODE_HOST" "0.0.0.0"

# Frontend: point gateway directly, keep host + fallback IP hints.
upsert_env "$FRONTEND_ENV" "VITE_GATEWAY_WS_URL" "$WS_URL"
upsert_env "$FRONTEND_ENV" "VITE_GATEWAY_WS_HOST" "$WS_DOMAIN"
upsert_env "$FRONTEND_ENV" "VITE_GATEWAY_WS_INSECURE" "$FORCE_INSECURE"
if [[ -n "$WS_IP" ]]; then
  upsert_env "$FRONTEND_ENV" "VITE_GATEWAY_WS_IP" "$WS_IP"
fi

echo "[ws-config] Updated: $BACKEND_ENV"
echo "[ws-config] Updated: $FRONTEND_ENV"
echo "[ws-config] Gateway URL: $WS_URL"

if [[ "$BACKEND_ENV" == /tmp/* || "$FRONTEND_ENV" == /tmp/* ]]; then
  echo "[ws-config] NOTE: You targeted temp files. Run without --backend-env/--frontend-env to apply live config."
fi

# Basic reachability hint (best effort only).
if command -v nc >/dev/null 2>&1; then
  echo "[ws-config] Checking TCP reachability..."
  DOMAIN_OK="0"
  IP_OK="0"
  if nc -z -w 2 "$WS_HOST" "$WS_PORT" >/dev/null 2>&1; then
    echo "[ws-config] OK: ${WS_HOST}:${WS_PORT} reachable"
    DOMAIN_OK="1"
  else
    echo "[ws-config] WARN: ${WS_HOST}:${WS_PORT} not reachable from this machine"
  fi

  if [[ -n "$WS_IP" && "$WS_IP" != "$WS_HOST" ]]; then
    if nc -z -w 2 "$WS_IP" "$WS_PORT" >/dev/null 2>&1; then
      echo "[ws-config] OK: ${WS_IP}:${WS_PORT} reachable"
      IP_OK="1"
    else
      echo "[ws-config] WARN: ${WS_IP}:${WS_PORT} not reachable from this machine"
    fi
  fi

  if [[ "$AUTO_FALLBACK_IP" == "1" && "$DIRECT_IP" == "0" && -n "$WS_IP" && "$DOMAIN_OK" == "0" && "$IP_OK" == "1" ]]; then
    FALLBACK_URL="${SCHEME}://${WS_IP}:${WS_PORT}/gateway"
    upsert_env "$FRONTEND_ENV" "VITE_GATEWAY_WS_URL" "$FALLBACK_URL"
    echo "[ws-config] Applied fallback: VITE_GATEWAY_WS_URL=${FALLBACK_URL}"
  fi
fi

echo "[ws-config] Done. Restart backend/frontend after env changes."
