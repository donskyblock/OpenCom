# OpenCom Desktop Client Wrapper

Electron wrapper around the hosted OpenCom frontend.

## Features

- Launches the frontend in a desktop window.
- Always appends `?desktop=1` so the frontend skips the landing page.
- Exposes `window.opencomDesktop.getLatestOfficialBuild()` in the renderer process.
- Includes a CLI helper to resolve the latest official build asset from:
  - `frontend/OpenCom.exe`
  - `frontend/OpenCom.deb`
  - `frontend/OpenCom.tar.gz`

## Development

```bash
cd client
npm install
npm start
```

Override app URL if needed:

```bash
OPENCOM_APP_URL="https://opencom.online" npm start
```

## Build

```bash
npm run build:win
npm run build:linux
```

## Resolve latest official build

```bash
node get-latest-build.mjs [platform] [baseUrl]
```

Examples:

```bash
node get-latest-build.mjs win32
node get-latest-build.mjs linux https://raw.githubusercontent.com/donskyblock/OpenCom/main
```
