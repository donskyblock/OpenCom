import { FastifyInstance } from "fastify";
import { q } from "../db.js";

export async function meRoutes(app: FastifyInstance) {
  // Returns guilds the authed user has joined on THIS node
  app.get("/v1/me/guilds", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.auth.userId as string;

    const rows = await q<any>(
      `SELECT g.id, g.name, g.owner_user_id, g.created_at
       FROM guild_members gm
       JOIN guilds g ON g.id = gm.guild_id
       WHERE gm.user_id = :userId
       ORDER BY gm.joined_at DESC`,
      { userId }
    );

    return { guilds: rows };
  });
}
