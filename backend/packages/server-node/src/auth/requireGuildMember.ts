import { q } from "../db.js";

export async function requireGuildMember(guildId: string, userId: string) {
  const rows = await q<{ guild_id: string }>(
    `SELECT guild_id FROM guild_members WHERE guild_id=:guildId AND user_id=:userId`,
    { guildId, userId }
  );
  if (!rows.length) throw new Error("NOT_GUILD_MEMBER");
}
