CREATE TABLE IF NOT EXISTS panel_admin_login_challenges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  token_hash VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_panel_admin_login_challenges_hash (token_hash),
  INDEX idx_panel_admin_login_challenges_admin (admin_id, consumed_at, expires_at),
  CONSTRAINT fk_panel_admin_login_challenges_admin
    FOREIGN KEY (admin_id) REFERENCES panel_admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
