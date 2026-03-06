-- Migration 009: system guilds
-- Adds is_system flag to guilds. System guilds (e.g. the private-calls voice guild)
-- are hidden from normal user-facing guild listings but still fully functional.

ALTER TABLE guilds
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE AFTER owner_user_id;
