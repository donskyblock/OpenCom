import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { q } from "../db.js";
import { env } from "../env.js";

export type ServerExtensionManifest = {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  entry?: string;
  scope?: "server" | "client" | "both";
  permissions?: string[];
  configDefaults?: Record<string, unknown>;
};

type CommandOption = {
  type: "string" | "number" | "boolean";
  name: string;
  description?: string;
  required?: boolean;
};

type ExtensionConfigApi = {
  get: () => Promise<Record<string, unknown>>;
  set: (next: Record<string, unknown>) => Promise<Record<string, unknown>>;
  patch: (partial: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type ExtensionCommand = {
  name: string;
  description?: string;
  options?: CommandOption[];
  execute: (ctx: {
    userId: string;
    serverId: string;
    args: Record<string, unknown>;
    config: ExtensionConfigApi;
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
  activate?: (ctx: {
    serverId: string;
    log: Console;
    permissions: string[];
    config: ExtensionConfigApi;
    apis: {
      core: OpenComRequestClient;
      node: OpenComRequestClient;
    };
    meta: {
      extensionId: string;
      extensionName: string;
      version: string;
      author?: string;
    };
  }) => Promise<void> | void;
  deactivate?: (ctx: {
    serverId: string;
    log: Console;
    meta: {
      extensionId: string;
      extensionName: string;
      version: string;
      author?: string;
    };
  }) => Promise<void> | void;
  commands?: ExtensionCommand[];
};

type RegisteredCommand = {
  extensionId: string;
  extensionName: string;
  command: ExtensionCommand;
};

type LoadedExtension = {
  manifest: ServerExtensionManifest;
  module: ExtensionModule;
};

const loadedByServer = new Map<string, Map<string, LoadedExtension>>();
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
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return {
    ...init,
    headers
  };
}

function buildClient(baseUrl: string, authToken?: string): OpenComRequestClient {
  async function req(pathValue: string, init: RequestInit = {}) {
    const requestInit = withJsonHeaders(init);
    const headers = new Headers(requestInit.headers);
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${pathValue}`, { ...requestInit, headers });

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

async function readExtensionConfig(serverId: string, extensionId: string, defaults?: Record<string, unknown>) {
  const rows = await q<{ config_json: string }>(
    `SELECT config_json
     FROM server_extension_configs
     WHERE core_server_id=:serverId AND extension_id=:extensionId
     LIMIT 1`,
    { serverId, extensionId }
  );
  const parsed = rows.length ? JSON.parse(rows[0].config_json || "{}") : {};
  const base = defaults && typeof defaults === "object" ? defaults : {};
  return { ...base, ...(parsed && typeof parsed === "object" ? parsed : {}) } as Record<string, unknown>;
}

async function writeExtensionConfig(serverId: string, extensionId: string, config: Record<string, unknown>) {
  await q(
    `INSERT INTO server_extension_configs (core_server_id, extension_id, config_json)
     VALUES (:serverId, :extensionId, :configJson)
     ON DUPLICATE KEY UPDATE config_json=:configJson, updated_at=NOW()`,
    { serverId, extensionId, configJson: JSON.stringify(config || {}) }
  );
  return config;
}

function createConfigApi(serverId: string, manifest: ServerExtensionManifest): ExtensionConfigApi {
  const extensionId = manifest.id;
  const defaults = manifest.configDefaults || {};
  return {
    get: () => readExtensionConfig(serverId, extensionId, defaults),
    set: async (next) => {
      const merged = { ...defaults, ...(next || {}) };
      return writeExtensionConfig(serverId, extensionId, merged);
    },
    patch: async (partial) => {
      const current = await readExtensionConfig(serverId, extensionId, defaults);
      const merged = { ...current, ...(partial || {}) };
      return writeExtensionConfig(serverId, extensionId, merged);
    }
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

function unregisterExtensionCommands(serverId: string, extensionId: string) {
  const registry = commandRegistryByServer.get(serverId);
  if (!registry) return;
  for (const [key, value] of registry.entries()) {
    if (value.extensionId === extensionId) registry.delete(key);
  }
  commandRegistryByServer.set(serverId, registry);
}

async function importExtensionModule(manifest: ServerExtensionManifest): Promise<ExtensionModule> {
  const entry = makeEntryFile(manifest);
  const stat = await fs.stat(entry).catch(() => null);
  const versionTag = stat ? String(Math.floor(stat.mtimeMs)) : String(Date.now());
  const fileUrl = `file://${entry}?v=${versionTag}`;
  return (await import(fileUrl)) as ExtensionModule;
}

async function activateLoadedExtension(serverId: string, manifest: ServerExtensionManifest, authToken?: string) {
  const nodeBaseUrl = `http://127.0.0.1:${env.NODE_PORT}`;
  const apis = {
    core: buildClient(env.CORE_BASE_URL, authToken),
    node: buildClient(nodeBaseUrl, authToken)
  };
  const config = createConfigApi(serverId, manifest);
  const module = await importExtensionModule(manifest);

  if (module.activate) {
    await module.activate({
      serverId,
      log: console,
      permissions: manifest.permissions || ["all"],
      config,
      apis,
      meta: {
        extensionId: manifest.id,
        extensionName: manifest.name,
        version: manifest.version,
        author: manifest.author
      }
    });
  }

  registerCommands(serverId, manifest, module.commands || []);
  return module;
}

async function deactivateLoadedExtension(serverId: string, loaded: LoadedExtension | undefined) {
  if (!loaded) return;
  unregisterExtensionCommands(serverId, loaded.manifest.id);
  if (!loaded.module.deactivate) return;

  await loaded.module.deactivate({
    serverId,
    log: console,
    meta: {
      extensionId: loaded.manifest.id,
      extensionName: loaded.manifest.name,
      version: loaded.manifest.version,
      author: loaded.manifest.author
    }
  });
}

async function persistManifests(serverId: string, manifests: ServerExtensionManifest[]) {
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

export async function getExtensionConfigForServer(serverId: string, extensionId: string) {
  const loaded = loadedByServer.get(serverId)?.get(extensionId);
  const defaults = loaded?.manifest?.configDefaults || {};
  return readExtensionConfig(serverId, extensionId, defaults);
}

export async function setExtensionConfigForServer(
  serverId: string,
  extensionId: string,
  next: Record<string, unknown>,
  mode: "replace" | "patch" = "replace"
) {
  const loaded = loadedByServer.get(serverId)?.get(extensionId);
  const defaults = loaded?.manifest?.configDefaults || {};
  if (mode === "patch") {
    const current = await readExtensionConfig(serverId, extensionId, defaults);
    return writeExtensionConfig(serverId, extensionId, { ...current, ...(next || {}) });
  }
  return writeExtensionConfig(serverId, extensionId, { ...defaults, ...(next || {}) });
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
  const loaded = loadedByServer.get(input.serverId)?.get(found.extensionId);
  const config = createConfigApi(input.serverId, loaded?.manifest || {
    id: found.extensionId,
    name: found.extensionName,
    version: "0.1.0"
  });

  return found.command.execute({
    userId: input.userId,
    serverId: input.serverId,
    args: input.args || {},
    config,
    apis,
    meta: {
      extensionId: found.extensionId,
      commandName: input.commandName
    }
  });
}

export async function activateExtensionForServer(serverId: string, manifest: ServerExtensionManifest, authToken?: string) {
  const serverMap = loadedByServer.get(serverId) || new Map<string, LoadedExtension>();
  const existing = serverMap.get(manifest.id);
  if (existing) {
    await deactivateLoadedExtension(serverId, existing);
    serverMap.delete(manifest.id);
  }

  const module = await activateLoadedExtension(serverId, manifest, authToken);
  serverMap.set(manifest.id, { manifest, module });
  loadedByServer.set(serverId, serverMap);

  const manifests = Array.from(serverMap.values()).map((item) => item.manifest);
  await persistManifests(serverId, manifests);
  console.log(`[extensions] activated ${manifest.id} on server ${serverId}`);
}

export async function deactivateExtensionForServer(serverId: string, extensionId: string) {
  const serverMap = loadedByServer.get(serverId) || new Map<string, LoadedExtension>();
  const existing = serverMap.get(extensionId);
  if (!existing) return;

  await deactivateLoadedExtension(serverId, existing);
  serverMap.delete(extensionId);
  loadedByServer.set(serverId, serverMap);

  const manifests = Array.from(serverMap.values()).map((item) => item.manifest);
  await persistManifests(serverId, manifests);
  console.log(`[extensions] deactivated ${extensionId} on server ${serverId}`);
}

export async function syncExtensionsForServer(serverId: string, manifests: ServerExtensionManifest[]) {
  const prevMap = loadedByServer.get(serverId) || new Map<string, LoadedExtension>();
  const nextMap = new Map<string, LoadedExtension>();
  commandRegistryByServer.set(serverId, new Map<string, RegisteredCommand>());

  for (const manifest of manifests) {
    try {
      const module = await activateLoadedExtension(serverId, manifest);
      nextMap.set(manifest.id, { manifest, module });
      console.log(`[extensions] activated ${manifest.id} on server ${serverId}`);
    } catch (error) {
      console.error(`[extensions] failed to load ${manifest.id} for server ${serverId}`, error);
    }
  }

  for (const [extensionId, loaded] of prevMap.entries()) {
    if (!nextMap.has(extensionId)) {
      try {
        await deactivateLoadedExtension(serverId, loaded);
      } catch (error) {
        console.error(`[extensions] failed to deactivate ${extensionId} for server ${serverId}`, error);
      }
    }
  }

  loadedByServer.set(serverId, nextMap);
  await persistManifests(serverId, manifests);
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
          author: parsed.author,
          description: parsed.description,
          entry: parsed.entry || "index.js",
          scope: parsed.scope || "server",
          permissions: Array.isArray(parsed.permissions) ? parsed.permissions : ["all"],
          configDefaults: parsed.configDefaults && typeof parsed.configDefaults === "object" ? parsed.configDefaults : {}
        } as ServerExtensionManifest;
      } catch {
        return {
          id: entry.name,
          name: entry.name,
          version: "0.1.0",
          scope: "server",
          entry: "index.js",
          permissions: ["all"],
          configDefaults: {}
        } as ServerExtensionManifest;
      }
    }));
  } catch {
    return [];
  }
}
