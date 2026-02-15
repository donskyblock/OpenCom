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

export function createOpenComApiClient(input: {
  coreBaseUrl: string;
  nodeBaseUrl: string;
  authToken?: string;
}): {
  core: {
    get(path: string, init?: RequestInit): Promise<any>;
    post(path: string, body?: unknown, init?: RequestInit): Promise<any>;
    patch(path: string, body?: unknown, init?: RequestInit): Promise<any>;
    del(path: string, init?: RequestInit): Promise<any>;
  };
  node: {
    get(path: string, init?: RequestInit): Promise<any>;
    post(path: string, body?: unknown, init?: RequestInit): Promise<any>;
    patch(path: string, body?: unknown, init?: RequestInit): Promise<any>;
    del(path: string, init?: RequestInit): Promise<any>;
  };
};
