export type ExtensionManifest = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  scope?: "client" | "server" | "both";
  entry?: string;
  permissions?: string[];
};

export type CommandOption = {
  type: "string" | "number" | "boolean";
  name: string;
  description: string;
  required?: boolean;
};

export type ExecuteContext = {
  userId: string;
  serverId: string;
  args: Record<string, unknown>;
  apis: ReturnType<typeof createOpenComApiClient>;
  meta: {
    extensionId: string;
    commandName: string;
  };
};

export type ExtensionCommand = {
  name: string;
  description?: string;
  options?: CommandOption[];
  execute: (ctx: ExecuteContext) => Promise<unknown> | unknown;
};

export function defineExtension(manifest: ExtensionManifest): ExtensionManifest;
export function command(input: ExtensionCommand): ExtensionCommand;
export function optionString(name: string, description: string, required?: boolean): CommandOption;
export function optionNumber(name: string, description: string, required?: boolean): CommandOption;
export function optionBoolean(name: string, description: string, required?: boolean): CommandOption;
export function createServerContext<T extends object>(ctx: T): T & { log: (...args: any[]) => void };

type ApiHttpSurface = {
  get(path: string, init?: RequestInit): Promise<any>;
  post(path: string, body?: unknown, init?: RequestInit): Promise<any>;
  patch(path: string, body?: unknown, init?: RequestInit): Promise<any>;
  del(path: string, init?: RequestInit): Promise<any>;
};

export function createOpenComApiClient(input: {
  coreBaseUrl: string;
  nodeBaseUrl: string;
  authToken?: string;
}): {
  core: ApiHttpSurface;
  node: ApiHttpSurface;
  auth: {
    me(): Promise<any>;
    sessions(): Promise<any>;
    revokeSession(sessionId: string): Promise<any>;
    changePassword(payload: Record<string, unknown>): Promise<any>;
  };
  profiles: {
    get(userId: string): Promise<any>;
    updateMe(payload: Record<string, unknown>): Promise<any>;
    uploadPfp(payload: Record<string, unknown>): Promise<any>;
    uploadBanner(payload: Record<string, unknown>): Promise<any>;
  };
  social: {
    friends(): Promise<any>;
    addFriend(payload: Record<string, unknown>): Promise<any>;
    removeFriend(friendId: string): Promise<any>;
    requests(): Promise<any>;
    acceptRequest(requestId: string): Promise<any>;
    declineRequest(requestId: string): Promise<any>;
    settings(): Promise<any>;
    updateSettings(payload: Record<string, unknown>): Promise<any>;
  };
  dms: {
    list(): Promise<any>;
    open(payload: Record<string, unknown>): Promise<any>;
    messages(threadId: string): Promise<any>;
    send(threadId: string, payload: Record<string, unknown>): Promise<any>;
    deleteMessage(threadId: string, messageId: string): Promise<any>;
  };
  servers: {
    list(): Promise<any>;
    create(payload: Record<string, unknown>): Promise<any>;
    createOfficial(payload: Record<string, unknown>): Promise<any>;
    leave(serverId: string): Promise<any>;
    remove(serverId: string): Promise<any>;
  };
  nodeGuilds: {
    list(): Promise<any>;
    create(payload: Record<string, unknown>): Promise<any>;
    channels(guildId: string): Promise<any>;
    state(guildId: string): Promise<any>;
    join(guildId: string): Promise<any>;
    leave(guildId: string): Promise<any>;
  };
  channels: {
    create(guildId: string, payload: Record<string, unknown>): Promise<any>;
    update(channelId: string, payload: Record<string, unknown>): Promise<any>;
    remove(channelId: string): Promise<any>;
    messages(channelId: string, query?: string): Promise<any>;
  };
  messages: {
    send(channelId: string, payload: Record<string, unknown>): Promise<any>;
    delete(channelId: string, messageId: string): Promise<any>;
  };
  voice: {
    join(channelId: string, payload?: Record<string, unknown>): Promise<any>;
    leave(channelId: string, payload?: Record<string, unknown>): Promise<any>;
    state(channelId: string, payload: Record<string, unknown>): Promise<any>;
    me(): Promise<any>;
    disconnectMe(payload?: Record<string, unknown>): Promise<any>;
  };
  extensions: {
    catalog(): Promise<any>;
    serverInstalled(serverId: string): Promise<any>;
    setServerState(serverId: string, extensionId: string, enabled: boolean): Promise<any>;
    nodeCatalog(): Promise<any>;
    nodeInstalled(): Promise<any>;
    nodeCommands(): Promise<any>;
    executeCommand(commandName: string, args?: Record<string, unknown>): Promise<any>;
  };
};
