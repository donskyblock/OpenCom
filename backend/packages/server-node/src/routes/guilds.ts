import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/dist/ids.js";
import { q } from "../db.js";

export async function guildRoutes(app: FastifyInstance) {
  app.post("/v1/guilds", async (req, rep) => {
    const body = z.object({ name: z.string().min(2).max(64), ownerUserId: z.string().min(3) }).parse(req.body);
    const id = ulidLike();
    await q(`INSERT INTO guilds (id,name,owner_user_id) VALUES ($1,$2,$3)`, [id, body.name, body.ownerUserId]);

    // default channel
    const chId = ulidLike();
    await q(`INSERT INTO channels (id,guild_id,name) VALUES ($1,$2,$3)`, [chId, id, "general"]);

    return rep.send({ guildId: id, defaultChannelId: chId });
  });

  app.get("/v1/guilds/:id", async (req) => {
    const { id } = z.object({ id: z.string().min(3) }).parse(req.params);
    const rows = await q(`SELECT id,name,owner_user_id,created_at FROM guilds WHERE id=$1`, [id]);
    return rows[0] ?? null;
  });
}
