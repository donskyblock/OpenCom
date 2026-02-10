import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/dist/ids.js";
import { q } from "../db.js";
import { hashPassword, verifyPassword, sha256Hex } from "../crypto.js";
import { env } from "../env.js";
import { SignJWT } from "jose";
import crypto from "node:crypto";

const Register = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(32),
  password: z.string().min(8).max(200)
});

const Login = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/v1/auth/register", async (req, rep) => {
    const body = Register.parse(req.body);

    const existing = await q(`SELECT id FROM users WHERE email=$1`, [body.email]);
    if (existing.length) return rep.code(409).send({ error: "EMAIL_TAKEN" });

    const id = ulidLike();
    const pwHash = await hashPassword(body.password);

    await q(`INSERT INTO users (id,email,username,password_hash) VALUES ($1,$2,$3,$4)`, [
      id, body.email, body.username, pwHash
    ]);

    return rep.send({ id, email: body.email, username: body.username });
  });

  app.post("/v1/auth/login", async (req, rep) => {
    const body = Login.parse(req.body);
    const users = await q<{ id: string; password_hash: string; username: string; email: string }>(
      `SELECT id,password_hash,username,email FROM users WHERE email=$1`,
      [body.email]
    );
    if (!users.length) return rep.code(401).send({ error: "INVALID_CREDENTIALS" });

    const u = users[0];
    const ok = await verifyPassword(u.password_hash, body.password);
    if (!ok) return rep.code(401).send({ error: "INVALID_CREDENTIALS" });

    const accessToken = app.jwt.sign({ sub: u.id, typ: "access" }, { expiresIn: "15m" });

    // refresh token = opaque, stored hashed
    const refresh = randomToken();
    const refreshId = ulidLike();
    const tokenHash = sha256Hex(refresh);

    await q(
      `INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3, now() + interval '30 days')`,
      [refreshId, u.id, tokenHash]
    );

    return rep.send({
      user: { id: u.id, email: u.email, username: u.username },
      accessToken,
      refreshToken: refresh
    });
  });

  app.post("/v1/auth/refresh", async (req, rep) => {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const tokenHash = sha256Hex(body.refreshToken);

    const rows = await q<{ id: string; user_id: string; revoked_at: string | null; expires_at: string }>(
      `SELECT id,user_id,revoked_at,expires_at FROM refresh_tokens WHERE token_hash=$1`,
      [tokenHash]
    );
    if (!rows.length) return rep.code(401).send({ error: "INVALID_REFRESH" });

    const rt = rows[0];
    if (rt.revoked_at) return rep.code(401).send({ error: "REFRESH_REVOKED" });
    if (new Date(rt.expires_at).getTime() < Date.now()) return rep.code(401).send({ error: "REFRESH_EXPIRED" });

    const accessToken = app.jwt.sign({ sub: rt.user_id, typ: "access" }, { expiresIn: "15m" });
    return rep.send({ accessToken });
  });

  app.get("/v1/me", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;
    const rows = await q<{ id: string; email: string; username: string }>(
      `SELECT id,email,username FROM users WHERE id=$1`,
      [userId]
    );
    return rows[0] ?? null;
  });

  // Fastify auth decorator
  app.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });
}
