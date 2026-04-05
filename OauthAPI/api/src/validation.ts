import { z } from "zod";

function normalizeBody(body: unknown): unknown {
  if (body == null) return body;

  if (Buffer.isBuffer(body)) {
    const raw = body.toString("utf8").trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("INVALID_JSON_BODY");
    }
  }

  if (typeof body === "string") {
    const raw = body.trim();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("INVALID_JSON_BODY");
    }
  }

  return body;
}

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  return schema.parse(normalizeBody(body));
}
export function parseBodyRaw(body: unknown): Record<string, any> {
  if (body == null) return {}; // null or undefined → empty object

  // If it's a Buffer
  if (Buffer.isBuffer(body)) {
    const str = body.toString("utf8").trim();
    if (!str) return {};
    try {
      return JSON.parse(str);
    } catch {
      throw new Error("INVALID_JSON_BODY");
    }
  }

  // If it's a string
  if (typeof body === "string") {
    const str = body.trim();
    if (!str) return {};
    try {
      return JSON.parse(str);
    } catch {
      throw new Error("INVALID_JSON_BODY");
    }
  }

  // If it's already an object, return as-is
  if (typeof body === "object") return body as Record<string, any>;

  // For other types (number, boolean, etc.), wrap in an object
  return { value: body };
}
