#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD=0
BUILD_AUR=0
STAGE_AUR=0

usage() {
  cat <<'EOF'
Usage: ./scripts/client.sh [--build] [--build-aur] [--stage-aur]

Default:
  Runs the desktop client on Linux.

Options:
  --build      Build Linux client artifacts, then run the client.
  --build-aur  Build Linux artifacts and generate an AUR package skeleton, then exit.
  --stage-aur  Generate an AUR package skeleton from the current Linux artifacts, then exit.
  -h, --help  Show this help text.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    --build-aur) BUILD_AUR=1 ;;
    --stage-aur) STAGE_AUR=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage
      exit 1
      ;;
  esac
done

MODE_COUNT=$((BUILD + BUILD_AUR + STAGE_AUR))
if [[ "$MODE_COUNT" -gt 1 ]]; then
  echo "Use only one of --build, --build-aur, or --stage-aur." >&2
  usage
  exit 1
fi

cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "[client] Installing frontend dependencies..."
  npm --prefix frontend install
fi

if [[ ! -d client/node_modules ]]; then
  echo "[client] Installing client dependencies..."
  npm --prefix client install
fi

if [[ "$BUILD" -eq 1 ]]; then
  echo "[client] Building Linux artifacts..."
  npm --prefix client run build:linux
fi

if [[ "$BUILD_AUR" -eq 1 ]]; then
  echo "[client] Building Linux artifacts and AUR skeleton..."
  npm --prefix client run build:aur
  exit 0
fi

if [[ "$STAGE_AUR" -eq 1 ]]; then
  echo "[client] Generating AUR skeleton from current artifacts..."
  npm --prefix client run stage:aur
  exit 0
fi

echo "[client] Starting desktop client..."
npm --prefix client run start
