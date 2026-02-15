# opencom-extension-sdk

Official SDK for building OpenCom extensions with command support and API helpers.

## Install

```bash
npm install opencom-extension-sdk
```

## Define a server extension

```js
import { defineExtension, command, optionString } from "opencom-extension-sdk";

export const manifest = defineExtension({
  id: "my-tools",
  name: "My Tools",
  version: "1.0.0",
  scope: "server"
});

export const commands = [
  command({
    name: "hello",
    description: "Say hi",
    options: [optionString("name", "Target name", false)],
    async execute(ctx) {
      const name = String(ctx.args.name || "friend");
      return { content: `Hello ${name}!`, ephemeral: false };
    }
  })
];

export async function activate(ctx) {
  ctx.log.log("Extension active", ctx.serverId);
}
```

## Runtime command execution

When your extension is enabled for a server, OpenCom registers exported `commands`.

- List commands from node: `GET /v1/extensions/commands`
- Execute command: `POST /v1/extensions/commands/:commandName/execute` with JSON body `{ "args": { ... } }`

Command names are namespaced as:
- `extensionId.commandName`

## API client helper

Every command execute context includes:
- `ctx.apis.core.*` for Core API
- `ctx.apis.node.*` for Node API

The SDK also exposes `createOpenComApiClient()` if you need standalone clients.

## Returned command payload

A command can return any JSON serializable object. Recommended shape:

```json
{
  "content": "Message text",
  "ephemeral": false,
  "data": {}
}
```

## Security model

Commands execute as the invoking authenticated user token. You can call OpenCom APIs without creating bot accounts.
