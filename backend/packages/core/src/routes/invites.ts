import { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { q } from "../db.js";

function inviteCode(): string {
  return crypto.randomBytes(6).toString("base64url"); // short-ish
}

const CreateInvite = z.object({
  serverId: z.string().min(3),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional()
});

export async function inviteRoutes(app: FastifyInstance) {
  app.post("/v1/invites", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = CreateInvite.parse(req.body);

    // Only server owner can create invites (MVP)
    const s = await q<{ owner_user_id: string }>(`SELECT owner_user_id FROM servers WHERE id=$1`, [body.serverId]);
    if (!s.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });
    if (s[0].owner_user_id !== userId) return rep.code(403).send({ error: "FORBIDDEN" });

    const code = inviteCode();
    await q(
      `INSERT INTO invites (code, server_id, created_by, max_uses, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [code, body.serverId, userId, body.maxUses ?? null, body.expiresAt ?? null]
    );

    return { code, serverId: body.serverId };
  });

  app.get("/v1/invites/:code", async (req, rep) => {
    const { code } = z.object({ code: z.string().min(3) }).parse(req.params);
    const rows = await q<any>(
      `SELECT code, server_id, max_uses, uses, expires_at, created_at FROM invites WHERE code=$1`,
      [code]
    );
    if (!rows.length) return rep.code(404).send({ error: "NOT_FOUND" });

    const inv = rows[0];
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return rep.code(410).send({ error: "EXPIRED" });
    if (inv.max_uses && inv.uses >= inv.max_uses) return rep.code(410).send({ error: "MAX_USES" });

    return inv;
  });

  app.post("/v1/invites/:code/join", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { code } = z.object({ code: z.string().min(3) }).parse(req.params);

    const rows = await q<any>(`SELECT * FROM invites WHERE code=$1`, [code]);
    if (!rows.length) return rep.code(404).send({ error: "NOT_FOUND" });

    const inv = rows[0];
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return rep.code(410).send({ error: "EXPIRED" });
    if (inv.max_uses && inv.uses >= inv.max_uses) return rep.code(410).send({ error: "MAX_USES" });

    await q(
      `INSERT INTO memberships (server_id,user_id,roles)
       VALUES ($1,$2,$3)
       ON CONFLICT (server_id,user_id) DO NOTHING`,
      [inv.server_id, userId, ["member"]]
    );

    await q(`UPDATE invites SET uses = uses + 1 WHERE code=$1`, [code]);

    return { ok: true, serverId: inv.server_id };
  });
}
