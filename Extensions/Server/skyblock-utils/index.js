import { command, createServerContext, optionString } from "../../lib/opencom-extension-sdk.js";


async function getSkillLevel(username, skill) {
    res = await fetch(`https://api.donskyblock.xyz/skill/${username}/${skill}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await res.json();
    if (data.success != true){
        return 0;
    }
    const skill_level = data.level;
    return skill_level;
}


async function getSlayerLevel(username, slayer) {
    res = await fetch(`https://api.donskyblock.xyz/${username}/${slayer}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await res.json();
    if (data.success != true){
        return 0;
    }
    const slayer_level = data.level;
    return slayer_level;
}

async function getDungeonLevel(username) {
    res = await fetch(`https://api.donskyblock.xyz/cata/${username}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await res.json();
    if (data.success != true){
        return 0;
    }
    const slayer_level = data.level;
    return slayer_level;
}


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
  }),
  command({
    name: "slayer",
    description: "Simple command to test the extension",
    options: [optionString("username", "Minecraft username", true), optionString("slayer", "Which slayer boss (zombie, spider, wolf)", true)],
    async execute(ctx) {
        const username = String(ctx.args?.username);
        const slayer = String(ctx.args?.slayer);
        const slayerLevel = await getSlayerLevel(username, slayer);
        const input = `${username}'s ${slayer} slayer level is ${slayerLevel}`;
        const me = await ctx.apis.node.get("/v1/me").catch(() => null);
      return {
        content: `${input}`,
        user: me?.user?.username || ctx.userId,
        serverId: ctx.serverId
      };
    }
  }),
  command({
    name: "skill",
    description: "Get a player's skill level",
    options: [optionString("username", "Minecraft username", true), optionString("skill", "Which skill", true)],
    async execute(ctx) {
        const username = String(ctx.args?.username);
        const skill = String(ctx.args?.slayer);
        const skillLevel = await getSkillLevel(username, skill);
        const input = `${username}'s ${skill} level is ${skillLevel}`;
        const me = await ctx.apis.node.get("/v1/me").catch(() => null);
        return {
            content: `${input}`,
            user: me?.user?.username || ctx.userId,
            serverId: ctx.serverId
        };
        }
    }),
  command({
    name: "dungeon",
    description: "Get a player's catacombs level",
    options: [optionString("username", "Minecraft username", true)],
    async execute(ctx) {
        const username = String(ctx.args?.username);
        const cata = await getDungeonLevel(username);
        const input = `${username} is catacombs ${cata}`;
        const me = await ctx.apis.node.get("/v1/me").catch(() => null);
        return {
            content: `${input}`,
            user: me?.user?.username || ctx.userId,
            serverId: ctx.serverId
        };
        }
    }),
];

export async function activate(ctx) {
  const context = createServerContext(ctx);
  context.log(`Activated for server ${ctx.serverId}`);
}

export async function deactivate(ctx) {
  const context = createServerContext(ctx);
  context.log(`Deactivated for server ${ctx.serverId}`);
}
