import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/dist/ids.js";
import { q } from "../db.js";

export async function channelRoutes(app: FastifyInstance) {
  app.post("/v1/guilds/:guildId/channels", async (req, rep) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    const body = z.object({ name: z.string().min(1).max(64) }).parse(req.body);

    const id = ulidLike();
    await q(`INSERT INTO channels (id,guild_id,name) VALUES ($1,$2,$3)`, [id, guildId, body.name]);
    return rep.send({ channelId: id });
  });

  app.get("/v1/guilds/:guildId/channels", async (req) => {
    const { guildId } = z.object({ guildId: z.string().min(3) }).parse(req.params);
    return q(`SELECT id,name,created_at FROM channels WHERE guild_id=$1 ORDER BY created_at ASC`, [guildId]);
  });
}
