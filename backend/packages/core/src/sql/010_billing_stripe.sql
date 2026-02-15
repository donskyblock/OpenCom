CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci PRIMARY KEY,
  stripe_customer_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL,
  stripe_subscription_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL,
  plan VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL DEFAULT 'opencom_boost',
  status VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL DEFAULT 'incomplete',
  current_period_end TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_subscriptions_customer (stripe_customer_id),
  INDEX idx_subscriptions_subscription (stripe_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
