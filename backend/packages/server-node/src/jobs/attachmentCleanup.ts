import fs from "node:fs";
import { q } from "../db.js";
import { env } from "../env.js";
import { buildPath, unlinkIfExists } from "../storage/fsStore.js";

export async function runAttachmentCleanupOnce() {
  const expired = await q<{ id: string; object_key: string }>(
    `SELECT id, object_key
     FROM attachments
     WHERE expires_at < NOW()
     LIMIT 500`,
    {}
  );

  for (const a of expired) {
    const absPath = buildPath(env.ATTACHMENT_STORAGE_DIR, [a.object_key]);
    unlinkIfExists(absPath);
    await q(`DELETE FROM attachments WHERE id=:id`, { id: a.id });
  }

  return expired.length;
}

// naive scheduler: runs every 6 hours
export function startAttachmentCleanupLoop() {
  const tick = async () => {
    try {
      await runAttachmentCleanupOnce();
    } catch (e) {
      console.error("attachment cleanup failed", e);
    }
  };
  tick();
  setInterval(tick, 6 * 60 * 60 * 1000);
}
