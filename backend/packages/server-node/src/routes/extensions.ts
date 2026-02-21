import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import {
  activateExtensionForServer,
  deactivateExtensionForServer,
  executeRegisteredCommand,
  getExtensionConfigForServer,
  listCommandsForServer,
  readServerExtensionCatalog,
  setExtensionConfigForServer,
  syncExtensionsForServer
} from "../extensions/host.js";

const SyncExtensionsBody = z.object({
  extensions: z.array(z.object({
    id: z.string().min(2),
    name: z.string().min(1),
    version: z.string().min(1),
    author: z.string().min(1).optional(),
    description: z.string().optional(),
    entry: z.string().optional(),
    scope: z.enum(["client", "server", "both"]).optional(),
    permissions: z.array(z.string()).optional(),
    configDefaults: z.record(z.any()).optional()
  }))
});

const ExecuteCommandBody = z.object({
  args: z.record(z.any()).optional()
});

const ExtensionConfigBody = z.object({
  config: z.record(z.any()).default({}),
  mode: z.enum(["replace", "patch"]).optional().default("replace")
});

const ActivateExtensionBody = z.object({
  extension: z.object({
    id: z.string().min(2),
    name: z.string().min(1),
    version: z.string().min(1),
    author: z.string().min(1).optional(),
    description: z.string().optional(),
    entry: z.string().optional(),
    scope: z.enum(["client", "server", "both"]).optional(),
    permissions: z.array(z.string()).optional(),
    configDefaults: z.record(z.any()).optional()
  })
});

export async function extensionRoutes(app: FastifyInstance) {
  app.get("/v1/extensions/catalog", { preHandler: [app.authenticate] } as any, async () => {
    const extensions = await readServerExtensionCatalog();
    return { extensions };
  });

  app.get("/v1/extensions", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const serverId = req.auth.coreServerId as string;
    const rows = await q<{ manifest_json: string }>(
      `SELECT manifest_json FROM server_extensions_state WHERE core_server_id=:serverId LIMIT 1`,
      { serverId }
    );

    return {
      extensions: rows.length ? JSON.parse(rows[0].manifest_json || "[]") : []
    };
  });

  app.get("/v1/extensions/commands", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const serverId = req.auth.coreServerId as string;
    return { commands: listCommandsForServer(serverId) };
  });

  app.get("/v1/extensions/:extensionId/config", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const serverId = req.auth.coreServerId as string;
    const { extensionId } = z.object({ extensionId: z.string().min(2) }).parse(req.params);
    const config = await getExtensionConfigForServer(serverId, extensionId);
    return { extensionId, config };
  });

  app.put("/v1/extensions/:extensionId/config", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const serverId = req.auth.coreServerId as string;
    const actorRoles = req.auth.roles || [];
    if (!actorRoles.includes("owner") && !actorRoles.includes("platform_admin") && !actorRoles.includes("platform_owner")) {
      return rep.code(403).send({ error: "NOT_OWNER" });
    }

    const { extensionId } = z.object({ extensionId: z.string().min(2) }).parse(req.params);
    const body = ExtensionConfigBody.parse(req.body || {});
    const config = await setExtensionConfigForServer(serverId, extensionId, body.config, body.mode);
    return { ok: true, extensionId, config };
  });

  app.post("/v1/extensions/commands/:commandName/execute", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const serverId = req.auth.coreServerId as string;
    const userId = req.auth.userId as string;
    const token = req.auth.token as string | undefined;
    const { commandName } = z.object({ commandName: z.string().min(3) }).parse(req.params);
    const body = ExecuteCommandBody.parse(req.body || {});

    try {
      const result = await executeRegisteredCommand({
        serverId,
        userId,
        authToken: token,
        commandName,
        args: body.args || {}
      });
      return { ok: true, commandName, result };
    } catch (error: any) {
      if (error?.message === "COMMAND_NOT_FOUND") {
        return rep.code(404).send({ error: "COMMAND_NOT_FOUND" });
      }
      if (error?.message === "COMMAND_AMBIGUOUS") {
        return rep.code(409).send({ error: "COMMAND_AMBIGUOUS" });
      }
      app.log.error({ err: error, serverId, userId, commandName }, "Extension command execution failed");
      return rep.code(500).send({ error: "COMMAND_EXECUTION_FAILED" });
    }
  });

  app.post("/v1/extensions/sync", { preHandler: [app.authenticate] } as any, async (req: any) => {
    const serverId = req.auth.coreServerId as string;
    const body = SyncExtensionsBody.parse(req.body);

    await syncExtensionsForServer(serverId, body.extensions);
    return { ok: true, serverId, count: body.extensions.length };
  });

  app.post("/v1/extensions/activate", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const serverId = req.auth.coreServerId as string;
    const actorRoles = req.auth.roles || [];
    if (!actorRoles.includes("owner") && !actorRoles.includes("platform_admin") && !actorRoles.includes("platform_owner")) {
      return rep.code(403).send({ error: "NOT_OWNER" });
    }
    const body = ActivateExtensionBody.parse(req.body || {});
    await activateExtensionForServer(serverId, body.extension, req.auth.token as string | undefined);
    return { ok: true, serverId, extensionId: body.extension.id };
  });

  app.post("/v1/extensions/:extensionId/deactivate", { preHandler: [app.authenticate] } as any, async (req: any, rep) => {
    const serverId = req.auth.coreServerId as string;
    const actorRoles = req.auth.roles || [];
    if (!actorRoles.includes("owner") && !actorRoles.includes("platform_admin") && !actorRoles.includes("platform_owner")) {
      return rep.code(403).send({ error: "NOT_OWNER" });
    }
    const { extensionId } = z.object({ extensionId: z.string().min(2) }).parse(req.params);
    await deactivateExtensionForServer(serverId, extensionId);
    return { ok: true, serverId, extensionId };
  });
}
