ALTER TABLE presence
  ADD COLUMN IF NOT EXISTS rich_presence_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL CHECK (`rich_presence_json` IS NULL OR json_valid(`rich_presence_json`));
