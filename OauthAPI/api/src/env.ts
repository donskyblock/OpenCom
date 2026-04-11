import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCloudRun = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.CLOUD_RUN_EXECUTION);

export const internalStatsEnvFilePath = loadEnv();

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../backend/.env"),
  ];

  for (const candidate of new Set(candidates)) {
    if (!fs.existsSync(candidate)) continue;
    config({ path: candidate, override: true });
    return candidate;
  }

  return null;
}

const boolFlag = z.preprocess(
  (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
    }
    return false;
  },
  z.boolean(),
);

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.preprocess(
    (value) => value ?? process.env.PORT,
    z.coerce.number().int().min(1).max(65535).default(3099),
  ),
  HOST: z.preprocess(
    (value) => value ?? process.env.HOST ?? (isCloudRun ? "0.0.0.0" : undefined),
    z.string().min(1).default("127.0.0.1")
    ),
  INTERNAL_STATS_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  CORE_API_URL: z.preprocess(
    (value) => emptyToUndefined(value) ?? "http://127.0.0.1:3000",
    z.string().url(),
  ),
  OAUTH_PUBLIC_URL: z.preprocess(
    (value) => emptyToUndefined(value) ?? "https://api.opencom.online",
    z.string().url(),
  ),
});
export const env = Env.parse(process.env);
