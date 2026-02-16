CREATE TABLE IF NOT EXISTS guild_emotes (
  id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci PRIMARY KEY,
  guild_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  image_url TEXT NOT NULL,
  created_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guild_emote_name (guild_id, name),
  INDEX idx_guild_emotes_guild (guild_id),
  CONSTRAINT fk_guild_emotes_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
