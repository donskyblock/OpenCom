#!/usr/bin/env bash
set -euo pipefail

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found on PATH." >&2
  exit 1
fi

PKG="${1:-online.opencom.mobile}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/crash-$(date +%Y%m%d-%H%M%S).log"

echo "Clearing existing logcat buffer..."
adb logcat -c || true
echo "Now open the app on your phone and wait for the crash."
echo "Capturing logs to: $OUT_FILE"
echo "Press Ctrl+C after crash."

adb logcat | tee "$OUT_FILE"
