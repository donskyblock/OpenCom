CREATE TABLE IF NOT EXISTS admin_boost_grants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  granted_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL,
  grant_type ENUM('permanent','temporary') NOT NULL,
  reason VARCHAR(240) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  revoked_by VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_boost_grants_user (user_id),
  INDEX idx_admin_boost_grants_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_admin_boost_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_boost_grants_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_boost_grants_revoked_by FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
