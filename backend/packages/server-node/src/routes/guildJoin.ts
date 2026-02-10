import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";

export async function guildJoinRoutes(app: FastifyInstance) {
  // Auth required (membership token proves you are a platform user allowed on this server-node)
  // This endpoint simply creates the local guild_members row.
  app.post("/v1/guilds/:guildId/join", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const userId = req.auth.userId as string;

    const g = await q<{ id: string }>(`SELECT id FROM guilds WHERE id=:guildId`, { guildId });
    if (!g.length) return rep.code(404).send({ error: "GUILD_NOT_FOUND" });

    await q(
      `INSERT INTO guild_members (guild_id,user_id) VALUES (:guildId,:userId)
       ON DUPLICATE KEY UPDATE guild_id=guild_id`,
      { guildId, userId }
    );

    return rep.send({ ok: true });
  });
}
