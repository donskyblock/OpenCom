import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/dist/ids.js";
import { q } from "../db.js";

export async function messageRoutes(
  app: FastifyInstance,
  broadcastToChannel: (channelId: string, event: any) => void
) {
  app.get("/v1/channels/:channelId/messages", async (req) => {
    const { channelId } = z.object({ channelId: z.string().min(3) }).parse(req.params);
    const qs = z.object({ limit: z.coerce.number().min(1).max(100).default(50) }).parse(req.query);

    return q(
      `SELECT id,author_id,content,created_at FROM messages WHERE channel_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [channelId, qs.limit]
    );
  });

  app.post("/v1/channels/:channelId/messages", async (req, rep) => {
    const { channelId } = z.object({ channelId: z.string().min(3) }).parse(req.params);
    const body = z.object({ authorId: z.string().min(3), content: z.string().min(1).max(4000) }).parse(req.body);

    const id = ulidLike();
    const createdAt = new Date().toISOString();
    await q(
      `INSERT INTO messages (id,channel_id,author_id,content,created_at) VALUES ($1,$2,$3,$4,$5)`,
      [id, channelId, body.authorId, body.content, createdAt]
    );

    const payload = { channelId, message: { id, authorId: body.authorId, content: body.content, createdAt } };
    broadcastToChannel(channelId, payload);

    return rep.send({ messageId: id, createdAt });
  });
}
