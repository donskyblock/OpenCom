#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs/site"
FAILED=0

if [[ ! -d "$DOCS_DIR" ]]; then
  echo "[docs] docs/site not found at $DOCS_DIR"
  exit 1
fi

while IFS= read -r -d '' file; do
  while IFS= read -r href; do
    [[ -z "$href" ]] && continue
    case "$href" in
      http://*|https://*|mailto:*|javascript:*|\#*) continue ;;
    esac

    href_no_fragment="${href%%#*}"
    [[ -z "$href_no_fragment" ]] && continue

    if [[ "$href_no_fragment" == /* ]]; then
      target="$DOCS_DIR$href_no_fragment"
    else
      target="$(cd "$(dirname "$file")" && pwd)/$href_no_fragment"
    fi

    if [[ ! -e "$target" ]]; then
      echo "[docs] Broken link: $file -> $href"
      FAILED=1
    fi
  done < <(rg -o --no-line-number 'href="([^"]+)"' "$file" | sed -E 's/^href="(.*)"$/\1/')
done < <(find "$DOCS_DIR" -type f -name '*.html' -print0)

if [[ "$FAILED" -ne 0 ]]; then
  echo "[docs] Link check failed."
  exit 1
fi

echo "[docs] Link check passed."
