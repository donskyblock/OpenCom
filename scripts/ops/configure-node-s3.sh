#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"
NODE_BUCKET="opencom-node"
S3_REGION=""
S3_ENDPOINT=""
S3_FORCE_PATH_STYLE="0"
S3_KEY_PREFIX=""

usage() {
  cat <<USAGE
Usage: ./scripts/ops/configure-node-s3.sh [options]

Configures backend/.env for SERVER NODE service to use S3 with IAM-role auth defaults.

Options:
  --bucket <name>       Node uploads bucket (default: opencom-node)
  --region <region>     AWS region (required if S3_REGION not already set)
  --endpoint <url>      Optional custom S3 endpoint (leave empty for AWS S3)
  --path-style <0|1>    S3_FORCE_PATH_STYLE (default: 0)
  --key-prefix <prefix> Optional S3 object key prefix
  --env-file <path>     Backend env file path (default: backend/.env)
  -h, --help            Show this help

Examples:
  ./scripts/ops/configure-node-s3.sh --region eu-west-2
  ./scripts/ops/configure-node-s3.sh --region us-east-1 --bucket opencom-node
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)
      NODE_BUCKET="${2:-}"; shift 2 ;;
    --region)
      S3_REGION="${2:-}"; shift 2 ;;
    --endpoint)
      S3_ENDPOINT="${2:-}"; shift 2 ;;
    --path-style)
      S3_FORCE_PATH_STYLE="${2:-}"; shift 2 ;;
    --key-prefix)
      S3_KEY_PREFIX="${2:-}"; shift 2 ;;
    --env-file)
      ENV_FILE="${2:-}"; shift 2 ;;
    -h|--help|help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ -z "$NODE_BUCKET" ]]; then
  echo "--bucket cannot be empty" >&2
  exit 1
fi

if [[ "$S3_FORCE_PATH_STYLE" != "0" && "$S3_FORCE_PATH_STYLE" != "1" ]]; then
  echo "--path-style must be 0 or 1" >&2
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

read_existing_env() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  printf '%s' "$value"
}

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

if [[ -z "$S3_REGION" ]]; then
  S3_REGION="$(read_existing_env S3_REGION)"
fi

if [[ -z "$S3_REGION" ]]; then
  echo "--region is required (or set S3_REGION in $ENV_FILE first)" >&2
  exit 1
fi

upsert_env "STORAGE_PROVIDER" "s3"
upsert_env "NODE_S3_BUCKET" "$NODE_BUCKET"
upsert_env "S3_REGION" "$S3_REGION"
upsert_env "S3_ENDPOINT" "$S3_ENDPOINT"
upsert_env "S3_FORCE_PATH_STYLE" "$S3_FORCE_PATH_STYLE"
upsert_env "S3_KEY_PREFIX" "$S3_KEY_PREFIX"

# IAM role auth: keep static credentials empty.
upsert_env "S3_ACCESS_KEY_ID" ""
upsert_env "S3_SECRET_ACCESS_KEY" ""

echo "[node-s3] Updated $ENV_FILE"
echo "[node-s3] STORAGE_PROVIDER=s3"
echo "[node-s3] NODE_S3_BUCKET=$NODE_BUCKET"
echo "[node-s3] S3_REGION=$S3_REGION"
if [[ -n "$S3_ENDPOINT" ]]; then
  echo "[node-s3] S3_ENDPOINT=$S3_ENDPOINT"
else
  echo "[node-s3] S3_ENDPOINT cleared (AWS S3 default endpoint)"
fi
echo "[node-s3] IAM role mode enabled (static keys cleared)"
