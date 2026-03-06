import type {
  AuthTokens,
  ChannelMessagesResponse,
  CoreServer,
  CoreServersResponse,
  Guild,
  GuildState,
  LoginResult
} from "./types";

type TokenReader = () => AuthTokens | null;
type TokenWriter = (tokens: AuthTokens | null) => Promise<void> | void;
type ServerTokenWriter = (serverId: string, membershipToken: string) => void;

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export function createApiClient(input: {
  coreApiUrl: string;
  getTokens: TokenReader;
  setTokens: TokenWriter;
  updateServerMembershipToken: ServerTokenWriter;
}) {
  const coreBase = input.coreApiUrl.replace(/\/$/, "");

  async function coreRequest<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
    const tokens = input.getTokens();
    const headers = new Headers(options.headers || {});
    if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(`${coreBase}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (response.status === 401 && retry && path !== "/v1/auth/refresh") {
      const refreshed = await refreshAccessToken();
      if (refreshed) return coreRequest(path, options, false);
    }

    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function nodeRequest<T>(server: CoreServer, path: string, options: RequestOptions = {}, retry = true): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${server.membershipToken}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(`${server.baseUrl.replace(/\/$/, "")}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (response.status === 401 && retry) {
      const refreshed = await refreshMembershipToken(server.id);
      if (refreshed) {
        const updated = { ...server, membershipToken: refreshed };
        return nodeRequest(updated, path, options, false);
      }
    }

    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T;
  }

  async function refreshAccessToken(): Promise<AuthTokens | null> {
    const tokens = input.getTokens();
    if (!tokens?.refreshToken) return null;

    const response = await fetch(`${coreBase}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });
    if (!response.ok) {
      await input.setTokens(null);
      return null;
    }

    const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) {
      await input.setTokens(null);
      return null;
    }
    const next = { accessToken: data.accessToken, refreshToken: data.refreshToken };
    await input.setTokens(next);
    return next;
  }

  async function refreshMembershipToken(serverId: string): Promise<string | null> {
    const response = await coreRequest<{ membershipToken: string }>(
      `/v1/servers/${encodeURIComponent(serverId)}/membership-token`,
      { method: "POST" }
    );
    if (!response.membershipToken) return null;
    input.updateServerMembershipToken(serverId, response.membershipToken);
    return response.membershipToken;
  }

  return {
    register(email: string, username: string, password: string) {
      return coreRequest<{ id: string; email: string; username: string }>("/v1/auth/register", {
        method: "POST",
        body: { email, username, password }
      }, false);
    },
    login(email: string, password: string) {
      return coreRequest<LoginResult>("/v1/auth/login", { method: "POST", body: { email, password } }, false);
    },
    getMe() {
      return coreRequest<{ id: string; email: string; username: string }>("/v1/me");
    },
    getServers() {
      return coreRequest<CoreServersResponse>("/v1/servers");
    },
    joinInvite(code: string) {
      return coreRequest<{ ok: boolean; serverId?: string }>(`/v1/invites/${encodeURIComponent(code)}/join`, {
        method: "POST",
        body: {}
      });
    },
    registerPushToken(token: string) {
      return coreRequest<{ ok: boolean }>("/v1/push/register", {
        method: "POST",
        body: { token, platform: "android" }
      });
    },
    listGuilds(server: CoreServer) {
      return nodeRequest<Guild[]>(server, "/v1/guilds");
    },
    getGuildState(server: CoreServer, guildId: string) {
      return nodeRequest<GuildState>(server, `/v1/guilds/${encodeURIComponent(guildId)}/state`);
    },
    listMessages(server: CoreServer, channelId: string) {
      return nodeRequest<ChannelMessagesResponse>(server, `/v1/channels/${encodeURIComponent(channelId)}/messages`);
    },
    sendMessage(server: CoreServer, channelId: string, content: string) {
      return nodeRequest<{ id: string }>(server, `/v1/channels/${encodeURIComponent(channelId)}/messages`, {
        method: "POST",
        body: { content }
      });
    },

    // Social: friends
    getFriends() {
      return coreRequest<{ friends: { id: string; username: string; pfp_url?: string | null; status?: string }[] }>(
        "/v1/social/friends"
      );
    },
    addFriend(username: string) {
      return coreRequest<{ ok: boolean; threadId?: string; friend?: { id: string; username?: string }; requestId?: string; requestStatus?: string }>(
        "/v1/social/friends",
        { method: "POST", body: { username } }
      );
    },
    removeFriend(friendId: string) {
      return coreRequest<{ ok: boolean }>(
        `/v1/social/friends/${encodeURIComponent(friendId)}`,
        { method: "DELETE" }
      );
    },
    getFriendRequests() {
      return coreRequest<{
        incoming: { id: string; userId: string; username: string; createdAt: string }[];
        outgoing: { id: string; userId: string; username: string; createdAt: string }[];
      }>("/v1/social/requests");
    },
    acceptFriendRequest(requestId: string) {
      return coreRequest<{ ok: boolean }>(`/v1/social/requests/${encodeURIComponent(requestId)}/accept`, {
        method: "POST"
      });
    },
    declineFriendRequest(requestId: string) {
      return coreRequest<{ ok: boolean }>(`/v1/social/requests/${encodeURIComponent(requestId)}/decline`, {
        method: "POST"
      });
    },

    // Social: DMs
    getDms() {
      return coreRequest<{ dms: { id: string; participantId: string; name: string; pfp_url?: string | null; lastMessageAt?: string | null }[] }>(
        "/v1/social/dms"
      );
    },
    openDm(friendId: string) {
      return coreRequest<{ threadId: string }>("/v1/social/dms/open", {
        method: "POST",
        body: { friendId }
      });
    },
    getDmMessages(threadId: string, options?: { limit?: number; before?: string }) {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.before) params.set("before", options.before);
      const qs = params.toString();
      return coreRequest<{ messages: { id: string; authorId: string; author: string; content: string; createdAt: string }[]; hasMore: boolean }>(
        `/v1/social/dms/${encodeURIComponent(threadId)}/messages${qs ? `?${qs}` : ""}`
      );
    },
    sendDmMessage(threadId: string, content: string) {
      return coreRequest<{ id: string }>(`/v1/social/dms/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        body: { content }
      });
    }
  };
}
