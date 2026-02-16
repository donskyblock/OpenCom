import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { requireGuildMember } from "../auth/requireGuildMember.js";
import { canEditRole, isGuildOwner, requireManageRoles, rolePosition } from "../permissions/hierarchy.js";
import { resolveChannelPermissions } from "../permissions/resolve.js";
import { Perm, has } from "../permissions/bits.js";

export async function memberRoutes(
  app: FastifyInstance,
  broadcastGuild: (guildId: string, t: string, d: any) => void
) {
  async function requireModerationPermission(
    guildId: string,
    actorId: string,
    actorRoles: string[],
    requiredPerm: bigint
  ) {
    const anyChannel = await q<{ id: string }>(
      `SELECT id FROM channels WHERE guild_id=:guildId ORDER BY created_at ASC LIMIT 1`,
      { guildId }
    );
    if (!anyChannel.length) return false;
    const perms = await resolveChannelPermissions({
      guildId,
      channelId: anyChannel[0].id,
      userId: actorId,
      roles: actorRoles
    });
    return has(perms, requiredPerm);
  }

  app.put("/v1/guilds/:guildId/members/:memberId/roles/:roleId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId, memberId, roleId } = z.object({
      guildId: z.string().min(3),
      memberId: z.string().min(3),
      roleId: z.string().min(3)
    }).parse(req.params);

    const userId = req.auth.userId as string;

    try { await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId); } catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const anyChannel = await q<{ id: string }>(`SELECT id FROM channels WHERE guild_id=:guildId ORDER BY created_at ASC LIMIT 1`, { guildId });
    if (!anyChannel.length) return rep.code(400).send({ error: "GUILD_HAS_NO_CHANNELS" });

    const guildOwner = await isGuildOwner(guildId, userId);
    if (!guildOwner) {
      try { await requireManageRoles({ guildId, channelIdForPerms: anyChannel[0].id, actorId: userId, actorRoles: req.auth.roles || [] }); }
      catch { return rep.code(403).send({ error: "MISSING_PERMS" }); }
    }

    const rp = await rolePosition(roleId).catch(() => null);
    if (!rp || rp.guildId !== guildId) return rep.code(404).send({ error: "ROLE_NOT_FOUND" });
    if (rp.isEveryone) return rep.code(400).send({ error: "CANNOT_ASSIGN_EVERYONE" });

    if (!(await canEditRole(guildId, userId, rp.position))) return rep.code(403).send({ error: "ROLE_HIERARCHY" });

    await q(
      `INSERT INTO guild_members (guild_id,user_id) VALUES (:guildId,:memberId)
       ON DUPLICATE KEY UPDATE guild_id=guild_id`,
      { guildId, memberId }
    );

    await q(
      `INSERT INTO member_roles (guild_id,user_id,role_id)
       VALUES (:guildId,:memberId,:roleId)
       ON DUPLICATE KEY UPDATE role_id=role_id`,
      { guildId, memberId, roleId }
    );

    broadcastGuild(guildId, "GUILD_MEMBER_UPDATE", { userId: memberId, addedRoleId: roleId });
    return rep.send({ ok: true });
  });

  app.delete("/v1/guilds/:guildId/members/:memberId/roles/:roleId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId, memberId, roleId } = z.object({
      guildId: z.string().min(3),
      memberId: z.string().min(3),
      roleId: z.string().min(3)
    }).parse(req.params);

    const userId = req.auth.userId as string;

    try { await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId); } catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const anyChannel = await q<{ id: string }>(`SELECT id FROM channels WHERE guild_id=:guildId ORDER BY created_at ASC LIMIT 1`, { guildId });
    if (!anyChannel.length) return rep.code(400).send({ error: "GUILD_HAS_NO_CHANNELS" });

    const guildOwner = await isGuildOwner(guildId, userId);
    if (!guildOwner) {
      try { await requireManageRoles({ guildId, channelIdForPerms: anyChannel[0].id, actorId: userId, actorRoles: req.auth.roles || [] }); }
      catch { return rep.code(403).send({ error: "MISSING_PERMS" }); }
    }

    const rp = await rolePosition(roleId).catch(() => null);
    if (!rp || rp.guildId !== guildId) return rep.code(404).send({ error: "ROLE_NOT_FOUND" });
    if (rp.isEveryone) return rep.code(400).send({ error: "CANNOT_REMOVE_EVERYONE" });

    if (!(await canEditRole(guildId, userId, rp.position))) return rep.code(403).send({ error: "ROLE_HIERARCHY" });

    await q(
      `DELETE FROM member_roles WHERE guild_id=:guildId AND user_id=:memberId AND role_id=:roleId`,
      { guildId, memberId, roleId }
    );

    broadcastGuild(guildId, "GUILD_MEMBER_UPDATE", { userId: memberId, removedRoleId: roleId });
    return rep.send({ ok: true });
  });

  app.post("/v1/guilds/:guildId/members/:memberId/kick", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId, memberId } = z.object({
      guildId: z.string().min(3),
      memberId: z.string().min(3)
    }).parse(req.params);
    const actorId = req.auth.userId as string;

    try { await requireGuildMember(guildId, actorId, req.auth.roles, req.auth.coreServerId); }
    catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const actorCanKick = await requireModerationPermission(guildId, actorId, req.auth.roles || [], Perm.KICK_MEMBERS);
    if (!actorCanKick) return rep.code(403).send({ error: "MISSING_PERMS" });

    const guild = await q<{ owner_user_id: string }>(`SELECT owner_user_id FROM guilds WHERE id=:guildId`, { guildId });
    if (!guild.length) return rep.code(404).send({ error: "GUILD_NOT_FOUND" });
    if (memberId === guild[0].owner_user_id) return rep.code(403).send({ error: "CANNOT_KICK_OWNER" });

    const member = await q<{ user_id: string }>(
      `SELECT user_id FROM guild_members WHERE guild_id=:guildId AND user_id=:memberId`,
      { guildId, memberId }
    );
    if (!member.length) return rep.code(404).send({ error: "MEMBER_NOT_FOUND" });

    await q(`DELETE FROM member_roles WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });
    await q(`DELETE FROM voice_states WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });
    await q(`DELETE FROM guild_members WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });

    broadcastGuild(guildId, "GUILD_MEMBER_KICK", { userId: memberId, actorId });
    return rep.send({ ok: true, kickedUserId: memberId });
  });

  app.post("/v1/guilds/:guildId/members/:memberId/ban", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId, memberId } = z.object({
      guildId: z.string().min(3),
      memberId: z.string().min(3)
    }).parse(req.params);
    const body = z.object({ reason: z.string().max(256).optional() }).parse(req.body || {});
    const actorId = req.auth.userId as string;

    try { await requireGuildMember(guildId, actorId, req.auth.roles, req.auth.coreServerId); }
    catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const actorCanBan = await requireModerationPermission(guildId, actorId, req.auth.roles || [], Perm.BAN_MEMBERS);
    if (!actorCanBan) return rep.code(403).send({ error: "MISSING_PERMS" });

    const guild = await q<{ owner_user_id: string }>(`SELECT owner_user_id FROM guilds WHERE id=:guildId`, { guildId });
    if (!guild.length) return rep.code(404).send({ error: "GUILD_NOT_FOUND" });
    if (memberId === guild[0].owner_user_id) return rep.code(403).send({ error: "CANNOT_BAN_OWNER" });

    await q(
      `INSERT INTO guild_bans (guild_id, user_id, reason, banned_by)
       VALUES (:guildId, :memberId, :reason, :actorId)
       ON DUPLICATE KEY UPDATE reason=:reason, banned_by=:actorId, created_at=NOW()`,
      { guildId, memberId, reason: body.reason ?? null, actorId }
    );

    await q(`DELETE FROM member_roles WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });
    await q(`DELETE FROM voice_states WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });
    await q(`DELETE FROM guild_members WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });

    broadcastGuild(guildId, "GUILD_MEMBER_BAN", { userId: memberId, actorId, reason: body.reason ?? null });
    return rep.send({ ok: true, bannedUserId: memberId });
  });

  app.delete("/v1/guilds/:guildId/bans/:memberId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId, memberId } = z.object({
      guildId: z.string().min(3),
      memberId: z.string().min(3)
    }).parse(req.params);
    const actorId = req.auth.userId as string;

    try { await requireGuildMember(guildId, actorId, req.auth.roles, req.auth.coreServerId); }
    catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const actorCanBan = await requireModerationPermission(guildId, actorId, req.auth.roles || [], Perm.BAN_MEMBERS);
    if (!actorCanBan) return rep.code(403).send({ error: "MISSING_PERMS" });

    await q(`DELETE FROM guild_bans WHERE guild_id=:guildId AND user_id=:memberId`, { guildId, memberId });
    return rep.send({ ok: true, unbannedUserId: memberId });
  });
}
