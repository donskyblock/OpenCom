CREATE TABLE IF NOT EXISTS social_dm_message_reactions (
  message_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  thread_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  reaction_key VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  reaction_type VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  reaction_name VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  reaction_value VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL,
  reaction_image_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id, reaction_key),
  INDEX idx_social_dm_message_reactions_message (message_id, created_at),
  INDEX idx_social_dm_message_reactions_thread (thread_id, created_at),
  CONSTRAINT fk_social_dm_message_reactions_message FOREIGN KEY (message_id) REFERENCES social_dm_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_social_dm_message_reactions_thread FOREIGN KEY (thread_id) REFERENCES social_dm_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_social_dm_message_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
