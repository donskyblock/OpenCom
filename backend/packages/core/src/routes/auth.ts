import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { hashPassword, verifyPassword, sha256Hex } from "../crypto.js";
import crypto from "node:crypto";
import { parseBody } from "../validation.js";

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

  app.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });

  app.post("/v1/auth/register", async (req, rep) => {
    const body = parseBody(Register, req.body);

    const existing = await q(`SELECT id FROM users WHERE email=:email`, { email: body.email });
    if (existing.length) return rep.code(409).send({ error: "EMAIL_TAKEN" });

    const id = ulidLike();
    const pwHash = await hashPassword(body.password);

    await q(
      `INSERT INTO users (id,email,username,password_hash) VALUES (:id,:email,:username,:passwordHash)`,
      { id, email: body.email, username: body.username, passwordHash: pwHash }
    );

    // Bootstrap platform founder on first registration if unset
    await q(`INSERT INTO platform_config (id, founder_user_id) VALUES (1, NULL) ON DUPLICATE KEY UPDATE id=id`);
    const founder = await q<{ founder_user_id: string | null }>(`SELECT founder_user_id FROM platform_config WHERE id=1`);
    if (!founder.length || !founder[0].founder_user_id) {
      await q(`UPDATE platform_config SET founder_user_id=:id WHERE id=1`, { id });
      await q(`INSERT INTO platform_admins (user_id,added_by) VALUES (:id,:id) ON DUPLICATE KEY UPDATE user_id=user_id`, { id });
      await q(`INSERT INTO user_badges (user_id,badge) VALUES (:id,'PLATFORM_FOUNDER') ON DUPLICATE KEY UPDATE user_id=user_id`, { id });
      await q(`INSERT INTO user_badges (user_id,badge) VALUES (:id,'PLATFORM_ADMIN') ON DUPLICATE KEY UPDATE user_id=user_id`, { id });
    }

    return rep.send({ id, email: body.email, username: body.username });
  });

  app.post("/v1/auth/login", async (req, rep) => {
    const body = parseBody(Login, req.body);
    const users = await q<{ id: string; password_hash: string; username: string; email: string }>(
      `SELECT id,password_hash,username,email FROM users WHERE email=:email`,
      { email: body.email }
    );
    if (!users.length) return rep.code(401).send({ error: "INVALID_CREDENTIALS" });

    const u = users[0];
    const ok = await verifyPassword(u.password_hash, body.password);
    if (!ok) return rep.code(401).send({ error: "INVALID_CREDENTIALS" });

    const accessToken = app.jwt.sign({ sub: u.id, typ: "access" }, { expiresIn: "12h" });

    const refresh = randomToken();
    const refreshId = ulidLike();
    const tokenHash = sha256Hex(refresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");

    await q(
      `INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at) VALUES (:id,:userId,:tokenHash,:expiresAt)`,
      { id: refreshId, userId: u.id, tokenHash, expiresAt }
    );

    return rep.send({
      user: { id: u.id, email: u.email, username: u.username },
      accessToken,
      refreshToken: refresh
    });
  });

  app.post("/v1/auth/refresh", async (req, rep) => {
    const body = parseBody(z.object({ refreshToken: z.string().min(10) }), req.body);
    const tokenHash = sha256Hex(body.refreshToken);

    const rows = await q<{ id: string; user_id: string; revoked_at: string | null; expires_at: string }>(
      `SELECT id,user_id,revoked_at,expires_at FROM refresh_tokens WHERE token_hash=:tokenHash`,
      { tokenHash }
    );
    if (!rows.length) return rep.code(401).send({ error: "INVALID_REFRESH" });

    const rt = rows[0];
    if (rt.revoked_at) return rep.code(401).send({ error: "REFRESH_REVOKED" });
    if (new Date(rt.expires_at).getTime() < Date.now()) return rep.code(401).send({ error: "REFRESH_EXPIRED" });

    const accessToken = app.jwt.sign({ sub: rt.user_id, typ: "access" }, { expiresIn: "12h" });
    return rep.send({ accessToken });
  });

  app.get("/v1/me", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;
    const rows = await q<{ id: string; email: string; username: string }>(
      `SELECT id,email,username FROM users WHERE id=:userId`,
      { userId }
    );
    return rows[0] ?? null;
  });

  app.get("/v1/auth/sessions", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const userId = req.user.sub as string;

    const rows = await q<{ id: string; created_at: string; expires_at: string; revoked_at: string | null; device_id: string | null }>(
      `SELECT id, created_at, expires_at, revoked_at, device_id 
       FROM refresh_tokens 
       WHERE user_id=:userId AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      { userId }
    );

    const sessions = rows.map((row, index) => ({
      id: row.id,
      deviceName: row.device_id ? `Device ${row.device_id.slice(0, 8)}` : `Session ${index + 1}`,
      lastActive: row.created_at,
      expiresAt: row.expires_at,
      isCurrent: index === 0 // Most recent session is considered current
    }));

    return { sessions };
  });

  app.delete("/v1/auth/sessions/:sessionId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { sessionId } = z.object({ sessionId: z.string().min(3) }).parse(req.params);

    const rows = await q<{ user_id: string }>(
      `SELECT user_id FROM refresh_tokens WHERE id=:sessionId`,
      { sessionId }
    );

    if (!rows.length) return rep.code(404).send({ error: "SESSION_NOT_FOUND" });
    if (rows[0].user_id !== userId) return rep.code(403).send({ error: "FORBIDDEN" });

    await q(
      `UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=:sessionId`,
      { sessionId }
    );

    return rep.send({ success: true });
  });

  app.patch("/v1/auth/password", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const body = parseBody(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(200)
    }), req.body);

    const users = await q<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id=:userId`,
      { userId }
    );
    if (!users.length) return rep.code(404).send({ error: "USER_NOT_FOUND" });

    const ok = await verifyPassword(users[0].password_hash, body.currentPassword);
    if (!ok) return rep.code(401).send({ error: "INVALID_PASSWORD" });

    const newHash = await hashPassword(body.newPassword);
    await q(
      `UPDATE users SET password_hash=:newHash WHERE id=:userId`,
      { userId, newHash }
    );

    return rep.send({ success: true });
  });

}