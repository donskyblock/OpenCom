import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { isIP } from "node:net";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCloudRun = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.CLOUD_RUN_EXECUTION);
export const mediaEnvFilePath = loadMediaEnv();

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

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

function loadMediaEnv() {
  const candidates = [
    process.env.MEDIA_ENV_FILE,
    path.resolve(process.cwd(), "media.env"),
    path.resolve(process.cwd(), ".env.media"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../../media.env"),
    path.resolve(__dirname, "../../../.env.media"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../../../../media.env"),
    path.resolve(__dirname, "../../../../../.env.media"),
    path.resolve(__dirname, "../../../../../.env"),
    path.resolve(__dirname, "../media.env"),
    path.resolve(__dirname, "../../media.env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
  ];

  for (const candidate of new Set(candidates)) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    config({ path: candidate, override: true });
    return candidate;
  }

  return null;
}

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MEDIA_PORT: z.preprocess(
    (value) => value ?? process.env.PORT,
    z.coerce.number().default(3003)
  ),
  MEDIA_HOST: z.string().default("0.0.0.0"),
  MEDIA_DATABASE_URL: z.preprocess(
    (value) => value ?? process.env.NODE_DATABASE_URL,
    z.string().min(1),
  ),
  CORE_BASE_URL: z.string().url(),
  MEDIA_SERVER_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  MEDIA_WS_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  MEDIA_ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  MEDIA_TOKEN_SECRET: z.string().min(16),
  MEDIA_TOKEN_ISSUER: z.string().min(1).default("opencom-media"),
  MEDIA_TOKEN_AUDIENCE: z.preprocess(emptyToUndefined, z.string().optional()),
  MEDIA_SYNC_SECRET: z.preprocess(
    (value) => value ?? process.env.NODE_SYNC_SECRET,
    z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  ),

  MEDIASOUP_LISTEN_IP: z.string().default("0.0.0.0"),
  MEDIASOUP_ANNOUNCED_ADDRESS: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  MEDIASOUP_ANNOUNCED_IP: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  MEDIASOUP_RTC_MIN_PORT: z.coerce.number().default(40000),
  MEDIASOUP_RTC_MAX_PORT: z.coerce.number().default(40100),
  MEDIASOUP_ENABLE_UDP: boolFlag.default(true),
  MEDIASOUP_ENABLE_TCP: boolFlag.default(true),
  MEDIASOUP_PREFER_UDP: boolFlag.default(true),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("warn"),
  LOG_DIR: z.string().default("./logs"),
  LOG_TO_FILE: z.preprocess(
    (value) => value ?? (isCloudRun ? "0" : undefined),
    boolFlag.default(true)
  ),
  DEBUG_HTTP: boolFlag.default(false),
  DEBUG_VOICE: boolFlag.default(false),
});

export const env = Env.parse(process.env);

if (env.MEDIASOUP_RTC_MIN_PORT > env.MEDIASOUP_RTC_MAX_PORT) {
  throw new Error(
    `INVALID_MEDIASOUP_PORT_RANGE:${env.MEDIASOUP_RTC_MIN_PORT}>${env.MEDIASOUP_RTC_MAX_PORT}`,
  );
}

if (!env.MEDIASOUP_ENABLE_UDP && !env.MEDIASOUP_ENABLE_TCP) {
  throw new Error("INVALID_MEDIASOUP_TRANSPORT_CONFIG:NO_PROTOCOLS_ENABLED");
}

function stripAddressBrackets(value: string) {
  return String(value || "").trim().replace(/^\[(.*)\]$/, "$1");
}

function isLoopbackHostname(hostname: string) {
  const normalized = stripAddressBrackets(hostname).toLowerCase();
  if (!normalized) return false;
  return normalized === "localhost"
    || normalized === "::1"
    || normalized === "0:0:0:0:0:0:0:1"
    || normalized.startsWith("127.");
}

function isUnspecifiedHostname(hostname: string) {
  const normalized = stripAddressBrackets(hostname).toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::" || normalized === "";
}

function isPrivateIpv4Address(address: string) {
  if (isIP(address) !== 4) return false;
  const octets = address.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return false;
  }
  return octets[0] === 10
    || octets[0] === 127
    || octets[0] === 0
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127);
}

function isPrivateIpv6Address(address: string) {
  if (isIP(address) !== 6) return false;
  const normalized = stripAddressBrackets(address).toLowerCase();
  return normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb");
}

function normalizeHttpBaseUrl(value?: string | null) {
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

function normalizeWsUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:") parsed.protocol = "ws:";
    if (parsed.protocol === "https:") parsed.protocol = "wss:";
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return "";
    parsed.pathname = "/gateway";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizeOrigin(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "*") return "*";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function parseAllowedOrigins(input?: string | null) {
  const values = String(input || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
  return Array.from(new Set(values));
}

export const resolvedMediaServerUrl = normalizeHttpBaseUrl(env.MEDIA_SERVER_URL);
export const resolvedMediaWsUrl = normalizeWsUrl(
  env.MEDIA_WS_URL || resolvedMediaServerUrl,
);
export const mediaAllowedOrigins = parseAllowedOrigins(env.MEDIA_ALLOWED_ORIGINS);

export function isMediaOriginAllowed(origin?: string | null) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  if (mediaAllowedOrigins.includes("*")) return true;
  if (mediaAllowedOrigins.length) return mediaAllowedOrigins.includes(normalized);
  if (env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(normalized);
      return isLoopbackHostname(parsed.hostname) || parsed.hostname.endsWith(".localhost");
    } catch {
      return false;
    }
  }
  return false;
}

