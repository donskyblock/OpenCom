import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { DEFAULT_EVERYONE_PERMS } from "../permissions/defaults.js";
import { Perm } from "../permissions/bits.js";
import { requireGuildMember } from "../auth/requireGuildMember.js";
import { requireManageChannels } from "../permissions/hierarchy.js";

export async function guildRoutes(app: FastifyInstance) {
  // List only guilds the authenticated user is a member of (or owns) in this core server tenant.
  app.get("/v1/guilds", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.auth.userId as string;
    const coreServerId = req.auth.coreServerId as string;

    // Backward compatibility: claim legacy owner guilds with unset tenant.
    await q(
      `UPDATE guilds
       SET server_id = :coreServerId
       WHERE owner_user_id = :userId AND (server_id = '' OR server_id IS NULL)`,
      { userId, coreServerId }
    );

    const guilds = await q<{ id: string; name: string; owner_user_id: string; created_at: string }>(
      `SELECT g.id, g.name, g.owner_user_id, g.created_at
       FROM guilds g
       LEFT JOIN guild_members gm ON gm.guild_id = g.id AND gm.user_id = :userId
       WHERE g.server_id = :coreServerId
         AND (g.owner_user_id = :userId OR gm.user_id = :userId)
         AND g.is_system = 0
       ORDER BY g.created_at DESC`,
      { userId, coreServerId }
    );
    return rep.send(guilds);
  });

  // Create guild (auth required)
  app.post("/v1/guilds", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const ownerId = req.auth.userId as string;
    const coreServerId = req.auth.coreServerId as string;
    const actorRoles = req.auth.roles || [];

    if (!actorRoles.includes("owner") && !actorRoles.includes("platform_admin")) {
      return rep.code(403).send({ error: "MISSING_PERMS" });
    }

    const body = z.object({
      name: z.string().min(1).max(64),
      createDefaultVoice: z.boolean().optional().default(true)
    }).parse(req.body);

    const guildId = ulidLike();
    await q(
      `INSERT INTO guilds (id,server_id,name,owner_user_id) VALUES (:id,:serverId,:name,:ownerId)`,
      { id: guildId, serverId: coreServerId, name: body.name, ownerId }
    );

    // Ensure owner is a member on this node
    await q(
      `INSERT INTO guild_members (guild_id,user_id) VALUES (:guildId,:ownerId)
       ON DUPLICATE KEY UPDATE guild_id=guild_id`,
      { guildId, ownerId }
    );

    // Create @everyone role (Discord-style)
    const everyoneRoleId = ulidLike();
    await q(
      `INSERT INTO roles (id,guild_id,name,color,position,permissions,is_everyone)
       VALUES (:id,:guildId,:name,NULL,:position,:permissions,1)`,
      {
        id: everyoneRoleId,
        guildId,
        name: "@everyone",
        position: 0,
        permissions: DEFAULT_EVERYONE_PERMS.toString()
      }
    );

    // Create an explicit owner role with administrator permission and assign it to creator.
    const ownerRoleId = ulidLike();
    await q(
      `INSERT INTO roles (id,guild_id,name,color,position,permissions,is_everyone)
       VALUES (:id,:guildId,:name,NULL,:position,:permissions,0)`,
      {
        id: ownerRoleId,
        guildId,
        name: "owner",
        position: 1,
        permissions: Perm.ADMINISTRATOR.toString()
      }
    );

    await q(
      `INSERT INTO member_roles (guild_id,user_id,role_id)
       VALUES (:guildId,:ownerId,:ownerRoleId)
       ON DUPLICATE KEY UPDATE role_id=role_id`,
      { guildId, ownerId, ownerRoleId }
    );

    // Create default text channel: general
    const generalTextId = ulidLike();
    await q(
      `INSERT INTO channels (id,guild_id,name,type,position,parent_id)
       VALUES (:id,:guildId,:name,'text',:position,NULL)`,
      { id: generalTextId, guildId, name: "general", position: 0 }
    );

    // Optional default voice channel
    let generalVoiceId: string | null = null;
    if (body.createDefaultVoice) {
      generalVoiceId = ulidLike();
      await q(
        `INSERT INTO channels (id,guild_id,name,type,position,parent_id)
         VALUES (:id,:guildId,:name,'voice',:position,NULL)`,
        { id: generalVoiceId, guildId, name: "General", position: 1 }
      );
    }

    return rep.send({
      guildId,
      everyoneRoleId,
      ownerRoleId,
      defaultChannels: {
        text: generalTextId,
        voice: generalVoiceId
      }
    });
  });

  app.patch("/v1/guilds/:guildId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const userId = req.auth.userId as string;
    const body = z.object({
      name: z.string().trim().min(1).max(64)
    }).parse(req.body || {});

    try {
      await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId);
    } catch {
      return rep.code(403).send({ error: "NOT_GUILD_MEMBER" });
    }

    const guildRows = await q<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM guilds WHERE id=:guildId LIMIT 1`,
      { guildId }
    );
    if (!guildRows.length) return rep.code(404).send({ error: "GUILD_NOT_FOUND" });

    const isGuildOwner = guildRows[0].owner_user_id === userId;
    if (!isGuildOwner) {
      const anyChannel = await q<{ id: string }>(
        `SELECT id FROM channels WHERE guild_id=:guildId ORDER BY created_at ASC LIMIT 1`,
        { guildId }
      );
      if (!anyChannel.length) return rep.code(400).send({ error: "GUILD_HAS_NO_CHANNELS" });
      try {
        await requireManageChannels({
          guildId,
          channelIdForPerms: anyChannel[0].id,
          actorId: userId,
          actorRoles: req.auth.roles || []
        });
      } catch {
        return rep.code(403).send({ error: "MISSING_PERMS" });
      }
    }

    await q(
      `UPDATE guilds
       SET name=:name
       WHERE id=:guildId`,
      { guildId, name: body.name }
    );

    return rep.send({ ok: true, guildId, name: body.name });
  });

  app.delete("/v1/guilds/:guildId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const userId = req.auth.userId as string;

    try {
      await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId);
    } catch {
      return rep.code(403).send({ error: "NOT_GUILD_MEMBER" });
    }

    const guildRows = await q<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM guilds WHERE id=:guildId LIMIT 1`,
      { guildId }
    );
    if (!guildRows.length) return rep.code(404).send({ error: "GUILD_NOT_FOUND" });

    const isGuildOwner = guildRows[0].owner_user_id === userId;
    const isServerOwner = Array.isArray(req.auth.roles) && req.auth.roles.includes("owner");
    const isPlatformStaff = Array.isArray(req.auth.roles)
      && (req.auth.roles.includes("platform_admin") || req.auth.roles.includes("platform_owner"));

    if (!isGuildOwner && !isServerOwner && !isPlatformStaff) {
      return rep.code(403).send({ error: "MISSING_PERMS" });
    }

    await q(`DELETE FROM guilds WHERE id=:guildId`, { guildId });
    return rep.send({ ok: true, guildId });
  });
}
