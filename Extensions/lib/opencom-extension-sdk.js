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
  return manifest;
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

  return {
    core: {
      get: (path, init = {}) => request(coreBaseUrl, path, { ...init, method: "GET" }),
      post: (path, body, init = {}) => request(coreBaseUrl, path, { ...init, method: "POST", body: JSON.stringify(body ?? {}) }),
      patch: (path, body, init = {}) => request(coreBaseUrl, path, { ...init, method: "PATCH", body: JSON.stringify(body ?? {}) }),
      del: (path, init = {}) => request(coreBaseUrl, path, { ...init, method: "DELETE" })
    },
    node: {
      get: (path, init = {}) => request(nodeBaseUrl, path, { ...init, method: "GET" }),
      post: (path, body, init = {}) => request(nodeBaseUrl, path, { ...init, method: "POST", body: JSON.stringify(body ?? {}) }),
      patch: (path, body, init = {}) => request(nodeBaseUrl, path, { ...init, method: "PATCH", body: JSON.stringify(body ?? {}) }),
      del: (path, init = {}) => request(nodeBaseUrl, path, { ...init, method: "DELETE" })
    }
  };
}
