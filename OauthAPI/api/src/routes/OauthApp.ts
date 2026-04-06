import { FastifyInstance } from "fastify";
import { q } from "../db.js";
import { parseBody, parseBodyRaw } from "../validation.js";
import { z } from "zod";
import crypto from "crypto";
import { env } from "../env.js";

const AppRegistration = z.object({
  app_id: z.string().trim().email(),
  app_name: z.string().trim().min(2).max(32),
  secret_code: z.string().trim().max(64).min(32),
  user_id: z.string(),
  redirect_url: z.string().trim().min(1),
  description: z.string().trim().max(2000).optional(),
});
const AppRemoval = z.object({
  app_id: z.string(),
  secret_code: z.string(),
});

const GenerateLinkSchema = z.object({
  secret: z.string().trim().min(1),
  app_id: z.string().trim().min(1),
});

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

function generateClientSecret(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 hex chars = 256 bits
}

async function registerApp(
  app_id: string,
  appname: string,
  owner_id: string,
  redirect_url: string,
  description?: string,
) {
  const secret = generateClientSecret();
  const secret_hash = hashSecret(secret);
  const redirectUris = redirect_url
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await q(
    `INSERT INTO oauth_apps (account_id, app_id, app_name, description, client_secret_hash, redirect_uris)
     VALUES (:userId, :app_id, :app_name, :description, :client_secret_hash, :redirect_uris)`,
    {
      userId: owner_id,
      app_id,
      app_name: appname,
      description: description ?? null,
      client_secret_hash: secret_hash,
      redirect_uris: JSON.stringify(redirectUris),
    },
  );
  return {
    success: true,
    app_id: app_id,
    app_name: appname,
    client_secret: secret,
    timestamp: Date.now(),
  };
}

function normalizeRedirectUris(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry).trim()).filter(Boolean);
        }
      } catch {
        // fall back to comma-separated parsing
      }
    }
    return trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function buildCoreApiUrl(pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, env.CORE_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function fetchCoreJson(pathname: string, params: Record<string, string>) {
  const response = await fetch(buildCoreApiUrl(pathname, params));
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

async function requireAppAccess(secret: string, app_id: string) {
  const { ok, data } = await fetchCoreJson("/v1/oauth/access", { secret, app_id });
  return ok && data.success === true && data.allowed === true;
}

export function OauthRoutes(app: FastifyInstance) {
  async function createAppHandler(req: any, rep: any) {
    const body = parseBody(AppRegistration, req.body);
    const app_id = body.app_id;
    const app_name = body.app_name;
    const redirect_url = body.redirect_url;
    const secret_code = body.secret_code;
    const user_id = body.user_id;

    const allowed = await requireAppAccess(secret_code, app_id);
    if (!allowed)
      return rep
        .status(401)
        .send({ error: "You don't have permission to do this action!" });
    if (!app_id) return rep.status(400).send({ error: "app_id is required" });

    const a = await registerApp(
      app_id,
      app_name,
      user_id,
      redirect_url,
      body.description,
    );

    return a;
  }

  async function updateAppHandler(req: any, rep: any) {
    const body = parseBodyRaw(req.body);
    const app_id = String(body.app_id || "").trim();
    const secret_code = String(body.secret ?? body.secret_code ?? "").trim();

    const allowed = await requireAppAccess(secret_code, app_id);
    if (!allowed)
      return rep
        .status(401)
        .send({ error: "You don't have permission to do this action!" });
    if (!app_id) return rep.status(400).send({ error: "app_id is required" });

    const allowedFields = [
      "app_name",
      "description",
      "client_secret_hash",
    ];
    const setClauses: string[] = [];
    const values: Record<string, any> = { app_id };

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        setClauses.push(`${key} = :${key}`);
        values[key] = body[key];
      }
    }

    if (body.redirect_uris !== undefined || body.redirect_url !== undefined) {
      const redirectUris = normalizeRedirectUris(
        body.redirect_uris ?? body.redirect_url,
      );
      if (!redirectUris.length) {
        return rep.status(400).send({ error: "redirect_uris must include at least one URL" });
      }
      setClauses.push("redirect_uris = :redirect_uris");
      values.redirect_uris = JSON.stringify(redirectUris);
    }

    if (setClauses.length === 0) {
      return rep.status(400).send({ error: "No fields provided to update" });
    }

    const sql = `
      UPDATE oauth_apps
      SET ${setClauses.join(", ")}
      WHERE app_id = :app_id
    `;

    await q(sql, values);

    // This is nice to hve ig
    const updated = await q(`SELECT * FROM oauth_apps WHERE app_id = :app_id`, {
      app_id,
    });

    return { success: true, updated: updated[0] };
  }

  async function deleteAppHandler(req: any, rep: any) {
    const body = parseBody(AppRemoval, req.body);
    const secret_code = body.secret_code;
    const app_id = body.app_id;

    const allowed = await requireAppAccess(secret_code, app_id);
    if (!allowed)
      return rep
        .status(401)
        .send({ error: "You don't have permission to do this action!" });
    if (!app_id) return rep.status(400).send({ error: "app_id is required" });

    await q(`DELETE FROM oauth_apps WHERE app_id = :app_id`, { app_id });

    return { success: true, message: `App ${app_id} deleted successfully` };
  }

  async function generateLinkHandler(req: any, rep: any) {
    const { secret, app_id } = parseBody(GenerateLinkSchema, req.body);

    if (!(await requireAppAccess(secret, app_id))) {
      return rep
        .code(403)
        .send({ success: false, message: "App not allowed for this secret" });
    }

    const scopes = await q<{ scope: string }>(
      `SELECT os.scope FROM oauth_scopes os
       JOIN oauth_app_scopes oas ON os.id = oas.scope_id
       JOIN oauth_apps oa ON oas.oauth_app_id = oa.id
       WHERE oa.app_id = :app_id`,
      { app_id },
    );
    const scopeList = scopes.map((s) => s.scope);

    const oauthLinkToken = generateClientSecret();

    await q(
      `INSERT INTO oauth_links (token, app_id, secret_code, scopes, created_at)
      VALUES (:token, :app_id, :secret, :scopes, NOW())`,
      {
        token: oauthLinkToken,
        app_id,
        secret,
        scopes: JSON.stringify(scopeList),
      },
    );

    const oauthUrl = new URL("/v1/oauth/login/user", env.OAUTH_PUBLIC_URL);
    oauthUrl.searchParams.set("token", oauthLinkToken);

    return rep.send({
      success: true,
      oauth_link: oauthUrl.toString(),
      scopes: scopeList,
    });
  }

  app.post("/v1/manager/create-app", createAppHandler);
  app.post("/v1/apps", createAppHandler);
  app.put("/v1/manager/modify-app/info", updateAppHandler);
  app.patch("/v1/apps/:app_id", async (req: any, rep) => {
    const body = parseBodyRaw(req.body) || {};
    req.body = { ...body, app_id: req.params?.app_id };
    return updateAppHandler(req, rep);
  });
  app.delete("/v1/oauth-app", deleteAppHandler);
  app.delete("/v1/apps/:app_id", async (req: any, rep) => {
    const body = parseBodyRaw(req.body) || {};
    req.body = {
      ...body,
      app_id: req.params?.app_id,
      secret_code: body.secret_code ?? body.secret,
    };
    return deleteAppHandler(req, rep);
  });
  app.post("/v1/oauth/generate-link", generateLinkHandler);
  app.post("/v1/oauth/links", generateLinkHandler);
}
