import { PresenceUpdate } from "@ods/shared/events.js";
import { q } from "./db.js";

export async function presenceUpsert(userId: string, presence: PresenceUpdate) {
  await q(
    `INSERT INTO presence (user_id, status, custom_status, updated_at)
     VALUES (:userId, :status, :customStatus, NOW())
     ON DUPLICATE KEY UPDATE
       status=VALUES(status), custom_status=VALUES(custom_status), updated_at=NOW()`,
    { userId, status: presence.status, customStatus: presence.customStatus ?? null }
  );
}

export type PresenceRow = { user_id: string; status: string; custom_status: string | null };

export async function presenceGetMany(userIds: string[]): Promise<Record<string, { status: string; customStatus: string | null }>> {
  if (userIds.length === 0) return {};
  const seen = new Set<string>();
  const unique = userIds.filter((id) => id && seen.size < 200 && !seen.has(id) && (seen.add(id), true));
  if (unique.length === 0) return {};
  const placeholders = unique.map((_, i) => `:id${i}`).join(", ");
  const params = Object.fromEntries(unique.map((id, i) => [`id${i}`, id]));
  const rows = await q<PresenceRow>(
    `SELECT user_id, status, custom_status FROM presence WHERE user_id IN (${placeholders})`,
    params
  );
  const out: Record<string, { status: string; customStatus: string | null }> = {};
  for (const row of rows) {
    out[row.user_id] = { status: row.status, customStatus: row.custom_status };
  }
  return out;
}
