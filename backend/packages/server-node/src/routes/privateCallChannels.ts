import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { env } from "../env.js";

/**
 * Internal routes for managing ephemeral voice channels used by private (1:1) calls.
 *
 * These are NOT authenticated with a membership JWT — they are called server-to-server
 * by the core backend and secured purely by NODE_SYNC_SECRET.
 *
 * Two operations are exposed:
 *   POST   /v1/internal/private-call-channel          — create channel + admit two users
 *   DELETE /v1/internal/private-call-channel/:channelId — remove channel + evict users
 */

const SECRET_HEADER = "x-node-sync-secret";

function checkSecret(req: any, rep: any): boolean {
  if (!env.NODE_SYNC_SECRET) {
    rep.code(503).send({ error: "NODE_SYNC_SECRET_NOT_CONFIGURED" });
    return false;
  }
  if (req.headers[SECRET_HEADER] !== env.NODE_SYNC_SECRET) {
    rep.code(401).send({ error: "INVALID_SYNC_SECRET" });
    return false;
  }
  return true;
}

const CreateBody = z.object({
  /** The ID of the system guild that hosts all private-call voice channels. */
  guildId: z.string().min(3),
  /** Display name for the ephemeral channel, e.g. "call-<shortId>". */
  channelName: z.string().min(1).max(64).default("private-call"),
  /** Both participants must be provided so they can be added as guild members. */
  user1Id: z.string().min(1),
  user2Id: z.string().min(1)
});

const DeleteParams = z.object({
  channelId: z.string().min(3)
});

const DeleteBody = z.object({
  /** Optionally supply both user IDs so their guild membership is cleaned up too. */
  user1Id: z.string().min(1).optional(),
  user2Id: z.string().min(1).optional()
});

export async function privateCallChannelRoutes(app: FastifyInstance) {
  if (!env.NODE_SYNC_SECRET) {
    app.log.warn(
      "NODE_SYNC_SECRET not set — private-call-channel internal routes are disabled."
    );
    return;
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────

  app.post("/v1/internal/private-call-channel", async (req: any, rep) => {
    if (!checkSecret(req, rep)) return;

    const parsed = CreateBody.safeParse(req.body || {});
    if (!parsed.success) {
      return rep.code(400).send({ error: "INVALID_BODY", details: parsed.error.issues });
    }

    const { guildId, channelName, user1Id, user2Id } = parsed.data;

    // Verify the guild exists and is marked as a system guild (safety check).
    const guilds = await q<{ id: string; is_system: number }>(
      `SELECT id, is_system FROM guilds WHERE id = :guildId LIMIT 1`,
      { guildId }
    );

    if (!guilds.length) {
      return rep.code(404).send({ error: "GUILD_NOT_FOUND" });
    }

    if (!guilds[0].is_system) {
      // Refuse to create private-call channels in user-visible guilds.
      return rep.code(403).send({ error: "NOT_A_SYSTEM_GUILD" });
    }

    // Determine next channel position.
    const posRow = await q<{ p: number }>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS p FROM channels WHERE guild_id = :guildId`,
      { guildId }
    );
    const position = posRow[0]?.p ?? 1;

    const channelId = ulidLike();

    await q(
      `INSERT INTO channels (id, guild_id, name, type, position, parent_id)
       VALUES (:id, :guildId, :name, 'voice', :position, NULL)`,
      { id: channelId, guildId, name: channelName, position }
    );

    // Ensure both users are guild members for the duration of the call.
    // ON DUPLICATE KEY UPDATE is a no-op so existing memberships are preserved.
    await q(
      `INSERT INTO guild_members (guild_id, user_id)
       VALUES (:guildId, :userId)
       ON DUPLICATE KEY UPDATE guild_id = guild_id`,
      { guildId, userId: user1Id }
    );
    await q(
      `INSERT INTO guild_members (guild_id, user_id)
       VALUES (:guildId, :userId)
       ON DUPLICATE KEY UPDATE guild_id = guild_id`,
      { guildId, userId: user2Id }
    );

    app.log.info(
      { guildId, channelId, user1Id, user2Id },
      "private-call channel created"
    );

    return rep.code(201).send({ channelId, guildId });
  });

  // ── MARK SYSTEM GUILD ──────────────────────────────────────────────────────
  //
  // Used once by the setup script to flag the private-calls guild as a system
  // guild so it is hidden from user-facing guild listings.

  app.post("/v1/internal/mark-system-guild", async (req: any, rep) => {
    if (!checkSecret(req, rep)) return;

    const parsed = z.object({ guildId: z.string().min(3) }).safeParse(req.body || {});
    if (!parsed.success) {
      return rep.code(400).send({ error: "INVALID_BODY", details: parsed.error.issues });
    }

    const { guildId } = parsed.data;

    const guilds = await q<{ id: string }>(
      `SELECT id FROM guilds WHERE id = :guildId LIMIT 1`,
      { guildId }
    );
    if (!guilds.length) {
      return rep.code(404).send({ error: "GUILD_NOT_FOUND" });
    }

    await q(
      `UPDATE guilds SET is_system = TRUE WHERE id = :guildId`,
      { guildId }
    );

    app.log.info({ guildId }, "guild marked as system (private-calls)");

    return rep.send({ ok: true, guildId });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────

  app.delete(
    "/v1/internal/private-call-channel/:channelId",
    async (req: any, rep) => {
      if (!checkSecret(req, rep)) return;

      const paramsParsed = DeleteParams.safeParse(req.params || {});
      if (!paramsParsed.success) {
        return rep.code(400).send({ error: "INVALID_PARAMS" });
      }
      const { channelId } = paramsParsed.data;

      const bodyParsed = DeleteBody.safeParse(req.body || {});
      const { user1Id, user2Id } = bodyParsed.success ? bodyParsed.data : {};

      // Look up the channel so we know which guild to clean up.
      const channels = await q<{ id: string; guild_id: string }>(
        `SELECT id, guild_id FROM channels WHERE id = :channelId LIMIT 1`,
        { channelId }
      );

      if (!channels.length) {
        // Already gone — treat as success (idempotent).
        return rep.send({ ok: true, alreadyGone: true });
      }

      const guildId = channels[0].guild_id;

      // Evict any voice states for this channel first.
      await q(
        `DELETE FROM voice_states WHERE channel_id = :channelId`,
        { channelId }
      );

      // Delete the channel (cascades to overwrites, pins, etc. via FK).
      await q(`DELETE FROM channels WHERE id = :channelId`, { channelId });

      app.log.info({ channelId, guildId }, "private-call channel deleted");

      // If user IDs were supplied, remove them from the system guild.
      // We check that they have no other reason to be there (no other memberships
      // are relevant since this is a system guild with no user-facing content).
      if (user1Id) {
        await q(
          `DELETE FROM guild_members WHERE guild_id = :guildId AND user_id = :userId`,
          { guildId, userId: user1Id }
        );
      }
      if (user2Id) {
        await q(
          `DELETE FROM guild_members WHERE guild_id = :guildId AND user_id = :userId`,
          { guildId, userId: user2Id }
        );
      }

      return rep.send({ ok: true });
    }
  );
}
