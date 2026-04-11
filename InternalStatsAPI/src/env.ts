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

const headerName = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, "Header names may contain only letters, numbers, and hyphens");

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
  INTERNAL_STATS_PORT: z.preprocess(
    (value) => value ?? process.env.PORT,
    z.coerce.number().int().min(1).max(65535).default(3099),
  ),
  INTERNAL_STATS_HOST: z.preprocess(
    (value) => value ?? (isCloudRun ? "0.0.0.0" : undefined),
    z.string().default("127.0.0.1")
  ),
  INTERNAL_STATS_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  INTERNAL_STATS_SYNC_SECRET: z.preprocess(
    (value) => value ?? process.env.CORE_SYNC_SECRET ?? process.env.NODE_SYNC_SECRET,
    z.preprocess(emptyToUndefined, z.string().min(16)),
  ),
  INTERNAL_STATS_REQUIRE_AUTH: boolFlag.default(true),
  INTERNAL_STATS_SYNC_SECRET_HEADER: z.preprocess(
    (value) => value ?? "x-internal-stats-secret",
    headerName,
  ),
  INTERNAL_STATS_API_TOKEN_HEADER: z.preprocess(
    (value) => value ?? "x-api-token",
    headerName,
  ),

  // Used only for bootstrap token management endpoints.
  INTERNAL_STATS_GEN_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  INTERNAL_STATS_GEN_SECRET_HEADER: z.preprocess(
    (value) => value ?? "x-internal-stats-gen-secret",
    headerName,
  ),

  INTERNAL_STATS_DEFAULT_REPORT_SOURCE: z.string().default("core-api"),
  INTERNAL_STATS_RETENTION_DAYS: z.coerce.number().int().min(7).max(3650).default(365),
  INTERNAL_STATS_RETENTION_SWEEP_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
});

export const env = Env.parse(process.env);
