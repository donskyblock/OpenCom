# OpenCom Extensions

OpenCom scans this folder for extension projects.

## Folder layout
- `Extensions/Client/<extension-id>/extension.json`
- `Extensions/Server/<extension-id>/extension.json`
- `Extensions/lib/` contains the publishable `opencom-extension-sdk` package.

## Command system
Server extensions can export a `commands` array. Commands are auto-registered on enable and can be executed by authenticated users via node endpoints.

## Server admin integration
Server extensions are enabled per server in the **Server Admin Panel → Extensions** tab.

## Publishing SDK
The SDK under `Extensions/lib` is published by GitHub Actions workflow `.github/workflows/publish-extension-sdk.yml`.
