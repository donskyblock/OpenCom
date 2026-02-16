import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { env } from "../env.js";
import { signMembershipToken } from "../membershipToken.js";
import { parseBody } from "../validation.js";

const OFFICIAL_NODE_BASE_URL = env.OFFICIAL_NODE_BASE_URL;
const OFFICIAL_NODE_SERVER_ID = env.OFFICIAL_NODE_SERVER_ID;

const CreateServer = z.object({
  name: z.string().min(2).max(64),
  baseUrl: z.string().url(),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional()
});

const CreateOfficialServer = z.object({
  name: z.string().min(2).max(64),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional()
});

const UpdateServerProfile = z.object({
  name: z.string().min(2).max(64).optional(),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional()
});

const ReorderServersBody = z.object({
  serverIds: z.array(z.string().min(3)).min(1).max(200)
});

function isValidImageUrl(value: string | null | undefined) {
  if (value == null) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(trimmed);
}

async function getPlatformRole(userId: string): Promise<"user" | "admin" | "owner"> {
  const founder = await q<{ founder_user_id: string | null }>(`SELECT founder_user_id FROM platform_config WHERE id=1`);
  if (founder.length && founder[0].founder_user_id === userId) return "owner";

  const admin = await q<{ user_id: string }>(`SELECT user_id FROM platform_admins WHERE user_id=:userId`, { userId });
  if (admin.length) return "admin";

  return "user";
}

async function canOwnMoreServers(userId: string): Promise<boolean> {
  const owned = await q<{ count: number }>(`SELECT COUNT(*) as count FROM servers WHERE owner_user_id=:userId`, { userId });
  const totalOwned = Number(owned[0]?.count || 0);
  if (totalOwned < 1) return true;

  const boostBadge = await q<{ badge: string }>(
    `SELECT badge FROM user_badges WHERE user_id=:userId AND badge='boost' LIMIT 1`,
    { userId }
  );
  return boostBadge.length > 0;
}

