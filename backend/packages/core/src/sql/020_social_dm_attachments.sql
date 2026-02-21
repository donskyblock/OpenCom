CREATE TABLE IF NOT EXISTS social_dm_attachments (
  id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci PRIMARY KEY,
  thread_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  message_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL,
  uploader_user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  object_key TEXT NOT NULL,
  file_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  content_type VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  size_bytes INT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_social_dm_attachments_thread_time (thread_id, created_at),
  INDEX idx_social_dm_attachments_message (message_id),
  INDEX idx_social_dm_attachments_expires (expires_at),
  CONSTRAINT fk_social_dm_attachments_thread FOREIGN KEY (thread_id) REFERENCES social_dm_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_social_dm_attachments_message FOREIGN KEY (message_id) REFERENCES social_dm_messages(id) ON DELETE SET NULL,
  CONSTRAINT fk_social_dm_attachments_uploader FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
