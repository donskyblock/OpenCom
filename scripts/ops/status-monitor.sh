#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ $# -eq 0 ]]; then
  exec node "$ROOT_DIR/scripts/status-webapp/monitor.mjs" --watch 120
fi

exec node "$ROOT_DIR/scripts/status-webapp/monitor.mjs" "$@"
