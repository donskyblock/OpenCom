#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs/site"
SLUG="${1:-}"
TITLE="${2:-New Page}"

if [[ -z "$SLUG" ]]; then
  echo "Usage: ./scripts/docs/new-page.sh <slug> [title]"
  echo "Example: ./scripts/docs/new-page.sh api-webhooks \"Webhook API\""
  exit 1
fi

TARGET="$DOCS_DIR/${SLUG}.html"
if [[ -e "$TARGET" ]]; then
  echo "[docs] File already exists: $TARGET"
  exit 1
fi

cat > "$TARGET" <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenCom Docs - ${TITLE}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="brand-badge">OC</span> OpenCom Docs</div>
      <div class="nav-group"><div class="nav-title">Get Started</div><a class="nav-link" href="./index.html">Welcome</a><a class="nav-link" href="./quickstart.html">Quickstart</a></div>
      <div class="nav-group"><div class="nav-title">API</div><a class="nav-link" href="./api-core.html">Core API</a><a class="nav-link" href="./api-server-node.html">Server Node API</a></div>
      <div class="nav-group"><div class="nav-title">Extensions</div><a class="nav-link" href="./extensions-sdk.html">SDK + Runtime</a></div>
      <div class="nav-group"><div class="nav-title">Guides</div><a class="nav-link" href="./guides.html">Feature Guides</a><a class="nav-link" href="./operations.html">Operations</a></div>
    </aside>

    <div class="content-wrap">
      <header class="topbar">
        <button class="mobile-toggle" id="mobile-toggle">Menu</button>
        <div class="search"><input id="doc-search" placeholder="Search docs..." /><div class="search-results" id="search-results"></div></div>
        <div class="search-hint">Press <kbd>/</kbd> to search</div>
      </header>

      <main class="content">
        <section class="hero">
          <div class="eyebrow">Docs</div>
          <h1>${TITLE}</h1>
          <p class="lead">Write your content here.</p>
        </section>
      </main>
    </div>
  </div>
  <script src="./app.js"></script>
</body>
</html>
HTML

echo "[docs] Created $TARGET"
