import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { env } from "../env.js";

const NodeSyncBody = z.object({
  nodeServerId: z.string().min(1),
  baseUrl: z.string().url(),
  gatewayUrl: z.string().url().optional(),
  guilds: z.array(z.object({
    id: z.string().min(1),
    serverId: z.string().min(1),
    name: z.string().min(1)
  })).default([])
});

const NodeExtensionStateBody = z.object({
  nodeServerId: z.string().min(1),
  baseUrl: z.string().url().optional()
});

export async function nodeSyncRoutes(app: FastifyInstance) {
  if (!env.CORE_NODE_SYNC_SECRET) {
    app.log.warn("CORE_NODE_SYNC_SECRET not set; node sync route disabled");
    return;
  }

  app.post("/v1/internal/node-sync", async (req: any, rep) => {
    const secret = req.headers["x-node-sync-secret"];
    if (secret !== env.CORE_NODE_SYNC_SECRET) {
      return rep.code(401).send({ error: "INVALID_SYNC_SECRET" });
    }

    const parsed = NodeSyncBody.safeParse(req.body || {});
    if (!parsed.success) {
      return rep.code(400).send({ error: "INVALID_SYNC_BODY" });
    }

    const body = parsed.data;
    const uniqueServerIds = Array.from(new Set(body.guilds.map((g) => g.serverId)));

    if (uniqueServerIds.length) {
      for (const serverId of uniqueServerIds) {
        await q(
          `UPDATE servers
           SET base_url = :baseUrl,
               node_server_id = :nodeServerId,
               node_gateway_url = :gatewayUrl,
               node_guild_count = :guildCount,
               node_last_sync_at = NOW(),
               node_sync_status = 'online'
           WHERE id = :serverId`,
          {
            serverId,
            baseUrl: body.baseUrl,
            nodeServerId: body.nodeServerId,
            gatewayUrl: body.gatewayUrl ?? `${body.baseUrl.replace(/\/$/, "")}/gateway`,
            guildCount: body.guilds.filter((g) => g.serverId === serverId).length
          }
        );
      }
    }

    return rep.send({ ok: true, serversSynced: uniqueServerIds.length, guildsReported: body.guilds.length });
  });

  app.post("/v1/internal/node-extensions-state", async (req: any, rep) => {
    const secret = req.headers["x-node-sync-secret"];
    if (secret !== env.CORE_NODE_SYNC_SECRET) {
      return rep.code(401).send({ error: "INVALID_SYNC_SECRET" });
    }

    const parsed = NodeExtensionStateBody.safeParse(req.body || {});
    if (!parsed.success) {
      return rep.code(400).send({ error: "INVALID_SYNC_BODY" });
    }

    const body = parsed.data;
    const normalizedBaseUrl = String(body.baseUrl || "").replace(/\/$/, "");

    const rows = await q<{ server_id: string; manifest_json: string | null }>(
      `SELECT s.id AS server_id, se.manifest_json
       FROM servers s
       LEFT JOIN server_extensions se
         ON se.server_id = s.id
        AND se.enabled = 1
       WHERE s.node_server_id = :nodeServerId
          OR (:baseUrl <> '' AND TRIM(TRAILING '/' FROM s.base_url) = :baseUrl)
       ORDER BY s.id ASC, se.extension_id ASC`,
      { nodeServerId: body.nodeServerId, baseUrl: normalizedBaseUrl }
    );

    const grouped = new Map<string, any[]>();

    for (const row of rows) {
      if (!grouped.has(row.server_id)) grouped.set(row.server_id, []);
      if (!row.manifest_json) continue;
      try {
        const parsedManifest = JSON.parse(row.manifest_json);
        if (parsedManifest && typeof parsedManifest === "object") {
          grouped.get(row.server_id)?.push(parsedManifest);
        }
      } catch {
        // Skip malformed manifest rows and keep serving the rest.
      }
    }

    return rep.send({
      ok: true,
      servers: Array.from(grouped.entries()).map(([serverId, extensions]) => ({ serverId, extensions }))
    });
  });
}
