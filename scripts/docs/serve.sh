#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs/site"
PORT="${1:-4173}"
HOST="${2:-127.0.0.1}"

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "[docs] docs/site not found at $DOCS_DIR"
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  echo "[docs] Serving docs at http://${HOST}:${PORT}"
  exec python3 -m http.server "$PORT" --bind "$HOST" --directory "$DOCS_DIR"
fi

if command -v python >/dev/null 2>&1; then
  echo "[docs] Serving docs at http://${HOST}:${PORT}"
  exec python -m http.server "$PORT" --bind "$HOST" --directory "$DOCS_DIR"
fi

echo "[docs] Python is required to serve docs locally (python3 or python)."
exit 1
