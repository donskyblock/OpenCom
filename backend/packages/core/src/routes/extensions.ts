import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { signMembershipToken } from "../membershipToken.js";
import { parseBody } from "../validation.js";
import { env } from "../env.js";

type ExtensionScope = "client" | "server" | "both";

type ExtensionManifest = {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  scope: ExtensionScope;
  entry?: string;
  permissions?: string[];
  configDefaults?: Record<string, unknown>;
};

const SetExtensionState = z.object({
  enabled: z.boolean()
});

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function findExtensionsRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(current, "Extensions");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(process.cwd(), "Extensions");
}

async function readExtensionCatalog(): Promise<{ clientExtensions: ExtensionManifest[]; serverExtensions: ExtensionManifest[] }> {
  const root = findExtensionsRoot();
  const clientDir = path.join(root, "Client");
  const serverDir = path.join(root, "Server");

  async function readDirCatalog(dirPath: string, scope: ExtensionScope): Promise<ExtensionManifest[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        const manifestPath = path.join(dirPath, entry.name, "extension.json");
        const parsed = await readJsonFile<Partial<ExtensionManifest>>(manifestPath);
        const id = safeId(parsed?.id || entry.name);
        return {
          id,
          name: parsed?.name || entry.name,
          version: parsed?.version || "0.1.0",
          author: parsed?.author,
          description: parsed?.description,
          scope: parsed?.scope || scope,
          entry: parsed?.entry || "index.js",
          permissions: Array.isArray(parsed?.permissions) ? parsed?.permissions : ["all"],
          configDefaults: parsed?.configDefaults && typeof parsed.configDefaults === "object" ? parsed.configDefaults as Record<string, unknown> : {}
        } as ExtensionManifest;
      }));
      return manifests.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  return {
    clientExtensions: await readDirCatalog(clientDir, "client"),
    serverExtensions: await readDirCatalog(serverDir, "server")
  };
}

async function getPlatformRole(userId: string): Promise<"user" | "admin" | "owner"> {
  const founder = await q<{ founder_user_id: string | null }>(`SELECT founder_user_id FROM platform_config WHERE id=1`);
  if (founder.length && founder[0].founder_user_id === userId) return "owner";
  const admin = await q<{ user_id: string }>(`SELECT user_id FROM platform_admins WHERE user_id=:userId`, { userId });
  if (admin.length) return "admin";
  return "user";
}

function uniqueRoles(roles: string[]) {
  return Array.from(new Set((roles || []).filter((role) => typeof role === "string" && role.trim())));
}

function buildNodeScopedRoles(input: {
  memberRoles: string[];
  userId: string;
  serverOwnerUserId: string;
  platformRole: "user" | "admin" | "owner";
}) {
  const roles = uniqueRoles(input.memberRoles || []);
  if (input.serverOwnerUserId === input.userId && !roles.includes("owner")) roles.push("owner");
  if (input.platformRole === "admin" && !roles.includes("platform_admin")) roles.push("platform_admin");
  if (input.platformRole === "owner") {
    if (!roles.includes("platform_admin")) roles.push("platform_admin");
    if (!roles.includes("platform_owner")) roles.push("platform_owner");
  }
  return uniqueRoles(roles);
}

function resolveNodeServerId(serverId: string, baseUrl: string) {
  if (env.OFFICIAL_NODE_BASE_URL && env.OFFICIAL_NODE_SERVER_ID && baseUrl === env.OFFICIAL_NODE_BASE_URL) {
    return env.OFFICIAL_NODE_SERVER_ID;
  }
  return serverId;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3) {
  let lastError: any = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;

      const text = await response.text().catch(() => "");
      const message = `NODE_HTTP_${response.status}${text ? `:${text.slice(0, 300)}` : ""}`;
      const retryable = response.status >= 500 || response.status === 429;
      if (!retryable || attempt >= attempts) throw new Error(message);
      lastError = new Error(message);
    } catch (error: any) {
      lastError = error;
      if (attempt >= attempts) throw error;
    }
    await delay(150 * attempt);
  }
  throw lastError || new Error("NODE_REQUEST_FAILED");
}

