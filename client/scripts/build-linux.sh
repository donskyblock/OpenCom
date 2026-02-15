#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
node scripts/build-and-stage.mjs linux
