import mysql from "mysql2/promise";
import { env } from "./env.js";

const socketPath = process.env.DB_SOCKET_PATH?.trim();

const poolConfig = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  namedPlaceholders: true
} satisfies mysql.PoolOptions;

export const pool = mysql.createPool(
  socketPath
    ? {
        ...poolConfig,
        socketPath
      }
    : {
        ...poolConfig,
        host: process.env.DB_HOST?.trim() || env.DB_HOST,
        port: Number(process.env.DB_PORT || env.DB_PORT || 3306)
      }
);

export async function q<T = any>(sql: string, params: Record<string, any> = {}): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function exec(sql: string, params: Record<string, any> = {}): Promise<void> {
  await pool.execute(sql, params);
}
