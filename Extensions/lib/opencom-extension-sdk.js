/**
 * OpenCom Extension SDK
 *
 * This SDK is intentionally lightweight so extension authors can ship plain JS or TS
 * projects without requiring a heavyweight runtime.
 */

function withJsonHeaders(init = {}) {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  };
}

export function defineExtension(manifest) {
  if (!manifest?.id) throw new Error("Extension manifest requires an id");
  if (!manifest?.name) throw new Error("Extension manifest requires a name");
  if (manifest?.configDefaults && typeof manifest.configDefaults !== "object") {
    throw new Error("Extension manifest configDefaults must be an object");
  }
  return manifest;
}

export function defineConfig(defaults = {}) {
  if (defaults == null || typeof defaults !== "object" || Array.isArray(defaults)) {
    throw new Error("Extension config defaults must be an object");
  }
  return defaults;
}

export function command(input) {
  if (!input?.name) throw new Error("Command name is required");
  if (typeof input.execute !== "function") throw new Error(`Command '${input.name}' is missing execute()`);
  return {
    description: "",
    options: [],
    ...input
  };
}

export function optionString(name, description, required = false) {
  return { type: "string", name, description, required };
}

export function optionNumber(name, description, required = false) {
  return { type: "number", name, description, required };
}

export function optionBoolean(name, description, required = false) {
  return { type: "boolean", name, description, required };
}

export function createServerContext(ctx) {
  return {
    ...ctx,
    log: (...args) => ctx?.log?.log?.("[OpenComExtension]", ...args)
  };
}

export function getExtensionConfig(ctx) {
  if (!ctx?.config || typeof ctx.config.get !== "function") {
    throw new Error("Extension config API is unavailable in this runtime");
  }
  return ctx.config;
}

