import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/dist/ids.js";
import { q } from "../db.js";
import { SignJWT, importJWK } from "jose";
import { env } from "../env.js";

const CreateServer = z.object({
  name: z.string().min(2).max(64),
  baseUrl: z.string().url()
});

export async function serverRoutes(app: FastifyInstance) {
  app.post("/v1/servers", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = CreateServer.parse(req.body);

    const id = ulidLike();
    await q(`INSERT INTO servers (id,name,base_url,owner_user_id) VALUES ($1,$2,$3,$4)`,
      [id, body.name, body.baseUrl, userId]
    );
    // auto membership
    await q(`INSERT INTO memberships (server_id,user_id,roles) VALUES ($1,$2,$3)`,
      [id, userId, ["owner"]]
    );

    return rep.send({ serverId: id });
  });

  app.get("/v1/servers", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;
    const rows = await q<{ id: string; name: string; base_url: string; roles: string[] }>(
      `SELECT s.id, s.name, s.base_url, m.roles
       FROM memberships m
       JOIN servers s ON s.id=m.server_id
       WHERE m.user_id=$1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    // Issue membership tokens per server (short-lived)
    const priv = await importJWK(JSON.parse(env.CORE_MEMBERSHIP_PRIVATE_JWK), "RS256");

    const servers = await Promise.all(rows.map(async (r) => {
      const membershipToken = await new SignJWT({
        server_id: r.id,
        roles: r.roles
      })
        .setProtectedHeader({ alg: "RS256", kid: JSON.parse(env.CORE_MEMBERSHIP_PRIVATE_JWK).kid })
        .setIssuer(env.CORE_ISSUER)
        .setAudience(r.id) // aud = server_id for MVP
        .setSubject(userId)
        .setExpirationTime("10m")
        .sign(priv);

      return {
        id: r.id,
        name: r.name,
        baseUrl: r.base_url,
        roles: r.roles,
        membershipToken
      };
    }));

    return { servers };
  });
}
