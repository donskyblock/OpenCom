-- Store the default guild id on the node so we can add invite-join users to the guild
ALTER TABLE servers
  ADD COLUMN default_guild_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL;
