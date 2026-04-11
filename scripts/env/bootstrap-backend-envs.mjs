#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const BACKEND_DIR = path.join(ROOT, "backend");

const SERVICE_FILES = {
  core: "core.env",
  node: "node.env",
  media: "media.env",
};

const EXAMPLE_FILES = {
  core: "core.env.example",
  node: "node.env.example",
  media: "media.env.example",
};

function randHex(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function parseEnv(content) {
  const map = new Map();
  for (const line of String(content || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let [, key, value] = match;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function parseExample(content) {
  const entries = [];
  let pendingComments = [];

  for (const line of String(content || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      entries.push({ type: "blank", raw: line });
      pendingComments = [];
      continue;
    }
    if (trimmed.startsWith("#")) {
      pendingComments.push(line);
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      entries.push({ type: "raw", raw: line });
      pendingComments = [];
      continue;
    }

    entries.push({
      type: "key",
      key: match[1],
      value: match[2],
      comments: pendingComments,
    });
    pendingComments = [];
  }

  return entries;
}

function getExistingEnv(service) {
  const filePath = path.join(BACKEND_DIR, SERVICE_FILES[service]);
  if (!fs.existsSync(filePath)) return new Map();
  return parseEnv(fs.readFileSync(filePath, "utf8"));
}

function getExampleEntries(service) {
  const filePath = path.join(BACKEND_DIR, EXAMPLE_FILES[service]);
  return parseExample(fs.readFileSync(filePath, "utf8"));
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    if (value.trim()) return value;
  }
  return "";
}

function toWsGatewayUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:") parsed.protocol = "wss:";
    else if (parsed.protocol === "http:") parsed.protocol = "ws:";
    else if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return "";
    parsed.pathname = "/gateway";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function toHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getHostname(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname || "";
  } catch {
    return "";
  }
}

function replaceValue(rawLine, nextValue) {
  const match = String(rawLine).match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return rawLine;
  return `${match[1]}=${nextValue}`;
}

function buildContext() {
  const existing = {
    core: getExistingEnv("core"),
    node: getExistingEnv("node"),
    media: getExistingEnv("media"),
  };

  const all = new Map();
  for (const service of ["core", "node", "media"]) {
    for (const [key, value] of existing[service]) {
      if (!all.has(key) && String(value || "").trim()) all.set(key, value);
    }
  }

  const coreUrl = toHttpUrl(firstNonEmpty(
    all.get("CORE_BASE_URL"),
    all.get("CORE_ISSUER"),
  ));
  const nodeUrl = toHttpUrl(firstNonEmpty(
    all.get("PUBLIC_BASE_URL"),
    all.get("OFFICIAL_NODE_BASE_URL"),
  ));
  const mediaUrl = toHttpUrl(firstNonEmpty(all.get("MEDIA_SERVER_URL")));
  const appUrl = toHttpUrl(firstNonEmpty(all.get("APP_BASE_URL")));
  const supportUrl = toHttpUrl(firstNonEmpty(all.get("SUPPORT_BASE_URL")));
  const mediaWsUrl = firstNonEmpty(
    all.get("MEDIA_WS_URL"),
    toWsGatewayUrl(mediaUrl),
  );
  const jwksUrl = firstNonEmpty(
    all.get("CORE_JWKS_URL"),
    coreUrl ? `${coreUrl}/v1/jwks` : "",
  );

  return {
    existing,
    values: {
      NODE_ENV: firstNonEmpty(all.get("NODE_ENV"), "production"),
      CORE_BASE_URL: coreUrl,
      CORE_ISSUER: coreUrl,
      CORE_JWKS_URL: jwksUrl,
      OFFICIAL_NODE_BASE_URL: firstNonEmpty(all.get("OFFICIAL_NODE_BASE_URL"), nodeUrl),
      PUBLIC_BASE_URL: firstNonEmpty(all.get("PUBLIC_BASE_URL"), nodeUrl),
      MEDIA_SERVER_URL: mediaUrl,
      MEDIA_WS_URL: mediaWsUrl,
      MEDIA_ALLOWED_ORIGINS: firstNonEmpty(
        all.get("MEDIA_ALLOWED_ORIGINS"),
        [appUrl, supportUrl].filter(Boolean).join(","),
      ),
      APP_BASE_URL: appUrl,
      SUPPORT_BASE_URL: supportUrl,
      CORE_NODE_SYNC_SECRET: firstNonEmpty(
        all.get("CORE_NODE_SYNC_SECRET"),
        all.get("NODE_SYNC_SECRET"),
        all.get("MEDIA_SYNC_SECRET"),
        randHex(24),
      ),
      NODE_SYNC_SECRET: firstNonEmpty(
        all.get("NODE_SYNC_SECRET"),
        all.get("CORE_NODE_SYNC_SECRET"),
        all.get("MEDIA_SYNC_SECRET"),
        randHex(24),
      ),
      MEDIA_SYNC_SECRET: firstNonEmpty(
        all.get("MEDIA_SYNC_SECRET"),
        all.get("NODE_SYNC_SECRET"),
        all.get("CORE_NODE_SYNC_SECRET"),
        randHex(24),
      ),
      MEDIA_TOKEN_SECRET: firstNonEmpty(all.get("MEDIA_TOKEN_SECRET"), randHex(24)),
      MEDIA_TOKEN_ISSUER: firstNonEmpty(all.get("MEDIA_TOKEN_ISSUER"), "opencom-media"),
      MEDIA_TOKEN_AUDIENCE: firstNonEmpty(all.get("MEDIA_TOKEN_AUDIENCE")),
      NODE_SERVER_ID: firstNonEmpty(all.get("NODE_SERVER_ID"), all.get("OFFICIAL_NODE_SERVER_ID"), "my-node-1"),
      OFFICIAL_NODE_SERVER_ID: firstNonEmpty(all.get("OFFICIAL_NODE_SERVER_ID"), all.get("NODE_SERVER_ID"), "my-node-1"),
      NODE_ID: firstNonEmpty(all.get("NODE_ID"), "node-gcp-1"),
      NODE_DATABASE_URL: firstNonEmpty(all.get("NODE_DATABASE_URL"), all.get("MEDIA_DATABASE_URL")),
      MEDIA_DATABASE_URL: firstNonEmpty(all.get("MEDIA_DATABASE_URL"), all.get("NODE_DATABASE_URL")),
      DB_HOST: firstNonEmpty(all.get("DB_HOST")),
      DB_PORT: firstNonEmpty(all.get("DB_PORT")),
      DB_USER: firstNonEmpty(all.get("DB_USER")),
      DB_PASSWORD: firstNonEmpty(all.get("DB_PASSWORD")),
      DB_NAME: firstNonEmpty(all.get("DB_NAME")),
      REDIS_URL: firstNonEmpty(all.get("REDIS_URL")),
      STORAGE_PROVIDER: firstNonEmpty(all.get("STORAGE_PROVIDER")),
      CORE_S3_BUCKET: firstNonEmpty(all.get("CORE_S3_BUCKET")),
      NODE_S3_BUCKET: firstNonEmpty(all.get("NODE_S3_BUCKET")),
      S3_REGION: firstNonEmpty(all.get("S3_REGION")),
      S3_ENDPOINT: firstNonEmpty(all.get("S3_ENDPOINT")),
      S3_ACCESS_KEY_ID: firstNonEmpty(all.get("S3_ACCESS_KEY_ID")),
      S3_SECRET_ACCESS_KEY: firstNonEmpty(all.get("S3_SECRET_ACCESS_KEY")),
      S3_FORCE_PATH_STYLE: firstNonEmpty(all.get("S3_FORCE_PATH_STYLE")),
      S3_KEY_PREFIX: firstNonEmpty(all.get("S3_KEY_PREFIX")),
      ATTACHMENT_MAX_BYTES: firstNonEmpty(all.get("ATTACHMENT_MAX_BYTES")),
      ATTACHMENT_BOOST_MAX_BYTES: firstNonEmpty(all.get("ATTACHMENT_BOOST_MAX_BYTES")),
      ATTACHMENT_TTL_DAYS: firstNonEmpty(all.get("ATTACHMENT_TTL_DAYS")),
      ATTACHMENT_STORAGE_DIR: firstNonEmpty(all.get("ATTACHMENT_STORAGE_DIR")),
      LOG_LEVEL: firstNonEmpty(all.get("LOG_LEVEL")),
      LOG_DIR: firstNonEmpty(all.get("LOG_DIR")),
      LOG_TO_FILE: firstNonEmpty(all.get("LOG_TO_FILE")),
      DEBUG_HTTP: firstNonEmpty(all.get("DEBUG_HTTP")),
      DEBUG_VOICE: firstNonEmpty(all.get("DEBUG_VOICE")),
      MEDIASOUP_LISTEN_IP: firstNonEmpty(all.get("MEDIASOUP_LISTEN_IP")),
      MEDIASOUP_ANNOUNCED_ADDRESS: firstNonEmpty(
        all.get("MEDIASOUP_ANNOUNCED_ADDRESS"),
        getHostname(mediaUrl),
        getHostname(nodeUrl),
      ),
      MEDIASOUP_ENABLE_UDP: firstNonEmpty(all.get("MEDIASOUP_ENABLE_UDP")),
      MEDIASOUP_ENABLE_TCP: firstNonEmpty(all.get("MEDIASOUP_ENABLE_TCP")),
      MEDIASOUP_PREFER_UDP: firstNonEmpty(all.get("MEDIASOUP_PREFER_UDP")),
      MEDIASOUP_RTC_MIN_PORT: firstNonEmpty(all.get("MEDIASOUP_RTC_MIN_PORT")),
      MEDIASOUP_RTC_MAX_PORT: firstNonEmpty(all.get("MEDIASOUP_RTC_MAX_PORT")),
      VOICE_STUN_URLS: firstNonEmpty(all.get("VOICE_STUN_URLS")),
      VOICE_TURN_URLS: firstNonEmpty(all.get("VOICE_TURN_URLS")),
      VOICE_TURN_SECRET: firstNonEmpty(all.get("VOICE_TURN_SECRET")),
      VOICE_TURN_TTL_SECONDS: firstNonEmpty(all.get("VOICE_TURN_TTL_SECONDS")),
      CORE_JWT_ACCESS_SECRET: firstNonEmpty(all.get("CORE_JWT_ACCESS_SECRET"), randHex(24)),
      CORE_JWT_REFRESH_SECRET: firstNonEmpty(all.get("CORE_JWT_REFRESH_SECRET"), randHex(24)),
      CORE_MEMBERSHIP_PRIVATE_JWK: firstNonEmpty(all.get("CORE_MEMBERSHIP_PRIVATE_JWK")),
      CORE_MEMBERSHIP_PUBLIC_JWK: firstNonEmpty(all.get("CORE_MEMBERSHIP_PUBLIC_JWK")),
      ADMIN_PANEL_PASSWORD: firstNonEmpty(all.get("ADMIN_PANEL_PASSWORD"), randHex(12)),
      ADMIN_2FA_ENCRYPTION_KEY: firstNonEmpty(all.get("ADMIN_2FA_ENCRYPTION_KEY"), randHex(24)),
      ADMIN_2FA_ISSUER: firstNonEmpty(all.get("ADMIN_2FA_ISSUER")),
      DEPLOYMENT_PROVIDER: firstNonEmpty(all.get("DEPLOYMENT_PROVIDER"), "gcp"),
      DEPLOYMENT_COMPUTE_CLASS: firstNonEmpty(all.get("DEPLOYMENT_COMPUTE_CLASS"), "cloud-run"),
      DEPLOYMENT_REGION: firstNonEmpty(all.get("DEPLOYMENT_REGION")),
      DEPLOYMENT_STACK_NAME: firstNonEmpty(all.get("DEPLOYMENT_STACK_NAME")),
      DEPLOYMENT_OS_NAME: firstNonEmpty(all.get("DEPLOYMENT_OS_NAME"), "linux"),
      PRIVATE_CALLS_GUILD_ID: firstNonEmpty(all.get("PRIVATE_CALLS_GUILD_ID")),
      AUTH_REQUIRE_EMAIL_VERIFICATION: firstNonEmpty(all.get("AUTH_REQUIRE_EMAIL_VERIFICATION")),
      AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: firstNonEmpty(all.get("AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES")),
      AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES: firstNonEmpty(all.get("AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES")),
      SMTP_HOST: firstNonEmpty(all.get("SMTP_HOST")),
      SMTP_PORT: firstNonEmpty(all.get("SMTP_PORT")),
      SMTP_SECURE: firstNonEmpty(all.get("SMTP_SECURE")),
      SMTP_USER: firstNonEmpty(all.get("SMTP_USER")),
      SMTP_PASS: firstNonEmpty(all.get("SMTP_PASS")),
      SMTP_FROM: firstNonEmpty(all.get("SMTP_FROM")),
      STRIPE_SECRET_KEY: firstNonEmpty(all.get("STRIPE_SECRET_KEY")),
      STRIPE_PRICE_ID_BOOST_GBP_10: firstNonEmpty(all.get("STRIPE_PRICE_ID_BOOST_GBP_10")),
      STRIPE_SUCCESS_URL: firstNonEmpty(all.get("STRIPE_SUCCESS_URL"), appUrl ? `${appUrl}/?billing=success` : ""),
      STRIPE_CANCEL_URL: firstNonEmpty(all.get("STRIPE_CANCEL_URL"), appUrl ? `${appUrl}/?billing=cancel` : ""),
      STRIPE_CUSTOMER_PORTAL_RETURN_URL: firstNonEmpty(all.get("STRIPE_CUSTOMER_PORTAL_RETURN_URL"), appUrl ? `${appUrl}/` : ""),
      KLIPY_API_KEY: firstNonEmpty(all.get("KLIPY_API_KEY")),
      KLIPY_API_BASE_URL: firstNonEmpty(all.get("KLIPY_API_BASE_URL")),
      KLIPY_CLIENT_KEY: firstNonEmpty(all.get("KLIPY_CLIENT_KEY")),
      DOWNLOADS_STORAGE_DIR: firstNonEmpty(all.get("DOWNLOADS_STORAGE_DIR")),
    },
  };
}

function buildServiceEnv(service, context) {
  const entries = getExampleEntries(service);
  const lines = [];
  let lastWasBlank = true;

  for (const entry of entries) {
    if (entry.type === "blank") {
      if (!lastWasBlank && lines.length) {
        lines.push("");
        lastWasBlank = true;
      }
      continue;
    }

    if (entry.type !== "key") {
      lines.push(entry.raw);
      lastWasBlank = false;
      continue;
    }

    for (const comment of entry.comments) lines.push(comment);

    const existing = context.existing[service].get(entry.key);
    const inferred = context.values[entry.key];
    const nextValue = firstNonEmpty(existing, inferred, entry.value);
    lines.push(replaceValue(`${entry.key}=${entry.value}`, nextValue));
    lastWasBlank = false;
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const context = buildContext();
  const created = [];
  const skipped = [];

  for (const service of ["core", "node", "media"]) {
    const targetPath = path.join(BACKEND_DIR, SERVICE_FILES[service]);
    if (fs.existsSync(targetPath) && !force) {
      skipped.push(service);
      continue;
    }

    const content = buildServiceEnv(service, context);
    if (!dryRun) {
      fs.writeFileSync(targetPath, content, "utf8");
    }
    created.push(service);
  }

  if (created.length) {
    console.log(`${dryRun ? "Would create" : "Created"}: ${created.map((service) => SERVICE_FILES[service]).join(", ")}`);
  }
  if (skipped.length) {
    console.log(`Skipped existing: ${skipped.map((service) => SERVICE_FILES[service]).join(", ")}`);
  }
  if (!created.length && !skipped.length) {
    console.log("Nothing to do.");
  }
}

main();
