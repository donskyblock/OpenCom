import { encode } from "punycode";
import { command, createServerContext, optionString } from "../../lib/opencom-extension-sdk.js";


async function fetchJson(url) {
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!res.ok) {
        return null;
    }

    return res.json().catch(() => null);
}

async function getSkillLevel(username, skill) {
    const data = await fetchJson(`https://api.donskyblock.xyz/skill/${encodeURIComponent(username)}/${encodeURIComponent(skill)}`);
    if (!data || typeof data.level !== "number") {
        return 0;
    }
    return data.level;
}


async function getSlayerLevel(username, slayer) {
    const data = await fetchJson(`https://api.donskyblock.xyz/${encodeURIComponent(username)}/${encodeURIComponent(slayer)}`);
    if (!data || typeof data.level !== "number") {
        return 0;
    }
    return data.level;
}

async function getDungeonLevel(username) {
    const data = await fetchJson(`https://api.donskyblock.xyz/cata/${encodeURIComponent(username)}`);
    if (!data || typeof data.level !== "number") {
        return 0;
    }
    return data.level;
}

async function getSkyblockLevel(username) {
  const data = await fetchJson(`https://api.donskyblock.xyz/sblvl/${encodeURIComponent(username)}`)
  if (!data || typeof data.level !== 'number') {
    return 0
  }
  return data.level
}

async function getLastLogin(username) {
  const data = await fetchJson(`https://api.donskyblock.xyz/lastlogin/${encodeURIComponent(username)}`)
  if (!data || typeof data.level !== 'number') {
    return 0
  }
  return data.level
}
async function getLatestRng(username) {
  const data = await fetchJson(`https://api.donskyblock.xyz/latest_rng/${encodeURIComponent(username)}`)
  if (!data || !data.success) {
    return (data.error || 'error')
  }
  return data.rng
}

async function getStatus(username) {
  const data = await fetchJson(`https://api.donskyblock.xyz/status/${encodeURIComponent(username)}`) 
  if (!data || !data.success) {
    return (data.error || 'error')
  }
  if (!data.online) {
    return data.last_login
  } else {
    return data.online
  }
}


export const commands = [
  command({
    name: "sb-plugin",
    description: "Simple command to test the extension",
    async execute(ctx) {
      const input = String("Skyblock Utils Plugin is working!");
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
        const slayer = String(ctx.args?.slayer).toLowerCase();
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
        const skill = String(ctx.args?.skill).toLowerCase();
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
  command({
    name: "last_login",
    description: "Get the time a player last logged in!",
    options: [optionString("username", "Minecraft username", true)],
    async execute(ctx) {
        const username = String(ctx.args?.username);
        const timestamp = await getLastLogin(username);
        const input = `${username}'s Last login was ${timestamp}`;
        const me = await ctx.apis.node.get("/v1/me").catch(() => null);
        return {
            content: `${input}`,
            user: me?.user?.username || ctx.userId,
            serverId: ctx.serverId
        };
        }
    }),
  command({
    name: "status",
    description: "find a player's status",
    options: [optionString("username", "Minecraft Username", true)],
    async execute(ctx) {
      const username = String(ctx.args?.username);
      const status = await getStatus(username)
      const me = await ctx.apis.node.get("/v1/me").catch(() => null);
      return {
        content: `${username}'s status is: ${status}`,
        user: me?.user?.username || ctx.userId,
        serverId: ctx.serverId
      };
    }
  }),
  command({
    name: 'latestrng',
    description: 'Find a players latest rng drop',
    options: [optionString("username", "Minecraft Username", true)],
    async execute(ctx) { 
      const username = String(ctx.args?.username);
      const rng_drop = getLatestRng(username);
      const me = await ctx.apis.node.get("/v1/me").catch(() => null)
      return {
        content: `${username}'s latest rng drop was a ${rng_drop}`,
        user: me?.user?.username || ctx.userId,
        serverId: ctx.serverId
      };
    }
  }),
  command({
    name: 'sblvl',
    description: 'Check a players level',
    options: [optionString("username", "Minecraft Username", true)],
    async execute(ctx) {
      const username = String(ctx.args?.username);
      const lvl = getSkyblockLevel(username);
      const me = await ctx.apis.node.get("/v1/me").catch(() => null)
      return {
        content: `${username}'s skyblock level is ${lvl}`,
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
