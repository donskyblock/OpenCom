import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { requireGuildMember } from "../auth/requireGuildMember.js";
import { resolveChannelPermissions } from "../permissions/resolve.js";
import { Perm, has } from "../permissions/bits.js";

export async function guildStateRoutes(app: FastifyInstance) {
  app.get("/v1/guilds/:guildId/state", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const userId = req.auth.userId as string;

    try {
      await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId);
    } catch {
      return rep.code(403).send({ error: "NOT_GUILD_MEMBER" });
    }

    const guild = (await q<any>(`SELECT id,name,owner_user_id,created_at FROM guilds WHERE id=:guildId`, { guildId }))[0];
    if (!guild) return rep.code(404).send({ error: "GUILD_NOT_FOUND" });

    const allChannels = await q<any>(
      `SELECT id,guild_id,name,type,position,parent_id,created_at
       FROM channels WHERE guild_id=:guildId
       ORDER BY position ASC, created_at ASC`,
      { guildId }
    );

    const visibleChannelSet = new Set<string>();
    const channels: any[] = [];
    for (const channel of allChannels) {
      const perms = await resolveChannelPermissions({
        guildId,
        channelId: channel.id,
        userId,
        roles: req.auth.roles || []
      });
      if (!has(perms, Perm.VIEW_CHANNEL)) continue;
      visibleChannelSet.add(channel.id);
      channels.push(channel);
    }

    const roles = await q<any>(
      `SELECT id,guild_id,name,color,position,permissions,is_everyone,created_at
       FROM roles WHERE guild_id=:guildId
       ORDER BY position DESC`,
      { guildId }
    );

    const overwrites = await q<any>(
      `SELECT channel_id,target_type,target_id,allow,deny
       FROM channel_overwrites
      WHERE channel_id IN (SELECT id FROM channels WHERE guild_id=:guildId)`,
      { guildId }
    );

    const myRoleIds = await q<{ role_id: string }>(
      `SELECT role_id FROM member_roles WHERE guild_id=:guildId AND user_id=:userId`,
      { guildId, userId }
    );

    const members = await q<{ user_id: string; nick: string | null }>(
      `SELECT gm.user_id, gm.nick
       FROM guild_members gm
       WHERE gm.guild_id=:guildId
       ORDER BY gm.joined_at ASC`,
      { guildId }
    );

    const memberRoleRows = await q<{ user_id: string; role_id: string }>(
      `SELECT user_id, role_id FROM member_roles WHERE guild_id=:guildId`,
      { guildId }
    );
    const emotes = await q<{ id: string; guild_id: string; name: string; image_url: string; created_by: string; created_at: string }>(
      `SELECT id,guild_id,name,image_url,created_by,created_at
       FROM guild_emotes
       WHERE guild_id=:guildId
       ORDER BY name ASC`,
      { guildId }
    );

    const voiceStatesRaw = await q<{ user_id: string; channel_id: string; muted: number; deafened: number; updated_at: string }>(
      `SELECT user_id,channel_id,muted,deafened,updated_at
       FROM voice_states
       WHERE guild_id=:guildId`,
      { guildId }
    );
    const voiceStates = voiceStatesRaw.filter((state) => visibleChannelSet.has(state.channel_id));
    const roleIdsByUser = new Map<string, string[]>();
    for (const row of memberRoleRows) {
      if (!roleIdsByUser.has(row.user_id)) roleIdsByUser.set(row.user_id, []);
      roleIdsByUser.get(row.user_id)!.push(row.role_id);
    }

    return rep.send({
      guild,
      channels,
      roles,
      overwrites: overwrites.filter((overwrite) => visibleChannelSet.has(overwrite.channel_id)),
      members: members.map((member) => ({
        id: member.user_id,
        username: member.nick || member.user_id,
        pfp_url: null,
        status: "online",
        roleIds: roleIdsByUser.get(member.user_id) || []
      })),
      me: { userId, roleIds: myRoleIds.map(r => r.role_id) },
      emotes: emotes.map((emote) => ({
        id: emote.id,
        guildId: emote.guild_id,
        name: emote.name,
        imageUrl: emote.image_url,
        createdBy: emote.created_by,
        createdAt: emote.created_at
      })),
      voiceStates: voiceStates.map((vs) => ({
        userId: vs.user_id,
        channelId: vs.channel_id,
        muted: !!vs.muted,
        deafened: !!vs.deafened,
        updatedAt: vs.updated_at
      }))
    });
  });
}
