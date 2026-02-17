import { PresenceUpdate } from "@ods/shared/events.js";
import { q } from "./db.js";
import { z } from "zod";

const RichPresence = z.object({
  name: z.string().min(1).max(128).optional().nullable(),
  details: z.string().max(128).optional().nullable(),
  state: z.string().max(128).optional().nullable(),
  largeImageUrl: z.string().url().max(1024).optional().nullable(),
  largeImageText: z.string().max(128).optional().nullable(),
  smallImageUrl: z.string().url().max(1024).optional().nullable(),
  smallImageText: z.string().max(128).optional().nullable(),
  buttons: z.array(z.object({
    label: z.string().min(1).max(32),
    url: z.string().url().max(1024)
  })).max(2).optional(),
  startTimestamp: z.number().int().positive().optional().nullable(),
  endTimestamp: z.number().int().positive().optional().nullable()
}).strict();

function normalizeRichPresenceInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return RichPresence.parse(value);
}

export async function presenceUpsert(userId: string, presence: PresenceUpdate) {
  const richPresence = normalizeRichPresenceInput((presence as any).richPresence);
  const richPresenceJson = richPresence == null ? null : JSON.stringify(richPresence);
  await q(
    `INSERT INTO presence (user_id, status, custom_status, rich_presence_json, updated_at)
     VALUES (:userId, :status, :customStatus, CASE WHEN :hasRichPresence=1 THEN :richPresenceJson ELSE NULL END, NOW())
     ON DUPLICATE KEY UPDATE
       status=VALUES(status),
       custom_status=VALUES(custom_status),
       rich_presence_json=CASE WHEN :hasRichPresence=1 THEN :richPresenceJson ELSE rich_presence_json END,
       updated_at=NOW()`,
    {
      userId,
      status: presence.status,
      customStatus: presence.customStatus ?? null,
      hasRichPresence: richPresence !== undefined ? 1 : 0,
      richPresenceJson
    }
  );
}

export type PresenceRow = { user_id: string; status: string; custom_status: string | null; rich_presence_json: string | null };

export async function presenceGetMany(userIds: string[]): Promise<Record<string, { status: string; customStatus: string | null; richPresence: any | null }>> {
  if (userIds.length === 0) return {};
  const seen = new Set<string>();
  const unique = userIds.filter((id) => id && seen.size < 200 && !seen.has(id) && (seen.add(id), true));
  if (unique.length === 0) return {};
  const placeholders = unique.map((_, i) => `:id${i}`).join(", ");
  const params = Object.fromEntries(unique.map((id, i) => [`id${i}`, id]));
  const rows = await q<PresenceRow>(
    `SELECT user_id, status, custom_status, rich_presence_json FROM presence WHERE user_id IN (${placeholders})`,
    params
  );
  const out: Record<string, { status: string; customStatus: string | null; richPresence: any | null }> = {};
  for (const row of rows) {
    let richPresence: any = null;
    if (row.rich_presence_json) {
      try {
        richPresence = RichPresence.parse(JSON.parse(row.rich_presence_json));
      } catch {
        richPresence = null;
      }
    }
    out[row.user_id] = { status: row.status, customStatus: row.custom_status, richPresence };
  }
  return out;
}