export type MediasoupAnnouncedAddressSource =
  | "MEDIASOUP_ANNOUNCED_ADDRESS"
  | "MEDIASOUP_ANNOUNCED_IP"
  | "MEDIA_SERVER_URL"
  | "MEDIA_WS_URL"
  | null;

export type MediasoupAnnouncedAddressKind =
  | "missing"
  | "loopback"
  | "unspecified"
  | "private"
  | "public-ip"
  | "hostname";

type ResolvedMediasoupAnnouncedAddress = {
  address: string | undefined;
  source: MediasoupAnnouncedAddressSource;
};

function resolveMediasoupAnnouncedAddress(): ResolvedMediasoupAnnouncedAddress {
  if (env.MEDIASOUP_ANNOUNCED_ADDRESS) {
    return {
      address: env.MEDIASOUP_ANNOUNCED_ADDRESS,
      source: "MEDIASOUP_ANNOUNCED_ADDRESS",
    };
  }
  if (env.MEDIASOUP_ANNOUNCED_IP) {
    return {
      address: env.MEDIASOUP_ANNOUNCED_IP,
      source: "MEDIASOUP_ANNOUNCED_IP",
    };
  }

  const candidates: Array<[string, MediasoupAnnouncedAddressSource]> = [
    [resolvedMediaServerUrl, "MEDIA_SERVER_URL"],
    [resolvedMediaWsUrl, "MEDIA_WS_URL"],
  ];

  for (const [value, source] of candidates) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (isLoopbackHostname(parsed.hostname) || isUnspecifiedHostname(parsed.hostname)) {
        continue;
      }
      return {
        address: parsed.hostname || undefined,
        source: parsed.hostname ? source : null,
      };
    } catch {
      continue;
    }
  }

  return { address: undefined, source: null };
}

function classifyMediasoupAnnouncedAddress(
  address?: string,
): MediasoupAnnouncedAddressKind {
  const normalized = stripAddressBrackets(address || "").toLowerCase();
  if (!normalized) return "missing";
  if (isLoopbackHostname(normalized)) return "loopback";
  if (isUnspecifiedHostname(normalized)) return "unspecified";
  if (isPrivateIpv4Address(normalized) || isPrivateIpv6Address(normalized)) {
    return "private";
  }
  return isIP(normalized) ? "public-ip" : "hostname";
}

const resolvedAnnouncedAddress = resolveMediasoupAnnouncedAddress();

export const resolvedMediasoupAnnouncedAddress = resolvedAnnouncedAddress.address;
export const resolvedMediasoupAnnouncedAddressSource = resolvedAnnouncedAddress.source;
export const resolvedMediasoupAnnouncedAddressKind = classifyMediasoupAnnouncedAddress(
  resolvedMediasoupAnnouncedAddress,
);

export type MediasoupNetworkingWarning = {
  code: string;
  message: string;
};

export const mediasoupNetworkingWarnings: MediasoupNetworkingWarning[] = (() => {
  const warnings: MediasoupNetworkingWarning[] = [];

  if (resolvedMediasoupAnnouncedAddressKind === "missing") {
    warnings.push({
      code: "ANNOUNCED_ADDRESS_UNSET",
      message:
        "Mediasoup is not advertising a reachable public hostname or IP. Set MEDIASOUP_ANNOUNCED_ADDRESS or MEDIA_SERVER_URL for EC2 deployments.",
    });
  } else if (resolvedMediasoupAnnouncedAddressKind === "loopback") {
    warnings.push({
      code: "ANNOUNCED_ADDRESS_LOOPBACK",
      message:
        "Mediasoup is advertising a loopback address. Only same-host clients can reach this media service.",
    });
  } else if (resolvedMediasoupAnnouncedAddressKind === "unspecified") {
    warnings.push({
      code: "ANNOUNCED_ADDRESS_UNSPECIFIED",
      message:
        "Mediasoup is advertising an unspecified address such as 0.0.0.0 or ::, which browsers cannot use for ICE.",
    });
  } else if (resolvedMediasoupAnnouncedAddressKind === "private") {
    warnings.push({
      code: "ANNOUNCED_ADDRESS_PRIVATE",
      message:
        "Mediasoup is advertising a private address. Internet clients will fail unless they can reach that private network directly.",
    });
  }

  if (!env.MEDIASOUP_ENABLE_UDP) {
    warnings.push({
      code: "UDP_DISABLED",
      message:
        "UDP is disabled for mediasoup transports. WebRTC reliability drops significantly on restrictive networks without TURN.",
    });
  }

  return warnings;
})();