async function ensureDefaultGuildOnServerNode(serverId: string, serverName: string, baseUrl: string, ownerUserId: string, tokenServerId?: string): Promise<string> {
  const platformRole = await getPlatformRole(ownerUserId);
  const ownerRoles = ["owner"];
  if (platformRole === "admin") ownerRoles.push("platform_admin");
  if (platformRole === "owner") ownerRoles.push("platform_admin", "platform_owner");

  // Use tokenServerId when calling the official node so the node accepts the token (it expects server_id === NODE_SERVER_ID)
  const idForToken = tokenServerId ?? serverId;
  const membershipToken = await signMembershipToken(idForToken, ownerUserId, ownerRoles, platformRole, serverId);

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/guilds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${membershipToken}`
    },
    body: JSON.stringify({ name: serverName, createDefaultVoice: true })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`DEFAULT_GUILD_CREATE_FAILED_${response.status}${errorBody ? `:${errorBody}` : ""}`);
  }

  const data = (await response.json()) as { guildId?: string };
  return data.guildId ?? "";
}

export async function serverRoutes(app: FastifyInstance) {
  // Create a server hosted on the platform's official node (no baseUrl needed).
  // Validate all config and quota before writing anything to DB.
  app.post("/v1/servers/official", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = parseBody(CreateOfficialServer, req.body);
    if (!body.logoUrl) return rep.code(400).send({ error: "LOGO_REQUIRED" });
    if (!isValidImageUrl(body.logoUrl)) return rep.code(400).send({ error: "INVALID_LOGO_URL" });
    if (!isValidImageUrl(body.bannerUrl ?? null)) return rep.code(400).send({ error: "INVALID_BANNER_URL" });

    if (!OFFICIAL_NODE_BASE_URL) {
      return rep.code(503).send({ error: "OFFICIAL_SERVER_UNAVAILABLE", message: "Official server node URL is not configured." });
    }
    if (!OFFICIAL_NODE_SERVER_ID) {
      app.log.warn("OFFICIAL_NODE_SERVER_ID is not set; set it to the same value as NODE_SERVER_ID on the official node");
      return rep.code(503).send({
        error: "OFFICIAL_SERVER_NOT_CONFIGURED",
        message: "Set OFFICIAL_NODE_SERVER_ID on the API server to the same value as NODE_SERVER_ID on your node."
      });
    }

    const platformRole = await getPlatformRole(userId);
    if (platformRole === "user") {
      const allowed = await canOwnMoreServers(userId);
      if (!allowed) {
        return rep.code(403).send({ error: "SERVER_LIMIT_REACHED" });
      }
    }

    const id = ulidLike();
    try {
      await q(`INSERT INTO servers (id,name,base_url,owner_user_id) VALUES (:id,:name,:baseUrl,:userId)`,
        { id, name: body.name, baseUrl: OFFICIAL_NODE_BASE_URL, userId }
      );
      await q(
        `UPDATE servers
         SET logo_url=:logoUrl, banner_url=:bannerUrl
         WHERE id=:id`,
        { id, logoUrl: body.logoUrl ?? null, bannerUrl: body.bannerUrl ?? null }
      );
      await q(`INSERT INTO memberships (server_id,user_id,roles) VALUES (:id,:userId,:roles)`,
        { id, userId, roles: JSON.stringify(["owner"]) }
      );
      const defaultGuildId = await ensureDefaultGuildOnServerNode(id, body.name, OFFICIAL_NODE_BASE_URL, userId, OFFICIAL_NODE_SERVER_ID);
      if (defaultGuildId) {
        await q(`UPDATE servers SET default_guild_id = :defaultGuildId WHERE id = :id`, { id, defaultGuildId });
      }
    } catch (error: any) {
      if (error.message?.startsWith("DEFAULT_GUILD_CREATE_FAILED_")) {
        app.log.error({ err: error, serverId: id }, "Failed to create default guild on official node");
        await q(`DELETE FROM memberships WHERE server_id=:id`, { id }).catch(() => {});
        await q(`DELETE FROM servers WHERE id=:id`, { id }).catch(() => {});
        return rep.code(502).send({ error: "DEFAULT_GUILD_CREATE_FAILED" });
      }
      throw error;
    }

    return rep.send({ serverId: id });
  });

  app.post("/v1/servers", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = parseBody(CreateServer, req.body);
    if (!body.logoUrl) return rep.code(400).send({ error: "LOGO_REQUIRED" });
    if (!isValidImageUrl(body.logoUrl)) return rep.code(400).send({ error: "INVALID_LOGO_URL" });
    if (!isValidImageUrl(body.bannerUrl ?? null)) return rep.code(400).send({ error: "INVALID_BANNER_URL" });

    const platformRole = await getPlatformRole(userId);
    if (platformRole === "user") {
      const allowed = await canOwnMoreServers(userId);
      if (!allowed) return rep.code(403).send({ error: "SERVER_LIMIT_REACHED" });
    }

    const id = ulidLike();
    await q(
      `INSERT INTO servers (id,name,base_url,owner_user_id,logo_url,banner_url)
       VALUES (:id,:name,:baseUrl,:userId,:logoUrl,:bannerUrl)`,
      {
        id,
        name: body.name,
        baseUrl: body.baseUrl,
        userId,
        logoUrl: body.logoUrl ?? null,
        bannerUrl: body.bannerUrl ?? null
      }
    );
    await q(`INSERT INTO memberships (server_id,user_id,roles) VALUES (:id,:userId,:roles)`,
      { id, userId, roles: JSON.stringify(["owner"]) }
    );

    try {
      const defaultGuildId = await ensureDefaultGuildOnServerNode(id, body.name, body.baseUrl, userId);
      if (defaultGuildId) {
        await q(`UPDATE servers SET default_guild_id = :defaultGuildId WHERE id = :id`, { id, defaultGuildId });
      }
    } catch (error: any) {
      app.log.error({ err: error, serverId: id, baseUrl: body.baseUrl }, "Failed to create default guild on server node");
      return rep.code(502).send({ error: "DEFAULT_GUILD_CREATE_FAILED" });
    }

    return rep.send({ serverId: id });
  });

  // Only return servers this user is a member of.
  app.get("/v1/servers", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;
    const platformRole = await getPlatformRole(userId);
    const hasBoost = await q<{ badge: string }>(
      `SELECT badge FROM user_badges WHERE user_id=:userId AND badge='boost' LIMIT 1`,
      { userId }
    );

    const rows = await q<{ id: string; name: string; base_url: string; logo_url: string | null; banner_url: string | null; default_guild_id: string | null; owner_user_id: string; roles: string; display_order: number | null }>(
      `SELECT s.id, s.name, s.base_url, s.logo_url, s.banner_url, s.default_guild_id, s.owner_user_id, m.roles, m.display_order
       FROM memberships m
       JOIN servers s ON s.id = m.server_id
       WHERE m.user_id = :userId
       ORDER BY COALESCE(m.display_order, 2147483647) ASC, s.created_at DESC`,
      { userId }
    );

    const servers = await Promise.all(rows.map(async (r) => {
      let membershipRoles = Array.isArray(r.roles) ? r.roles : JSON.parse(r.roles || "[]");

      // If this server has only one member, that member is the owner (ensure DB is consistent)
      const memberCount = await q<{ c: number }>(
        `SELECT COUNT(*) as c FROM memberships WHERE server_id = :serverId`,
        { serverId: r.id }
      );
      const count = Number(memberCount[0]?.c ?? 0);
      let isServerOwner = r.owner_user_id === userId;
      if (count === 1) {
        await q(`UPDATE servers SET owner_user_id = :userId WHERE id = :serverId`, { userId, serverId: r.id });
        isServerOwner = true;
        if (!membershipRoles.includes("owner")) membershipRoles = [...membershipRoles, "owner"];
        await q(`UPDATE memberships SET roles = :roles WHERE server_id = :serverId AND user_id = :userId`, {
          serverId: r.id,
          userId,
          roles: JSON.stringify(membershipRoles)
        });
      }

      // Only include "owner" in returned roles if user is the actual server owner (or platform staff)
      const isPlatformStaff = platformRole === "admin" || platformRole === "owner";
      if (!isServerOwner && !isPlatformStaff && membershipRoles.includes("owner")) {
        membershipRoles = membershipRoles.filter((role: string) => role !== "owner");
      }

      if (platformRole === "admin" && !membershipRoles.includes("platform_admin")) membershipRoles.push("platform_admin");
      if (platformRole === "owner") {
        if (!membershipRoles.includes("platform_admin")) membershipRoles.push("platform_admin");
        if (!membershipRoles.includes("platform_owner")) membershipRoles.push("platform_owner");
      }
      if (hasBoost.length > 0 && !membershipRoles.includes("boost")) membershipRoles.push("boost");

      // For official node, token must use OFFICIAL_NODE_SERVER_ID so the node accepts it
      const idForToken = (OFFICIAL_NODE_BASE_URL && OFFICIAL_NODE_SERVER_ID && r.base_url === OFFICIAL_NODE_BASE_URL)
        ? OFFICIAL_NODE_SERVER_ID
        : r.id;
      const membershipToken = await signMembershipToken(idForToken, userId, membershipRoles, platformRole, r.id);

      return {
        id: r.id,
        name: r.name,
        baseUrl: r.base_url,
        logoUrl: r.logo_url ?? null,
        bannerUrl: r.banner_url ?? null,
        defaultGuildId: r.default_guild_id ?? undefined,
        roles: membershipRoles,
        membershipToken
      };
    }));

    return { servers };
  });

  // Leave server (remove membership; client should also call node POST /v1/guilds/:guildId/leave if it has defaultGuildId)
  app.post("/v1/servers/:serverId/leave", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId } = z.object({ serverId: z.string().min(3) }).parse(req.params);

    const member = await q<{ user_id: string }>(
      `SELECT user_id FROM memberships WHERE server_id=:serverId AND user_id=:userId`,
      { serverId, userId }
    );
    if (!member.length) return rep.code(403).send({ error: "NOT_A_MEMBER" });

    const server = await q<{ id: string }>(`SELECT id FROM servers WHERE id=:serverId`, { serverId });
    if (!server.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });

    await q(`DELETE FROM memberships WHERE server_id=:serverId AND user_id=:userId`, { serverId, userId });

    return rep.send({ ok: true });
  });

  app.patch("/v1/servers/:serverId/profile", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId } = z.object({ serverId: z.string().min(3) }).parse(req.params);
    const body = parseBody(UpdateServerProfile, req.body);
    if (body.logoUrl === null) return rep.code(400).send({ error: "LOGO_REQUIRED" });
    if (body.logoUrl !== undefined && body.logoUrl !== null && !isValidImageUrl(body.logoUrl)) {
      return rep.code(400).send({ error: "INVALID_LOGO_URL" });
    }
    if (body.bannerUrl !== undefined && body.bannerUrl !== null && !isValidImageUrl(body.bannerUrl)) {
      return rep.code(400).send({ error: "INVALID_BANNER_URL" });
    }

    const server = await q<{ owner_user_id: string }>(`SELECT owner_user_id FROM servers WHERE id=:serverId`, { serverId });
    if (!server.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });

    const platformRole = await getPlatformRole(userId);
    const isOwnerOrStaff = server[0].owner_user_id === userId || platformRole === "admin" || platformRole === "owner";
    if (!isOwnerOrStaff) return rep.code(403).send({ error: "NOT_OWNER" });

    await q(
      `UPDATE servers
       SET
         name = COALESCE(:name, name),
         logo_url = CASE WHEN :logoSet=1 THEN :logoUrl ELSE logo_url END,
         banner_url = CASE WHEN :bannerSet=1 THEN :bannerUrl ELSE banner_url END
       WHERE id=:serverId`,
      {
        serverId,
        name: body.name ?? null,
        logoSet: body.logoUrl !== undefined ? 1 : 0,
        logoUrl: body.logoUrl ?? null,
        bannerSet: body.bannerUrl !== undefined ? 1 : 0,
        bannerUrl: body.bannerUrl ?? null
      }
    );

    return rep.send({ ok: true });
  });

  app.post("/v1/servers/reorder", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = parseBody(ReorderServersBody, req.body);

    const memberships = await q<{ server_id: string }>(
      `SELECT server_id FROM memberships WHERE user_id=:userId`,
      { userId }
    );
    const memberSet = new Set(memberships.map((row) => row.server_id));
    for (const serverId of body.serverIds) {
      if (!memberSet.has(serverId)) return rep.code(403).send({ error: "NOT_A_MEMBER", serverId });
    }

    for (let i = 0; i < body.serverIds.length; i++) {
      await q(
        `UPDATE memberships
         SET display_order=:displayOrder
         WHERE user_id=:userId AND server_id=:serverId`,
        { userId, serverId: body.serverIds[i], displayOrder: i + 1 }
      );
    }
    return rep.send({ ok: true, count: body.serverIds.length });
  });

  app.post("/v1/servers/:serverId/membership-token", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId } = z.object({ serverId: z.string().min(3) }).parse(req.params);

    const membership = await q<{ roles: string }>(
      `SELECT roles FROM memberships WHERE server_id=:serverId AND user_id=:userId LIMIT 1`,
      { serverId, userId }
    );
    if (!membership.length) return rep.code(403).send({ error: "NOT_A_MEMBER" });

    const server = await q<{ id: string; base_url: string; owner_user_id: string }>(
      `SELECT id, base_url, owner_user_id FROM servers WHERE id=:serverId LIMIT 1`,
      { serverId }
    );
    if (!server.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });

    let roles: string[] = JSON.parse(membership[0].roles || "[]");
    const hasBoost = await q<{ badge: string }>(
      `SELECT badge FROM user_badges WHERE user_id=:userId AND badge='boost' LIMIT 1`,
      { userId }
    );
    const platformRole = await getPlatformRole(userId);
    const isPlatformStaff = platformRole === "admin" || platformRole === "owner";
    const isServerOwner = server[0].owner_user_id === userId;
    if (!isServerOwner && !isPlatformStaff && roles.includes("owner")) {
      roles = roles.filter((role) => role !== "owner");
    }
    if (platformRole === "admin" && !roles.includes("platform_admin")) roles.push("platform_admin");
    if (platformRole === "owner") {
      if (!roles.includes("platform_admin")) roles.push("platform_admin");
      if (!roles.includes("platform_owner")) roles.push("platform_owner");
    }
    if (hasBoost.length > 0 && !roles.includes("boost")) roles.push("boost");

    const idForToken = (OFFICIAL_NODE_BASE_URL && OFFICIAL_NODE_SERVER_ID && server[0].base_url === OFFICIAL_NODE_BASE_URL)
      ? OFFICIAL_NODE_SERVER_ID
      : serverId;
    const membershipToken = await signMembershipToken(idForToken, userId, roles, platformRole, serverId);

    return rep.send({ serverId, membershipToken, roles });
  });

  // Delete server (owner only); removes server and all memberships
  app.delete("/v1/servers/:serverId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId } = z.object({ serverId: z.string().min(3) }).parse(req.params);

    const server = await q<{ owner_user_id: string }>(`SELECT owner_user_id FROM servers WHERE id=:serverId`, { serverId });
    if (!server.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });
    if (server[0].owner_user_id !== userId) return rep.code(403).send({ error: "NOT_OWNER" });

    await q(`DELETE FROM memberships WHERE server_id=:serverId`, { serverId });
    await q(`DELETE FROM servers WHERE id=:serverId`, { serverId });

    return rep.send({ ok: true });
  });
}
