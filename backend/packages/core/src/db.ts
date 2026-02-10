import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({ connectionString: env.CORE_DATABASE_URL });

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}
