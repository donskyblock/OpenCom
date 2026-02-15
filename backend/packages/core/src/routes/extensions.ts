import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { signMembershipToken } from "../membershipToken.js";
import { parseBody } from "../validation.js";

type ExtensionScope = "client" | "server" | "both";

type ExtensionManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  scope: ExtensionScope;
  entry?: string;
  permissions?: string[];
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
          description: parsed?.description,
          scope: parsed?.scope || scope,
          entry: parsed?.entry || "index.js",
          permissions: Array.isArray(parsed?.permissions) ? parsed?.permissions : ["all"]
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
    const isOwnerOrStaff = memberRoles.includes("owner") || platformRole === "admin" || platformRole === "owner";
    if (!isOwnerOrStaff) return rep.code(403).send({ error: "NOT_OWNER" });

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

    const serverRows = await q<{ base_url: string }>(`SELECT base_url FROM servers WHERE id=:serverId LIMIT 1`, { serverId });
    const baseUrl = serverRows[0]?.base_url;
    if (baseUrl) {
      try {
        const activeRows = await q<{ manifest_json: string }>(
          `SELECT manifest_json FROM server_extensions WHERE server_id=:serverId AND enabled=1`,
          { serverId }
        );
        const token = await signMembershipToken(serverId, userId, memberRoles, platformRole, serverId);
        await fetch(`${baseUrl.replace(/\/$/, "")}/v1/extensions/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            extensions: activeRows.map((row) => JSON.parse(row.manifest_json || "{}"))
          })
        });
      } catch (error) {
        app.log.warn({ err: error, serverId }, "Failed to sync extension state to server node");
      }
    }

    return { ok: true, extensionId: manifest.id, enabled: body.enabled };
  });
}
