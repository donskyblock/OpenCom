# OpenCom Documentation

This directory now contains a static docs portal at `docs/site` with:

- API documentation (Core + Server Node)
- Extension SDK docs
- General usage and feature guides
- Operations and reliability notes

## Local preview

From repo root:

```bash
./scripts/docs/serve.sh
```

Then open `http://localhost:4173`.

Optional docs utilities:

```bash
./scripts/docs/check-links.sh
./scripts/docs/new-page.sh api-webhooks "Webhook API"
```

## Deploy options

### GitHub Pages

1. Push repo to GitHub.
2. In Pages settings, set source to branch + `/docs/site`.
3. Your docs are served as static files.

### Netlify

- Build command: none
- Publish directory: `docs/site`

### Cloudflare Pages

- Framework preset: None
- Build command: none
- Output directory: `docs/site`

### Any VPS (nginx/Caddy)

Serve the `docs/site` directory directly as static files.

## Editing docs

Update pages in `docs/site/*.html`.

Main pages:

- `docs/site/index.html`
- `docs/site/quickstart.html`
- `docs/site/api-core.html`
- `docs/site/api-server-node.html`
- `docs/site/extensions-sdk.html`
- `docs/site/guides.html`
- `docs/site/operations.html`