export async function extensionRoutes(app: FastifyInstance) {
  app.get("/v1/extensions/catalog", { preHandler: [app.authenticate] } as any, async () => {
    return readExtensionCatalog();
  });

  app.get("/v1/extensions/client/:extensionId/source", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const { extensionId } = z.object({ extensionId: z.string().min(2) }).parse(req.params);
    const normalizedId = safeId(extensionId);
    const catalog = await readExtensionCatalog();
    const manifest = catalog.clientExtensions.find((ext) => ext.id === normalizedId);
    if (!manifest) return rep.code(404).send({ error: "EXTENSION_NOT_FOUND" });

    const root = findExtensionsRoot();
    const extensionDir = path.join(root, "Client", manifest.id);
    const entryFile = path.basename(manifest.entry || "index.js");
    const sourcePath = path.join(extensionDir, entryFile);

    try {
      const source = await fs.readFile(sourcePath, "utf8");
      rep.header("Content-Type", "application/javascript; charset=utf-8");
      return source;
    } catch {
      return rep.code(404).send({ error: "EXTENSION_ENTRY_NOT_FOUND" });
    }
  });

  app.get("/v1/servers/:serverId/extensions", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId } = z.object({ serverId: z.string().min(3) }).parse(req.params);

    const membership = await q<{ roles: string }>(
      `SELECT roles FROM memberships WHERE server_id=:serverId AND user_id=:userId LIMIT 1`,
      { serverId, userId }
    );
    if (!membership.length) return rep.code(403).send({ error: "NOT_A_MEMBER" });

    const rows = await q<{ extension_id: string; enabled: number; manifest_json: string }>(
      `SELECT extension_id, enabled, manifest_json FROM server_extensions WHERE server_id=:serverId ORDER BY extension_id ASC`,
      { serverId }
    );

    return {
      extensions: rows.map((row) => ({
        extensionId: row.extension_id,
        enabled: Boolean(row.enabled),
        manifest: JSON.parse(row.manifest_json || "{}")
      }))
    };
  });

  app.get("/v1/servers/:serverId/extensions/:extensionId/config", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId, extensionId } = z.object({ serverId: z.string().min(3), extensionId: z.string().min(2) }).parse(req.params);

    const memberRows = await q<{ roles: string }>(
      `SELECT roles FROM memberships WHERE server_id=:serverId AND user_id=:userId LIMIT 1`,
      { serverId, userId }
    );
    if (!memberRows.length) return rep.code(403).send({ error: "NOT_A_MEMBER" });

    const serverRows = await q<{ base_url: string; owner_user_id: string }>(
      `SELECT base_url, owner_user_id FROM servers WHERE id=:serverId LIMIT 1`,
      { serverId }
    );
    const baseUrl = serverRows[0]?.base_url;
    if (!baseUrl) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });

    const memberRoles: string[] = JSON.parse(memberRows[0].roles || "[]");
    const platformRole = await getPlatformRole(userId);
    const nodeServerId = resolveNodeServerId(serverId, baseUrl);
    const token = await signMembershipToken(nodeServerId, userId, memberRoles, platformRole, serverId);

    try {
      const response = await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/v1/extensions/${encodeURIComponent(extensionId)}/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.json();
    } catch (error) {
      app.log.warn({ err: error, serverId, extensionId }, "Failed to fetch extension config from node");
      return rep.code(502).send({ error: "NODE_UNREACHABLE" });
    }
  });

  app.put("/v1/servers/:serverId/extensions/:extensionId/config", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId, extensionId } = z.object({ serverId: z.string().min(3), extensionId: z.string().min(2) }).parse(req.params);
    const body = parseBody(z.object({ config: z.record(z.any()).default({}), mode: z.enum(["replace", "patch"]).default("replace") }), req.body);

    const memberRows = await q<{ roles: string }>(
      `SELECT roles FROM memberships WHERE server_id=:serverId AND user_id=:userId LIMIT 1`,
      { serverId, userId }
    );
    if (!memberRows.length) return rep.code(403).send({ error: "NOT_A_MEMBER" });

    const memberRoles: string[] = JSON.parse(memberRows[0].roles || "[]");
    const platformRole = await getPlatformRole(userId);
    const serverRows = await q<{ base_url: string; owner_user_id: string }>(
      `SELECT base_url, owner_user_id FROM servers WHERE id=:serverId LIMIT 1`,
      { serverId }
    );
    const baseUrl = serverRows[0]?.base_url;
    if (!baseUrl) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });
    const isServerOwner = serverRows[0]?.owner_user_id === userId;
    const isOwnerOrStaff = memberRoles.includes("owner") || isServerOwner || platformRole === "admin" || platformRole === "owner";
    if (!isOwnerOrStaff) return rep.code(403).send({ error: "NOT_OWNER" });

    const effectiveRoles = buildNodeScopedRoles({
      memberRoles,
      userId,
      serverOwnerUserId: serverRows[0].owner_user_id,
      platformRole
    });
    const nodeServerId = resolveNodeServerId(serverId, baseUrl);
    const token = await signMembershipToken(nodeServerId, userId, effectiveRoles, platformRole, serverId);
    try {
      const response = await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/v1/extensions/${encodeURIComponent(extensionId)}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      return response.json();
    } catch (error) {
      app.log.warn({ err: error, serverId, extensionId }, "Failed to update extension config on node");
      return rep.code(502).send({ error: "NODE_UNREACHABLE" });
    }
  });

  app.post("/v1/servers/:serverId/extensions/:extensionId", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const userId = req.user.sub as string;
    const { serverId, extensionId } = z.object({ serverId: z.string().min(3), extensionId: z.string().min(2) }).parse(req.params);
    const body = parseBody(SetExtensionState, req.body);

    const memberRows = await q<{ roles: string }>(
      `SELECT roles FROM memberships WHERE server_id=:serverId AND user_id=:userId LIMIT 1`,
      { serverId, userId }
    );
    if (!memberRows.length) return rep.code(403).send({ error: "NOT_A_MEMBER" });

    const memberRoles: string[] = JSON.parse(memberRows[0].roles || "[]");
    const platformRole = await getPlatformRole(userId);
    const serverRows = await q<{ base_url: string; owner_user_id: string }>(
      `SELECT base_url, owner_user_id FROM servers WHERE id=:serverId LIMIT 1`,
      { serverId }
    );
    if (!serverRows.length) return rep.code(404).send({ error: "SERVER_NOT_FOUND" });
    const isServerOwner = serverRows[0].owner_user_id === userId;
    const isOwnerOrStaff = memberRoles.includes("owner") || isServerOwner || platformRole === "admin" || platformRole === "owner";
    if (!isOwnerOrStaff) return rep.code(403).send({ error: "NOT_OWNER" });
    const baseUrl = serverRows[0].base_url;
    if (!baseUrl) return rep.code(502).send({ error: "NODE_UNREACHABLE" });

    const catalog = await readExtensionCatalog();
    const manifest = catalog.serverExtensions.find((ext) => ext.id === safeId(extensionId));
    if (!manifest) return rep.code(404).send({ error: "EXTENSION_NOT_FOUND" });

    await q(
      `INSERT INTO server_extensions (server_id, extension_id, enabled, manifest_json)
       VALUES (:serverId, :extensionId, :enabled, :manifestJson)
       ON DUPLICATE KEY UPDATE enabled=:enabled, manifest_json=:manifestJson, updated_at=NOW()`,
      {
        serverId,
        extensionId: manifest.id,
        enabled: body.enabled ? 1 : 0,
        manifestJson: JSON.stringify(manifest)
      }
    );

    try {
      const effectiveRoles = buildNodeScopedRoles({
        memberRoles,
        userId,
        serverOwnerUserId: serverRows[0].owner_user_id,
        platformRole
      });
      const nodeServerId = resolveNodeServerId(serverId, baseUrl);
      const token = await signMembershipToken(nodeServerId, userId, effectiveRoles, platformRole, serverId);
      const activateBody = JSON.stringify({ extension: manifest });
      const deactivateBody = "{}";
      if (body.enabled) {
        await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/v1/extensions/activate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: activateBody
        });
      } else {
        await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/v1/extensions/${encodeURIComponent(manifest.id)}/deactivate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: deactivateBody
        });
      }

      // Keep node state coherent by forcing a full sync after point updates.
      const activeRows = await q<{ manifest_json: string }>(
        `SELECT manifest_json FROM server_extensions WHERE server_id=:serverId AND enabled=1`,
        { serverId }
      );
      const syncBody = JSON.stringify({ extensions: activeRows.map((row) => JSON.parse(row.manifest_json || "{}")) });
      await fetchWithRetry(`${baseUrl.replace(/\/$/, "")}/v1/extensions/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: syncBody
      });
    } catch (error) {
      app.log.warn({ err: error, serverId }, "Failed to sync extension state to server node");
      return rep.code(502).send({ error: "NODE_EXTENSION_SYNC_FAILED" });
    }

    return { ok: true, extensionId: manifest.id, enabled: body.enabled };
  });
}
