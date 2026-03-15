import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { env } from "../env.js";
import { reconcileBoostBadge } from "../boost.js";
import { signMembershipToken } from "../membershipToken.js";
import { parseBody } from "../validation.js";

const SetServerGlobalEmotes = z.object({
  enabled: z.boolean()
});

type ServerRow = {
  id: string;
  name: string;
  base_url: string;
  owner_user_id: string;
  global_emotes_enabled: number;
};

type NodeGuild = {
  id: string;
  name: string;
};

type NodeEmote = {
  id: string;
  name: string;
  imageUrl?: string;
  image_url?: string;
  guildId?: string;
  guild_id?: string;
};

type CatalogEmote = {
  id: string;
  name: string;
  imageUrl: string;
  serverId: string;
  serverName: string;
  guildId: string;
  guildName: string;
  canUse: boolean;
};

function normalizeHttpBaseUrl(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "localhost"
    || normalized === "::1"
    || normalized === "0:0:0:0:0:0:0:1"
    || normalized === "0.0.0.0"
    || normalized.startsWith("127.");
}

function isLoopbackBaseUrl(value: string | null | undefined): boolean {
  try {
    const parsed = new URL(String(value || "").trim());
    return isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveNodeBaseUrl(baseUrl: string): string {
  const normalized = normalizeHttpBaseUrl(baseUrl);
  if (!normalized) return "";
  const officialBaseUrl = normalizeHttpBaseUrl(env.OFFICIAL_NODE_BASE_URL || "");
  if (officialBaseUrl && isLoopbackBaseUrl(normalized)) return officialBaseUrl;
  return normalized;
}

function resolveNodeServerId(serverId: string, rawBaseUrl: string) {
  const officialBaseUrl = normalizeHttpBaseUrl(env.OFFICIAL_NODE_BASE_URL || "");
  const effectiveBaseUrl = resolveNodeBaseUrl(rawBaseUrl);
  if (
    env.OFFICIAL_NODE_SERVER_ID
    && officialBaseUrl
    && (
      effectiveBaseUrl === officialBaseUrl
      || isLoopbackBaseUrl(rawBaseUrl)
    )
  ) {
    return env.OFFICIAL_NODE_SERVER_ID;
  }
  return serverId;
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`NODE_HTTP_${response.status}${body ? `:${body.slice(0, 300)}` : ""}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchServerGlobalEmotes(server: ServerRow, canUse: boolean): Promise<CatalogEmote[]> {
  const baseUrl = resolveNodeBaseUrl(server.base_url);
  if (!baseUrl) return [];

  const nodeServerId = resolveNodeServerId(server.id, server.base_url);
  const membershipToken = await signMembershipToken(
    nodeServerId,
    server.owner_user_id,
    ["owner"],
    "user",
    server.id
  );

  const guilds = await fetchJson<NodeGuild[]>(
    `${baseUrl}/v1/guilds`,
    {
      headers: {
        Authorization: `Bearer ${membershipToken}`,
      },
    }
  );

  const guildRows = Array.isArray(guilds) ? guilds : [];
  if (!guildRows.length) return [];

  const emoteResults = await Promise.allSettled(guildRows.map(async (guild) => {
    const data = await fetchJson<{ emotes?: NodeEmote[] }>(
      `${baseUrl}/v1/guilds/${encodeURIComponent(guild.id)}/emotes`,
      {
        headers: {
          Authorization: `Bearer ${membershipToken}`,
        },
      }
    );

    return (Array.isArray(data?.emotes) ? data.emotes : []).map((emote) => ({
      id: String(emote?.id || `${server.id}:${guild.id}:${emote?.name || "emote"}`),
      name: String(emote?.name || "").trim().toLowerCase(),
      imageUrl: String(emote?.imageUrl || emote?.image_url || "").trim(),
      serverId: server.id,
      serverName: server.name,
      guildId: String(emote?.guildId || emote?.guild_id || guild.id || ""),
      guildName: String(guild?.name || ""),
      canUse,
    }));
  }));

  const catalog: CatalogEmote[] = [];
  for (const result of emoteResults) {
    if (result.status !== "fulfilled") continue;
    for (const emote of result.value) {
      if (!emote.name || !emote.imageUrl) continue;
      catalog.push(emote);
    }
  }
  return catalog;
}

export async function emoteRoutes(app: FastifyInstance) {
  app.get("/v1/emotes/catalog", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;
    const [membershipRows, serverRows] = await Promise.all([
      q<{ server_id: string }>(
        `SELECT server_id
         FROM memberships
         WHERE user_id=:userId`,
        { userId }
      ),
      q<ServerRow>(
        `SELECT id,name,base_url,owner_user_id,global_emotes_enabled
         FROM servers
         WHERE global_emotes_enabled=1
         ORDER BY created_at ASC, id ASC`
      )
    ]);

    if (!serverRows.length) return { emotes: [] };

    const memberServerIds = new Set(
      membershipRows.map((row) => String(row.server_id || "").trim()).filter(Boolean)
    );
    const ownerIds = Array.from(
      new Set(
        serverRows
          .map((row) => String(row.owner_user_id || "").trim())
          .filter(Boolean)
      )
    );

    const ownerBoostById = new Map<string, boolean>();
    await Promise.all(ownerIds.map(async (ownerId) => {
      const entitlement = await reconcileBoostBadge(ownerId);
      ownerBoostById.set(ownerId, entitlement.active);
    }));

    const catalogs = await Promise.all(serverRows.map(async (server) => {
      if (!ownerBoostById.get(server.owner_user_id)) return [];
      try {
        return await fetchServerGlobalEmotes(server, memberServerIds.has(server.id));
      } catch (error) {
        app.log.warn(
          { err: error, serverId: server.id },
          "global-emotes: failed to fetch emotes from server node"
        );
        return [];
      }
    }));

    const dedupedByName = new Map<string, CatalogEmote>();
    const sorted = catalogs
      .flat()
      .sort((left, right) =>
        left.name.localeCompare(right.name)
        || left.serverId.localeCompare(right.serverId)
        || left.guildId.localeCompare(right.guildId)
        || left.id.localeCompare(right.id)
      );

    for (const emote of sorted) {
      if (!emote.name || dedupedByName.has(emote.name)) continue;
      dedupedByName.set(emote.name, emote);
    }

    return {
      emotes: Array.from(dedupedByName.values())
    };
  });

  app.put("/v1/servers/:serverId/global-emotes", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId } = z.object({ serverId: z.string().min(3) }).parse(req.params);
    const body = parseBody(SetServerGlobalEmotes, req.body);

    const rows = await q<{ owner_user_id: string }>(
      `SELECT owner_user_id
       FROM servers
       WHERE id=:serverId
       LIMIT 1`,
      { serverId }
    );
    if (!rows.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });
    if (rows[0].owner_user_id !== userId) return rep.code(403).send({ error: "NOT_OWNER" });

    if (body.enabled) {
      const entitlement = await reconcileBoostBadge(userId);
      if (!entitlement.active) return rep.code(403).send({ error: "BOOST_REQUIRED" });
    }

    await q(
      `UPDATE servers
       SET global_emotes_enabled=:enabled
       WHERE id=:serverId`,
      {
        serverId,
        enabled: body.enabled ? 1 : 0
      }
    );

    return {
      ok: true,
      enabled: body.enabled
    };
  });
}
