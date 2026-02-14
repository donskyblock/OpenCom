import type { FastifyInstance } from "fastify";
import { presenceGetMany } from "../presence.js";

export async function presenceRoutes(app: FastifyInstance) {
  app.get("/v1/presence", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const raw = (req.query as { userIds?: string }).userIds;
    const userIds = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const result = await presenceGetMany(userIds);
    return rep.send(result);
  });
}
