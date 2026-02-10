import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { q, pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  await q(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, ran_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const sqlDir = path.join(__dirname, "sql");
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith(".sql")).sort();

  for (const f of files) {
    const id = f.replace(".sql", "");
    const already = await q<{ id: string }>(`SELECT id FROM schema_migrations WHERE id=$1`, [id]);
    if (already.length) continue;

    const sql = fs.readFileSync(path.join(sqlDir, f), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await q(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
      await pool.query("COMMIT");
      console.log(`Applied migration ${id}`);
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
