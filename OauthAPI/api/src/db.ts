import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  namedPlaceholders: true,
});

export async function q<T = any>(
  sql: string,
  params: Record<string, any> = {},
): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function exec(
  sql: string,
  params: Record<string, any> = {},
): Promise<void> {
  await pool.execute(sql, params);
}
