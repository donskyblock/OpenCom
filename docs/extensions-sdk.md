# OpenCom Extension SDK Guide

This guide explains how to build OpenCom extensions using the `opencom-extension-sdk` library.

## 1) Extension project layout

```text
Extensions/
  Server/
    my-extension/
      extension.json
      index.js
```

`extension.json` example:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "scope": "server",
  "entry": "index.js",
  "permissions": ["all"]
}
```

## 2) Build commands (Discord-like workflow)

```js
import { command, optionString } from "opencom-extension-sdk";

export const commands = [
  command({
    name: "welcome",
    description: "Send welcome text",
    options: [optionString("name", "User name", false)],
    async execute(ctx) {
      const name = String(ctx.args.name || "friend");
      return { content: `Welcome ${name}!` };
    }
  })
];
```

### Command naming in runtime

Commands are auto-namespaced by extension id:

- `my-extension.welcome`

## 3) Use OpenCom APIs (without bot accounts)

Each command receive `ctx.apis`:

- `ctx.apis.core.get/post/patch/del`
- `ctx.apis.node.get/post/patch/del`

These calls use the invoking authenticated user token automatically.

```js
async execute(ctx) {
  const me = await ctx.apis.node.get("/v1/me");
  const servers = await ctx.apis.core.get("/v1/servers");
  return { me, servers };
}
```

## 4) Runtime endpoints for command integration

From server node:

- `GET /v1/extensions/commands`
- `POST /v1/extensions/commands/:commandName/execute`

Execute body:

```json
{
  "args": {
    "name": "donsky"
  }
}
```

## 5) Enable extension per server

Use the **Server Admin Panel → Extensions** tab to enable/disable reviewed extensions for each server.

## 6) Publish SDK

The SDK lives at `Extensions/lib` and is published by GitHub Actions workflow `publish-extension-sdk.yml`.

You must set repository secret:

- `NPM_TOKEN`
