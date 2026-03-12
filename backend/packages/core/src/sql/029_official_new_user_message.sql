ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS new_user_official_message_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER boost_trial_ends_at,
  ADD COLUMN IF NOT EXISTS new_user_official_message_content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NULL AFTER new_user_official_message_enabled;

INSERT INTO platform_config (id, founder_user_id)
VALUES (1, NULL)
ON DUPLICATE KEY UPDATE id=id;

UPDATE platform_config
SET new_user_official_message_enabled=IFNULL(new_user_official_message_enabled, 0),
    new_user_official_message_content=COALESCE(new_user_official_message_content, '')
WHERE id=1;
