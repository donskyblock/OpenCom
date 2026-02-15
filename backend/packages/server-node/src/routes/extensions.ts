import { FastifyInstance } from "fastify";
import { z } from "zod";
import { q } from "../db.js";
import { executeRegisteredCommand, listCommandsForServer, readServerExtensionCatalog, syncExtensionsForServer } from "../extensions/host.js";

const SyncExtensionsBody = z.object({
  extensions: z.array(z.object({
    id: z.string().min(2),
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    entry: z.string().optional(),
    scope: z.enum(["client", "server", "both"]).optional(),
    permissions: z.array(z.string()).optional()
  }))
});

const ExecuteCommandBody = z.object({
  args: z.record(z.any()).optional()
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
}
