import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { requireGuildMember } from "../auth/requireGuildMember.js";
import { requireManageChannels } from "../permissions/hierarchy.js";

const EmoteName = z.string().min(2).max(32).regex(/^[a-zA-Z0-9_+-]+$/);
const EmoteImage = z.string().url().max(1000);

export async function emoteRoutes(app: FastifyInstance) {
  app.get("/v1/guilds/:guildId/emotes", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const userId = req.auth.userId as string;
    try { await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId); }
    catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const emotes = await q<any>(
      `SELECT id,guild_id,name,image_url,created_by,created_at
       FROM guild_emotes
       WHERE guild_id=:guildId
       ORDER BY name ASC`,
      { guildId }
    );
    return { emotes };
  });

  app.post("/v1/guilds/:guildId/emotes", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const userId = req.auth.userId as string;
    const body = z.object({
      name: EmoteName,
      imageUrl: EmoteImage
    }).parse(req.body || {});

    try { await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId); }
    catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const anyChannel = await q<{ id: string }>(
      `SELECT id FROM channels WHERE guild_id=:guildId ORDER BY created_at ASC LIMIT 1`,
      { guildId }
    );
    if (!anyChannel.length) return rep.code(400).send({ error: "GUILD_HAS_NO_CHANNELS" });

    try {
      await requireManageChannels({ guildId, channelIdForPerms: anyChannel[0].id, actorId: userId, actorRoles: req.auth.roles || [] });
    } catch {
      return rep.code(403).send({ error: "MISSING_PERMS" });
    }

    const id = ulidLike();
    try {
      await q(
        `INSERT INTO guild_emotes (id,guild_id,name,image_url,created_by)
         VALUES (:id,:guildId,:name,:imageUrl,:createdBy)`,
        {
          id,
          guildId,
          name: body.name.toLowerCase(),
          imageUrl: body.imageUrl,
          createdBy: userId
        }
      );
    } catch (error: any) {
      if (String(error?.message || "").toLowerCase().includes("duplicate")) {
        return rep.code(409).send({ error: "EMOTE_NAME_TAKEN" });
      }
      throw error;
    }

    return { ok: true, emoteId: id };
  });

  app.delete("/v1/guilds/:guildId/emotes/:emoteId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId, emoteId } = z.object({
      guildId: z.string().min(3),
      emoteId: z.string().min(3)
    }).parse(req.params);
    const userId = req.auth.userId as string;

    try { await requireGuildMember(guildId, userId, req.auth.roles, req.auth.coreServerId); }
    catch { return rep.code(403).send({ error: "NOT_GUILD_MEMBER" }); }

    const anyChannel = await q<{ id: string }>(
      `SELECT id FROM channels WHERE guild_id=:guildId ORDER BY created_at ASC LIMIT 1`,
      { guildId }
    );
    if (!anyChannel.length) return rep.code(400).send({ error: "GUILD_HAS_NO_CHANNELS" });

    try {
      await requireManageChannels({ guildId, channelIdForPerms: anyChannel[0].id, actorId: userId, actorRoles: req.auth.roles || [] });
    } catch {
      return rep.code(403).send({ error: "MISSING_PERMS" });
    }

    await q(`DELETE FROM guild_emotes WHERE id=:emoteId AND guild_id=:guildId`, { emoteId, guildId });
    return { ok: true };
  });
}
