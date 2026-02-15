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

Each command receives `ctx.apis` with both low-level and high-level helpers.

### Low-level methods

- `ctx.apis.core.get/post/patch/del`
- `ctx.apis.node.get/post/patch/del`

### High-level helpers

You can now access most API domains directly instead of manually managing endpoint strings:

- `ctx.apis.auth.*`
- `ctx.apis.profiles.*`
- `ctx.apis.social.*`
- `ctx.apis.dms.*`
- `ctx.apis.servers.*`
- `ctx.apis.nodeGuilds.*`
- `ctx.apis.channels.*`
- `ctx.apis.messages.*`
- `ctx.apis.voice.*`
- `ctx.apis.extensions.*`

```js
async execute(ctx) {
  const me = await ctx.apis.auth.me();
  const servers = await ctx.apis.servers.list();
  const guildChannels = await ctx.apis.nodeGuilds.channels("guild_123");
  return { me, servers, guildChannels };
}
```

These calls use the invoking authenticated user token automatically.

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

Use the **Server Admin Panel → Extensions** tab to enable/disable reviewed server extensions for each server.

## 6) Client extensions in app settings

Client-only extensions are loaded from **Settings → Extensions** in the main client app.

- Toggle reviewed client extensions from the catalog.
- Optional **Developer Mode** lets you add custom extension script URLs for local/testing builds.

## 7) Publish SDK

The SDK lives at `Extensions/lib` and is published by GitHub Actions workflow `publish-extension-sdk.yml`.

You must set repository secret:

- `NPM_TOKEN`
