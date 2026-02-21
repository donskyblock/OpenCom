import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulidLike } from "@ods/shared/ids.js";
import { q } from "../db.js";
import { requireGuildMember } from "../auth/requireGuildMember.js";
import { resolveChannelPermissions } from "../permissions/resolve.js";
import { Perm, has } from "../permissions/bits.js";
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
    iconUrl: z.string().min(1).optional(),
    logoUrl: z.string().min(1).optional(),
    scope: z.enum(["client", "server", "both"]).optional(),
    permissions: z.array(z.string()).optional(),
    configDefaults: z.record(z.any()).optional()
  }))
});

const ExecuteCommandBody = z.object({
  args: z.record(z.any()).optional(),
  channelId: z.string().min(3).optional()
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
    iconUrl: z.string().min(1).optional(),
    logoUrl: z.string().min(1).optional(),
    scope: z.enum(["client", "server", "both"]).optional(),
    permissions: z.array(z.string()).optional(),
    configDefaults: z.record(z.any()).optional()
  })
});

function normalizeSenderName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 128);
}

function normalizeSenderAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 4096) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return trimmed;
      return null;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("users/")) return trimmed;
  return null;
}

function toExtensionResponseMessage(commandName: string, result: unknown) {
  if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
    const content = String(result).trim().slice(0, 4000);
    if (!content) return null;
    return { content, embeds: [] as Record<string, unknown>[] };
  }

  if (!result || typeof result !== "object") return null;
  const body: any = result;
  const embeds = Array.isArray(body.embeds)
    ? body.embeds
      .filter((embed: unknown) => embed && typeof embed === "object")
      .slice(0, 5) as Record<string, unknown>[]
    : [];
  const rawContent = typeof body.content === "string" ? body.content.trim() : "";
  const content = (rawContent || (embeds.length ? `/${commandName}` : "")).slice(0, 4000);
  if (!content && embeds.length === 0) return null;
  return { content, embeds };
}

function resolveExtensionSender(input: {
  extensionName: string;
  manifest: any;
  config: Record<string, unknown> | null;
  result: unknown;
}) {
  const resultObj = input.result && typeof input.result === "object" ? input.result as any : null;
  const senderObj = resultObj?.sender && typeof resultObj.sender === "object" ? resultObj.sender : null;
  const config = input.config || {};
  const displayName = normalizeSenderName(
    senderObj?.name
      ?? config.senderName
      ?? config.botName
      ?? input.manifest?.name
      ?? input.extensionName,
    input.extensionName
  );
  const avatarUrl = normalizeSenderAvatarUrl(
    senderObj?.avatarUrl
      ?? senderObj?.logoUrl
      ?? config.senderAvatarUrl
      ?? config.botAvatarUrl
      ?? config.logoUrl
      ?? input.manifest?.logoUrl
      ?? input.manifest?.iconUrl
  );
  return { displayName, avatarUrl };
}

export async function extensionRoutes(
  app: FastifyInstance,
  broadcastToChannel: (channelId: string, event: any) => void
) {
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
    const actorRoles = Array.isArray(req.auth.roles) ? req.auth.roles : [];
    const { commandName } = z.object({ commandName: z.string().min(3) }).parse(req.params);
    const body = ExecuteCommandBody.parse(req.body || {});

    try {
      const executed = await executeRegisteredCommand({
        serverId,
        userId,
        authToken: token,
        commandName,
        args: body.args || {}
      });

      const result = executed.result;
      const responseMessage = toExtensionResponseMessage(commandName, result);
      let postedMessage: { id: string; channelId: string; authorId: string; username: string; pfp_url: string | null; createdAt: string } | null = null;

      if (body.channelId && responseMessage) {
        const channelRows = await q<{ guild_id: string }>(
          `SELECT guild_id FROM channels WHERE id=:channelId LIMIT 1`,
          { channelId: body.channelId }
        );
        if (!channelRows.length) return rep.code(404).send({ error: "CHANNEL_NOT_FOUND" });
        const guildId = channelRows[0].guild_id;

        try {
          await requireGuildMember(guildId, userId, actorRoles, serverId);
        } catch {
          return rep.code(403).send({ error: "NOT_GUILD_MEMBER" });
        }

        const perms = await resolveChannelPermissions({ guildId, channelId: body.channelId, userId, roles: actorRoles });
        if (!has(perms, Perm.VIEW_CHANNEL) || !has(perms, Perm.SEND_MESSAGES)) {
          return rep.code(403).send({ error: "MISSING_PERMS" });
        }

        const extensionConfig = await getExtensionConfigForServer(serverId, executed.extensionId).catch(() => ({}));
        const sender = resolveExtensionSender({
          extensionName: executed.extensionName,
          manifest: executed.manifest,
          config: extensionConfig,
          result
        });

        const authorId = `ext:${executed.extensionId}`;
        const id = ulidLike();
        const createdAt = new Date().toISOString();

        await q(
          `INSERT INTO messages (id,channel_id,author_id,author_name,author_avatar_url,content,embeds_json,created_at)
           VALUES (:id,:channelId,:authorId,:authorName,:authorAvatarUrl,:content,:embedsJson,:createdAt)`,
          {
            id,
            channelId: body.channelId,
            authorId,
            authorName: sender.displayName,
            authorAvatarUrl: sender.avatarUrl,
            content: responseMessage.content,
            embedsJson: JSON.stringify(responseMessage.embeds),
            createdAt: createdAt.slice(0, 19).replace("T", " ")
          }
        );

        postedMessage = {
          id,
          channelId: body.channelId,
          authorId,
          username: sender.displayName,
          pfp_url: sender.avatarUrl,
          createdAt
        };

        broadcastToChannel(body.channelId, {
          channelId: body.channelId,
          message: {
            id,
            authorId,
            username: sender.displayName,
            pfp_url: sender.avatarUrl,
            content: responseMessage.content,
            embeds: responseMessage.embeds,
            linkEmbeds: [],
            attachments: [],
            mentionEveryone: false,
            mentions: [],
            createdAt
          }
        });
      }

      return {
        ok: true,
        commandName,
        result,
        extensionId: executed.extensionId,
        extensionName: executed.extensionName,
        postedMessage
      };
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
