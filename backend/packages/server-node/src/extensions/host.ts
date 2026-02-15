import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { q } from "../db.js";
import { env } from "../env.js";

export type ServerExtensionManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry?: string;
  scope?: "server" | "client" | "both";
  permissions?: string[];
};

type CommandOption = {
  type: "string" | "number" | "boolean";
  name: string;
  description?: string;
  required?: boolean;
};

type ExtensionCommand = {
  name: string;
  description?: string;
  options?: CommandOption[];
  execute: (ctx: {
    userId: string;
    serverId: string;
    args: Record<string, unknown>;
    apis: {
      core: OpenComRequestClient;
      node: OpenComRequestClient;
    };
    meta: {
      extensionId: string;
      commandName: string;
    };
  }) => Promise<unknown> | unknown;
};

type OpenComRequestClient = {
  get: (path: string, init?: RequestInit) => Promise<any>;
  post: (path: string, body?: unknown, init?: RequestInit) => Promise<any>;
  patch: (path: string, body?: unknown, init?: RequestInit) => Promise<any>;
  del: (path: string, init?: RequestInit) => Promise<any>;
};

type ExtensionModule = {
  activate?: (ctx: { serverId: string; log: Console; permissions: string[] }) => Promise<void> | void;
  deactivate?: (ctx: { serverId: string; log: Console }) => Promise<void> | void;
  commands?: ExtensionCommand[];
};

type RegisteredCommand = {
  extensionId: string;
  extensionName: string;
  command: ExtensionCommand;
};

const loadedByServer = new Map<string, Map<string, ExtensionModule>>();
const commandRegistryByServer = new Map<string, Map<string, RegisteredCommand>>();

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

function makeEntryFile(manifest: ServerExtensionManifest): string {
  const root = findExtensionsRoot();
  const entry = manifest.entry || "index.js";
  return path.resolve(root, "Server", manifest.id, entry);
}

function withJsonHeaders(init: RequestInit = {}) {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  };
}

function buildClient(baseUrl: string, authToken?: string): OpenComRequestClient {
  async function req(pathValue: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${pathValue}`, {
      ...withJsonHeaders(init),
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : undefined,
        ...(withJsonHeaders(init).headers || {})
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`EXTENSION_API_${response.status}${text ? `:${text}` : ""}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return response.text();
  }

  return {
    get: (pathValue, init = {}) => req(pathValue, { ...init, method: "GET" }),
    post: (pathValue, body, init = {}) => req(pathValue, { ...init, method: "POST", body: JSON.stringify(body ?? {}) }),
    patch: (pathValue, body, init = {}) => req(pathValue, { ...init, method: "PATCH", body: JSON.stringify(body ?? {}) }),
    del: (pathValue, init = {}) => req(pathValue, { ...init, method: "DELETE" })
  };
}

function registerCommands(serverId: string, manifest: ServerExtensionManifest, commands: ExtensionCommand[] = []) {
  const registry = commandRegistryByServer.get(serverId) || new Map<string, RegisteredCommand>();

  for (const command of commands) {
    if (!command?.name || typeof command.execute !== "function") continue;
    const namespaced = `${manifest.id}.${command.name}`;
    registry.set(namespaced, {
      extensionId: manifest.id,
      extensionName: manifest.name,
      command
    });
  }

  commandRegistryByServer.set(serverId, registry);
}

export function listCommandsForServer(serverId: string) {
  const registry = commandRegistryByServer.get(serverId) || new Map<string, RegisteredCommand>();
  return Array.from(registry.entries()).map(([name, registered]) => ({
    name,
    description: registered.command.description || "",
    options: registered.command.options || [],
    extensionId: registered.extensionId,
    extensionName: registered.extensionName
  }));
}

export async function executeRegisteredCommand(input: {
  serverId: string;
  commandName: string;
  args?: Record<string, unknown>;
  userId: string;
  authToken?: string;
}) {
  const registry = commandRegistryByServer.get(input.serverId) || new Map<string, RegisteredCommand>();
  const found = registry.get(input.commandName);
  if (!found) throw new Error("COMMAND_NOT_FOUND");

  const nodeBaseUrl = `http://127.0.0.1:${env.NODE_PORT}`;
  const apis = {
    core: buildClient(env.CORE_BASE_URL, input.authToken),
    node: buildClient(nodeBaseUrl, input.authToken)
  };

  return found.command.execute({
    userId: input.userId,
    serverId: input.serverId,
    args: input.args || {},
    apis,
    meta: {
      extensionId: found.extensionId,
      commandName: input.commandName
    }
  });
}

export async function syncExtensionsForServer(serverId: string, manifests: ServerExtensionManifest[]) {
  const prevMap = loadedByServer.get(serverId) || new Map<string, ExtensionModule>();
  const nextMap = new Map<string, ExtensionModule>();
  commandRegistryByServer.set(serverId, new Map<string, RegisteredCommand>());

  for (const manifest of manifests) {
    try {
      const entry = makeEntryFile(manifest);
      const fileUrl = `file://${entry}`;
      const mod = (await import(fileUrl)) as ExtensionModule;
      if (mod.activate) {
        await mod.activate({ serverId, log: console, permissions: manifest.permissions || ["all"] });
      }
      registerCommands(serverId, manifest, mod.commands || []);
      nextMap.set(manifest.id, mod);
      console.log(`[extensions] activated ${manifest.id} on server ${serverId}`);
    } catch (error) {
      console.error(`[extensions] failed to load ${manifest.id} for server ${serverId}`, error);
    }
  }

  for (const [extensionId, mod] of prevMap.entries()) {
    if (!nextMap.has(extensionId) && mod.deactivate) {
      try {
        await mod.deactivate({ serverId, log: console });
      } catch (error) {
        console.error(`[extensions] failed to deactivate ${extensionId} for server ${serverId}`, error);
      }
    }
  }

  loadedByServer.set(serverId, nextMap);

  await q(
    `INSERT INTO server_extensions_state (core_server_id, manifest_json)
     VALUES (:serverId, :manifestJson)
     ON DUPLICATE KEY UPDATE manifest_json=:manifestJson, updated_at=NOW()`,
    {
      serverId,
      manifestJson: JSON.stringify(manifests)
    }
  );
}

export async function restorePersistedExtensions() {
  const rows = await q<{ core_server_id: string; manifest_json: string }>(
    `SELECT core_server_id, manifest_json FROM server_extensions_state`
  );

  for (const row of rows) {
    const manifests = JSON.parse(row.manifest_json || "[]") as ServerExtensionManifest[];
    await syncExtensionsForServer(row.core_server_id, manifests);
  }
}

export async function readServerExtensionCatalog() {
  const root = findExtensionsRoot();
  const dirPath = path.join(root, "Server");

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const manifestPath = path.join(dirPath, entry.name, "extension.json");
      try {
        const raw = await fs.readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw) as Partial<ServerExtensionManifest>;
        return {
          id: parsed.id || entry.name,
          name: parsed.name || entry.name,
          version: parsed.version || "0.1.0",
          description: parsed.description,
          entry: parsed.entry || "index.js",
          scope: parsed.scope || "server",
          permissions: Array.isArray(parsed.permissions) ? parsed.permissions : ["all"]
        } as ServerExtensionManifest;
      } catch {
        return {
          id: entry.name,
          name: entry.name,
          version: "0.1.0",
          scope: "server",
          entry: "index.js",
          permissions: ["all"]
        } as ServerExtensionManifest;
      }
    }));
  } catch {
    return [] as ServerExtensionManifest[];
  }
}
