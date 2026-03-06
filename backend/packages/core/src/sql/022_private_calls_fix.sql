-- Migration 022: Fix PRIVATE_CALLS table
-- Adds the missing `active` column (was referenced in INDEX but never defined),
-- plus `guild_id` and `node_base_url` needed to locate the voice channel on the server-node.

ALTER TABLE PRIVATE_CALLS
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE AFTER ended_at,
  ADD COLUMN IF NOT EXISTS guild_id VARCHAR(64) NULL AFTER channel_id,
  ADD COLUMN IF NOT EXISTS node_base_url VARCHAR(512) NULL AFTER guild_id;
