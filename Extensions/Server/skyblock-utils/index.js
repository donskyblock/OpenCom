import { command, createServerContext, optionString } from "../../lib/opencom-extension-sdk.js";

export const commands = [
  command({
    name: "sb-plugin",
    description: "Simple command to test the extension",
    options: [optionString("text", "Optional message", false)],
    async execute(ctx) {
      const input = String(ctx.args?.text || "Skyblock Utils Plugin is working!");
      const me = await ctx.apis.node.get("/v1/me").catch(() => null);
      return {
        content: `${input}`,
        user: me?.user?.username || ctx.userId,
        serverId: ctx.serverId
      };
    }
  })
];

export async function activate(ctx) {
  const context = createServerContext(ctx);
  context.log(`Activated for server ${ctx.serverId}`);
}

export async function deactivate(ctx) {
  const context = createServerContext(ctx);
  context.log(`Deactivated for server ${ctx.serverId}`);
}
