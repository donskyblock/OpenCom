import crypto from "node:crypto";

export function ulidLike(): string {
  // Not a true ULID, but time-sort-ish and unique enough for MVP.
  const t = Date.now().toString(36).padStart(10, "0");
  const r = crypto.randomBytes(10).toString("hex");
  return `${t}_${r}`;
}
