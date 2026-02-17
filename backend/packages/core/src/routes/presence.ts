import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { presenceGetMany } from "../presence.js";
import { q } from "../db.js";

const RichPresenceBody = z.object({
  activity: z.object({
    name: z.string().min(1).max(128).optional().nullable(),
    details: z.string().max(128).optional().nullable(),
    state: z.string().max(128).optional().nullable(),
    largeImageUrl: z.string().url().max(1024).optional().nullable(),
    largeImageText: z.string().max(128).optional().nullable(),
    smallImageUrl: z.string().url().max(1024).optional().nullable(),
    smallImageText: z.string().max(128).optional().nullable(),
    buttons: z.array(z.object({
      label: z.string().min(1).max(32),
      url: z.string().url().max(1024)
    })).max(2).optional(),
    startTimestamp: z.number().int().positive().optional().nullable(),
    endTimestamp: z.number().int().positive().optional().nullable()
  }).nullable()
});

export async function presenceRoutes(app: FastifyInstance) {
  app.get("/v1/presence", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const raw = (req.query as { userIds?: string }).userIds;
    const userIds = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const result = await presenceGetMany(userIds);
    return rep.send(result);
  });

  app.post("/v1/presence/rpc", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = RichPresenceBody.parse(req.body || {});
    const activityJson = body.activity ? JSON.stringify(body.activity) : null;

    await q(
      `INSERT INTO presence (user_id, status, custom_status, rich_presence_json, updated_at)
       VALUES (:userId, 'online', NULL, :activityJson, NOW())
       ON DUPLICATE KEY UPDATE rich_presence_json=:activityJson, updated_at=NOW()`,
      { userId, activityJson }
    );

    return rep.send({ ok: true, activity: body.activity });
  });

  app.delete("/v1/presence/rpc", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    await q(`UPDATE presence SET rich_presence_json=NULL, updated_at=NOW() WHERE user_id=:userId`, { userId });
    return rep.send({ ok: true });
  });
}
