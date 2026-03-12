import { ulidLike } from "@ods/shared/ids.js";
import { q } from "./db.js";
import {
  buildOfficialBadgeDetail,
  ensureSocialDmThread,
  getOfficialAccount,
} from "./officialAccount.js";
import type { OfficialAccount } from "./officialAccount.js";

export const OFFICIAL_MESSAGE_MAX_LENGTH = 4000;

export type BroadcastToUser = (
  targetUserId: string,
  eventType: string,
  payload: any,
) => Promise<void>;

export type NewUserOfficialMessageConfig = {
  enabled: boolean;
  content: string;
};

async function ensurePlatformConfigRow() {
  await q(
    `INSERT INTO platform_config (id, founder_user_id)
     VALUES (1, NULL)
     ON DUPLICATE KEY UPDATE id=id`,
  );
}

export async function getNewUserOfficialMessageConfig(): Promise<NewUserOfficialMessageConfig> {
  await ensurePlatformConfigRow();

  const rows = await q<{
    new_user_official_message_enabled: number | null;
    new_user_official_message_content: string | null;
  }>(
    `SELECT new_user_official_message_enabled, new_user_official_message_content
     FROM platform_config
     WHERE id=1
     LIMIT 1`,
  );

  return {
    enabled: Number(rows[0]?.new_user_official_message_enabled || 0) === 1,
    content: rows[0]?.new_user_official_message_content || "",
  };
}

export async function saveNewUserOfficialMessageConfig(
  input: NewUserOfficialMessageConfig,
): Promise<NewUserOfficialMessageConfig> {
  await ensurePlatformConfigRow();

  await q(
    `UPDATE platform_config
     SET new_user_official_message_enabled=:enabled,
         new_user_official_message_content=:content
     WHERE id=1`,
    {
      enabled: input.enabled ? 1 : 0,
      content: String(input.content || ""),
    },
  );

  return getNewUserOfficialMessageConfig();
}

export async function sendOfficialMessageToUser(
  recipientUserId: string,
  content: string,
  options: {
    officialAccount?: OfficialAccount | null;
    broadcastToUser?: BroadcastToUser;
  } = {},
): Promise<{ threadId: string; messageId: string } | null> {
  const targetUserId = String(recipientUserId || "").trim();
  const finalContent = String(content || "");
  if (!targetUserId || !finalContent.trim()) return null;

  const officialAccount = options.officialAccount || (await getOfficialAccount());
  if (!officialAccount || officialAccount.id === targetUserId) return null;

  const threadId = await ensureSocialDmThread(officialAccount.id, targetUserId);
  const messageId = ulidLike();

  await q(
    `INSERT INTO social_dm_messages (id,thread_id,sender_user_id,content)
     VALUES (:id,:threadId,:senderId,:content)`,
    {
      id: messageId,
      threadId,
      senderId: officialAccount.id,
      content: finalContent,
    },
  );

  await q(`UPDATE social_dm_threads SET last_message_at=NOW() WHERE id=:threadId`, {
    threadId,
  });

  if (options.broadcastToUser) {
    const senderName = officialAccount.display_name || officialAccount.username;
    const createdAt = new Date().toISOString();
    await options.broadcastToUser(targetUserId, "SOCIAL_DM_MESSAGE_CREATE", {
      threadId,
      message: {
        id: messageId,
        authorId: officialAccount.id,
        author: senderName,
        pfp_url: officialAccount.pfp_url ?? null,
        content: finalContent,
        createdAt,
        attachments: [],
        badgeDetails: [buildOfficialBadgeDetail()],
        isOfficial: true,
        isNoReply: true,
      },
    });
  }

  return { threadId, messageId };
}
