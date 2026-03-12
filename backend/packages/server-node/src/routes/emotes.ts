import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { requireGuildMember } from "../auth/requireGuildMember.js";
import { env } from "../env.js";
import { resolveChannelPermissions } from "../permissions/resolve.js";
import { Perm, has } from "../permissions/bits.js";

const EmoteName = z.string().min(2).max(32).regex(/^[a-zA-Z0-9_+-]+$/);
const EmoteImage = z.string().trim().min(1).max(1000);

function normalizeEmoteImageUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("INVALID_EMOTE_IMAGE_URL");
    }
    return parsed.toString();
  }

  const coreBaseUrl = env.CORE_BASE_URL.replace(/\/$/, "");
  if (raw.startsWith("/")) {
    return `${coreBaseUrl}${raw}`;
  }
  if (raw.startsWith("users/")) {
    return `${coreBaseUrl}/v1/profile-images/${raw}`;
  }

  throw new Error("INVALID_EMOTE_IMAGE_URL");
}

async function requireManageGuildAssets(guildId: string, channelIdForPerms: string, actorId: string, actorRoles: string[] = []) {
  const perms = await resolveChannelPermissions({
    guildId,
    channelId: channelIdForPerms,
    userId: actorId,
    roles: actorRoles,
  });

  if (
    !has(perms, Perm.ADMINISTRATOR) &&
    !has(perms, Perm.MANAGE_CHANNELS) &&
    !has(perms, Perm.MANAGE_ROLES)
  ) {
    throw new Error("MISSING_PERMS");
  }
}

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
      await requireManageGuildAssets(guildId, anyChannel[0].id, userId, req.auth.roles || []);
    } catch {
      return rep.code(403).send({ error: "MISSING_PERMS" });
    }

    let normalizedImageUrl = "";
    try {
      normalizedImageUrl = normalizeEmoteImageUrl(body.imageUrl);
    } catch {
      return rep.code(400).send({ error: "INVALID_EMOTE_IMAGE_URL" });
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
          imageUrl: normalizedImageUrl,
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
      await requireManageGuildAssets(guildId, anyChannel[0].id, userId, req.auth.roles || []);
    } catch {
      return rep.code(403).send({ error: "MISSING_PERMS" });
    }

    await q(`DELETE FROM guild_emotes WHERE id=:emoteId AND guild_id=:guildId`, { emoteId, guildId });
    return { ok: true };
  });
}