export function createOpenComApiClient({ coreBaseUrl, nodeBaseUrl, authToken }) {
  if (!coreBaseUrl) throw new Error("coreBaseUrl is required");
  if (!nodeBaseUrl) throw new Error("nodeBaseUrl is required");

  async function request(baseUrl, path, init = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...withJsonHeaders(init),
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : undefined,
        ...(withJsonHeaders(init).headers || {})
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`OPENCOM_API_${response.status}${text ? `:${text}` : ""}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return response.text();
  }

  const client = {
    core: {
      get: (path, init = {}) => request(coreBaseUrl, path, { ...init, method: "GET" }),
      post: (path, body, init = {}) => request(coreBaseUrl, path, { ...init, method: "POST", body: JSON.stringify(body ?? {}) }),
      put: (path, body, init = {}) => request(coreBaseUrl, path, { ...init, method: "PUT", body: JSON.stringify(body ?? {}) }),
      patch: (path, body, init = {}) => request(coreBaseUrl, path, { ...init, method: "PATCH", body: JSON.stringify(body ?? {}) }),
      del: (path, init = {}) => request(coreBaseUrl, path, { ...init, method: "DELETE" })
    },
    node: {
      get: (path, init = {}) => request(nodeBaseUrl, path, { ...init, method: "GET" }),
      post: (path, body, init = {}) => request(nodeBaseUrl, path, { ...init, method: "POST", body: JSON.stringify(body ?? {}) }),
      put: (path, body, init = {}) => request(nodeBaseUrl, path, { ...init, method: "PUT", body: JSON.stringify(body ?? {}) }),
      patch: (path, body, init = {}) => request(nodeBaseUrl, path, { ...init, method: "PATCH", body: JSON.stringify(body ?? {}) }),
      del: (path, init = {}) => request(nodeBaseUrl, path, { ...init, method: "DELETE" })
    }
  };

  client.auth = {
    me: () => client.core.get("/v1/me"),
    sessions: () => client.core.get("/v1/auth/sessions"),
    revokeSession: (sessionId) => client.core.del(`/v1/auth/sessions/${sessionId}`),
    changePassword: (payload) => client.core.patch("/v1/auth/password", payload)
  };

  client.profiles = {
    get: (userId) => client.core.get(`/v1/users/${userId}/profile`),
    updateMe: (payload) => client.core.patch("/v1/me/profile", payload),
    uploadPfp: (payload) => client.core.post("/v1/me/profile/pfp", payload),
    uploadBanner: (payload) => client.core.post("/v1/me/profile/banner", payload)
  };

  client.social = {
    friends: () => client.core.get("/v1/social/friends"),
    addFriend: (payload) => client.core.post("/v1/social/friends", payload),
    removeFriend: (friendId) => client.core.del(`/v1/social/friends/${friendId}`),
    requests: () => client.core.get("/v1/social/requests"),
    acceptRequest: (requestId) => client.core.post(`/v1/social/requests/${requestId}/accept`, {}),
    declineRequest: (requestId) => client.core.post(`/v1/social/requests/${requestId}/decline`, {}),
    settings: () => client.core.get("/v1/social/settings"),
    updateSettings: (payload) => client.core.patch("/v1/social/settings", payload)
  };

  client.dms = {
    list: () => client.core.get("/v1/social/dms"),
    open: (payload) => client.core.post("/v1/social/dms/open", payload),
    messages: (threadId) => client.core.get(`/v1/social/dms/${threadId}/messages`),
    send: (threadId, payload) => client.core.post(`/v1/social/dms/${threadId}/messages`, payload),
    deleteMessage: (threadId, messageId) => client.core.del(`/v1/social/dms/${threadId}/messages/${messageId}`)
  };

  client.servers = {
    list: () => client.core.get("/v1/servers"),
    create: (payload) => client.core.post("/v1/servers", payload),
    createOfficial: (payload) => client.core.post("/v1/servers/official", payload),
    updateProfile: (serverId, payload) => client.core.patch(`/v1/servers/${serverId}/profile`, payload),
    refreshMembershipToken: (serverId) => client.core.post(`/v1/servers/${serverId}/membership-token`, {}),
    reorder: (serverIds) => client.core.post("/v1/servers/reorder", { serverIds }),
    leave: (serverId) => client.core.post(`/v1/servers/${serverId}/leave`, {}),
    remove: (serverId) => client.core.del(`/v1/servers/${serverId}`)
  };

  client.invites = {
    create: (payload) => client.core.post("/v1/invites", payload),
    preview: (code) => client.core.get(`/v1/invites/${encodeURIComponent(code)}`),
    join: (code, payload = {}) => client.core.post(`/v1/invites/${encodeURIComponent(code)}/join`, payload),
    joinFromInput: (codeOrUrl, payload = {}) => client.core.post("/v1/invites/join", { codeOrUrl, ...payload })
  };

  client.nodeGuilds = {
    list: () => client.node.get("/v1/guilds"),
    create: (payload) => client.node.post("/v1/guilds", payload),
    channels: (guildId) => client.node.get(`/v1/guilds/${guildId}/channels`),
    state: (guildId) => client.node.get(`/v1/guilds/${guildId}/state`),
    reorderChannels: (guildId, items) => client.node.post(`/v1/guilds/${guildId}/channels/reorder`, { items }),
    join: (guildId) => client.node.post(`/v1/guilds/${guildId}/join`, {}),
    leave: (guildId) => client.node.post(`/v1/guilds/${guildId}/leave`, {}),
    kickMember: (guildId, memberId) => client.node.post(`/v1/guilds/${guildId}/members/${memberId}/kick`, {}),
    banMember: (guildId, memberId, payload = {}) => client.node.post(`/v1/guilds/${guildId}/members/${memberId}/ban`, payload),
    unbanMember: (guildId, memberId) => client.node.del(`/v1/guilds/${guildId}/bans/${memberId}`)
  };

  client.channels = {
    create: (guildId, payload) => client.node.post(`/v1/guilds/${guildId}/channels`, payload),
    update: (channelId, payload) => client.node.patch(`/v1/channels/${channelId}`, payload),
    remove: (channelId) => client.node.del(`/v1/channels/${channelId}`),
    messages: (channelId, query = "") => client.node.get(`/v1/channels/${channelId}/messages${query}`),
    setOverwrite: (channelId, payload) => client.node.put(`/v1/channels/${channelId}/overwrites`, payload),
    deleteOverwrite: (channelId, payload) => request(nodeBaseUrl, `/v1/channels/${channelId}/overwrites`, {
      method: "DELETE",
      body: JSON.stringify(payload),
      headers: { Authorization: authToken ? `Bearer ${authToken}` : undefined, "Content-Type": "application/json" }
    }),
    syncPermissionsFromCategory: (channelId) => client.node.post(`/v1/channels/${channelId}/sync-permissions`, {})
  };

  client.messages = {
    send: (channelId, payload) => client.node.post(`/v1/channels/${channelId}/messages`, payload),
    delete: (channelId, messageId) => client.node.del(`/v1/channels/${channelId}/messages/${messageId}`)
  };

  client.attachments = {
    upload: async ({ guildId, channelId, file, fileName, contentType, messageId }) => {
      const form = new FormData();
      form.append("guildId", guildId);
      form.append("channelId", channelId);
      if (messageId) form.append("messageId", messageId);
      const blob = file instanceof Blob ? file : new Blob([file], { type: contentType || "application/octet-stream" });
      form.append("file", blob, fileName || "upload.bin");

      const response = await fetch(`${nodeBaseUrl}/v1/attachments/upload`, {
        method: "POST",
        headers: {
          Authorization: authToken ? `Bearer ${authToken}` : undefined
        },
        body: form
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`OPENCOM_API_${response.status}${text ? `:${text}` : ""}`);
      }
      return response.json();
    },
    getUrl: (attachmentId) => `${nodeBaseUrl.replace(/\/$/, "")}/v1/attachments/${attachmentId}`
  };

  client.voice = {
    join: (channelId, payload = {}) => client.node.post(`/v1/channels/${channelId}/voice/join`, payload),
    leave: (channelId, payload = {}) => client.node.post(`/v1/channels/${channelId}/voice/leave`, payload),
    state: (channelId, payload) => client.node.patch(`/v1/channels/${channelId}/voice/state`, payload),
    me: () => client.node.get("/v1/me/voice-state"),
    disconnectMe: (payload = {}) => client.node.post("/v1/me/voice-disconnect", payload)
  };

  client.extensions = {
    catalog: () => client.core.get("/v1/extensions/catalog"),
    serverInstalled: (serverId) => client.core.get(`/v1/servers/${serverId}/extensions`),
    setServerState: (serverId, extensionId, enabled) => client.core.post(`/v1/servers/${serverId}/extensions/${extensionId}`, { enabled }),
    serverConfig: (serverId, extensionId) => client.core.get(`/v1/servers/${serverId}/extensions/${extensionId}/config`),
    setServerConfig: (serverId, extensionId, config, mode = "replace") => client.core.put(`/v1/servers/${serverId}/extensions/${extensionId}/config`, { config, mode }),
    nodeCatalog: () => client.node.get("/v1/extensions/catalog"),
    nodeInstalled: () => client.node.get("/v1/extensions"),
    nodeCommands: () => client.node.get("/v1/extensions/commands"),
    executeCommand: (commandName, args = {}) => client.node.post(`/v1/extensions/commands/${commandName}/execute`, { args })
  };

  return client;
}
