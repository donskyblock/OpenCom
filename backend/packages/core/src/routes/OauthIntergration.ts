import { FastifyInstance } from "fastify/types/instance";
import crypto from "node:crypto";
import { z } from "zod";
import { verifyPassword } from "../crypto";
import { q } from "../db";
import { env } from "../env";
import { parseBody } from "../validation";

const oauthAccessSchema = z.object({
  secret: z.string().trim().min(1),
  app_id: z.string().trim().min(1),
});

const oauthLookupSchema = z.object({
  token: z.string().trim().min(1),
});

const LoginOAuth = z.object({
  email: z.string().email(),
  password: z.string(),
});

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function parseRouteInput<T extends z.ZodTypeAny>(schema: T, req: { body?: unknown; query?: unknown }) {
  const body = req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return schema.parse(body);
  }
  return schema.parse(req.query ?? parseBody(schema, body));
}

export async function OauthIntergrationRoutes(app: FastifyInstance) {
  async function lookupAppAccess(secret: string, appId: string) {
    const result = await q<{ app_id: string }>(
      `SELECT osa.app_id
       FROM oauth_sessions os
       JOIN oauth_session_apps osa ON os.session_id = osa.session_id
       WHERE os.secret_code = :secret AND osa.app_id = :app_id`,
      { secret, app_id: appId },
    );
    return result.length > 0;
  }

  async function handleAccessCheck(req: any) {
    const { secret, app_id } = parseRouteInput(oauthAccessSchema, req);
    const allowed = await lookupAppAccess(secret, app_id);
    return { success: true, allowed, app_id };
  }

  async function handleAccessGrant(req: any, rep: any) {
    const { secret, app_id } = parseRouteInput(oauthAccessSchema, req);

    if (await lookupAppAccess(secret, app_id)) {
      return rep.send({
        success: true,
        allowed: true,
        created: false,
        app_id,
        message: "Integration already exists",
      });
    }

    const sessions = await q<{ session_id: number }>(
      `SELECT session_id FROM oauth_sessions WHERE secret_code = :secret LIMIT 1`,
      { secret },
    );

    if (!sessions.length) {
      return rep.code(404).send({
        success: false,
        allowed: false,
        created: false,
        app_id,
        message: "Invalid secret code",
      });
    }

    await q(
      `INSERT INTO oauth_session_apps (session_id, app_id)
       VALUES (:session_id, :app_id)`,
      { session_id: sessions[0].session_id, app_id },
    );

    return rep.send({
      success: true,
      allowed: true,
      created: true,
      app_id,
      message: "Integration created successfully",
    });
  }

  app.get("/v1/oauth", handleAccessCheck);
  app.get("/v1/oauth/access", handleAccessCheck);
  app.get("/v1/create", handleAccessGrant);
  app.post("/v1/oauth/access", handleAccessGrant);
  app.post("/v1/oauth/create", handleAccessGrant);

  app.post("/v1/oauth/login", async (req, rep) => {
    const body = parseBody(LoginOAuth, req.body);

    const users = await q<{
      id: string;
      password_hash: string;
      username: string;
      email: string;
      email_verified_at: string | null;
      banned_at: string | null;
    }>(
      `SELECT u.id, u.password_hash, u.username, u.email, u.email_verified_at, ab.created_at AS banned_at
       FROM users u
       LEFT JOIN account_bans ab ON ab.user_id = u.id
       WHERE u.email = :email
       LIMIT 1`,
      { email: body.email },
    );

    if (!users.length) return rep.code(401).send({ error: "INVALID_CREDENTIALS" });

    const u = users[0];
    if (u.banned_at) return rep.code(403).send({ error: "ACCOUNT_BANNED" });

    const ok = await verifyPassword(u.password_hash, body.password);
    if (!ok) return rep.code(401).send({ error: "INVALID_CREDENTIALS" });

    if (env.AUTH_REQUIRE_EMAIL_VERIFICATION && !u.email_verified_at) {
      return rep.code(403).send({ error: "EMAIL_NOT_VERIFIED" });
    }

    const secretCode = randomToken();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    await q(
      `INSERT INTO oauth_sessions (user_id, secret_code, last_login)
       VALUES (:userId, :secretCode, :lastLogin)`,
      { userId: u.id, secretCode, lastLogin: now },
    );

    return rep.send({
      success: true,
      user: { id: u.id, email: u.email, username: u.username },
      secret: secretCode,
      message: "OAuth secret generated successfully",
    });
  });

  app.get("/v1/oauth/login/user", async (req: any, rep) => {
    const { token } = parseRouteInput(oauthLookupSchema, req);

    const links = await q<{
      app_id: string;
      secret_code: string;
      scopes: string;
    }>(
      `SELECT * FROM oauth_links WHERE token = :token LIMIT 1`,
      { token }
    );

    if (!links.length) return rep.code(404).send({ success: false, message: "Invalid token" });

    const link = links[0];

    const sessions = await q<{
      user_id: string;
      username: string;
      email: string;
    }>(
      `SELECT os.user_id, u.username, u.email
       FROM oauth_sessions os
       JOIN users u ON u.id = os.user_id
       WHERE os.secret_code = :secret
       ORDER BY os.last_login DESC
       LIMIT 1`,
      { secret: link.secret_code }
    );

    if (!sessions.length) {
      return rep.send({ success: false, requires_login: true, message: "User not logged in" });
    }

    const user = sessions[0];

    // Return session + meta
    return rep.send({
      success: true,
      user: { id: user.user_id, username: user.username, email: user.email },
      app_id: link.app_id,
      scopes: JSON.parse(link.scopes)
    });
  });
}
