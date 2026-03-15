ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS global_emotes_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER banner_url;
