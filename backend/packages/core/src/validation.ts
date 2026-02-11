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

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  return schema.parse(normalizeBody(body));
}
