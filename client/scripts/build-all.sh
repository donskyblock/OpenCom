#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
OPENCOM_REQUIRE_RPM=1 node scripts/build-and-stage.mjs linux
node scripts/build-aur.mjs --skip-build
node scripts/build-and-stage.mjs win
