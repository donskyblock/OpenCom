#!/usr/bin/env node
/**
 * scripts/create-private-calls-guild.mjs
 *
 * One-time bootstrap script.
 *
 * Creates the "system guild" on the official server-node that is used
 * exclusively to host ephemeral voice channels for private (1:1) calls.
 * The guild is hidden from all user-facing guild listings (is_system = 1).
 *
 * Usage:
 *   node scripts/create-private-calls-guild.mjs
 *   # or, if you need to point at a different env file:
 *   ENV_FILE=../backend/.env node scripts/create-private-calls-guild.mjs
 *
 * Required env vars (loaded from ../backend/.env by default):
 *   OFFICIAL_NODE_BASE_URL       HTTP base URL of the official server-node
 *   OFFICIAL_NODE_SERVER_ID      NODE_SERVER_ID configured on that node
 *   CORE_MEMBERSHIP_PRIVATE_JWK  Private JWK for signing membership tokens
 *   CORE_ISSUER                  JWT issuer string (e.g. https://opencom.online)
 *   CORE_NODE_SYNC_SECRET        Shared secret for internal node-to-node calls
 *
 * On success the script prints:
 *   PRIVATE_CALLS_GUILD_ID=<id>
 *
 * Add that line to your core .env file and restart the core server.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT, importJWK } from "jose";

// ─── Environment loading ──────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

const envFilePath = process.env.ENV_FILE
  ? resolve(process.cwd(), process.env.ENV_FILE)
  : resolve(__dirname, "../backend/.env");

/**
 * Minimal .env parser — handles KEY=VALUE, quoted values, and # comments.
 * We intentionally avoid depending on dotenv so the script is self-contained.
 */
function loadEnvFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`Could not read env file at ${filePath}: ${err.message}`);
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Only set if not already in the environment (process.env takes priority)
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

console.log(`Loading environment from: ${envFilePath}`);
loadEnvFile(envFilePath);

// ─── Validate required vars ───────────────────────────────────────────────────

const REQUIRED = [
  "OFFICIAL_NODE_BASE_URL",
  "OFFICIAL_NODE_SERVER_ID",
  "CORE_MEMBERSHIP_PRIVATE_JWK",
  "CORE_ISSUER",
  "CORE_NODE_SYNC_SECRET",
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("\n❌  Missing required environment variables:");
  for (const k of missing) console.error(`     ${k}`);
  console.error(
    "\nMake sure these are set in your backend/.env (or the file pointed to by $ENV_FILE).",
  );
  process.exit(1);
}

const NODE_BASE_URL = process.env.OFFICIAL_NODE_BASE_URL.replace(/\/$/, "");
const NODE_SERVER_ID = process.env.OFFICIAL_NODE_SERVER_ID;
const SYNC_SECRET = process.env.CORE_NODE_SYNC_SECRET;
const CORE_ISSUER = process.env.CORE_ISSUER;
const PRIVATE_JWK_RAW = process.env.CORE_MEMBERSHIP_PRIVATE_JWK;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sign a short-lived membership token for the official node with
 * platform_owner privileges — this is needed to call POST /v1/guilds.
 */
async function signPlatformOwnerToken(userId = "system-setup") {
  const privateJwk = JSON.parse(PRIVATE_JWK_RAW);
  const priv = await importJWK(privateJwk, "RS256");

  return new SignJWT({
    server_id: NODE_SERVER_ID,
    core_server_id: NODE_SERVER_ID,
    roles: ["owner", "platform_admin", "platform_owner"],
    platform_role: "owner",
  })
    .setProtectedHeader({ alg: "RS256", kid: privateJwk.kid })
    .setIssuer(CORE_ISSUER)
    .setAudience(NODE_SERVER_ID)
    .setSubject(userId)
    .setExpirationTime("5m")
    .sign(priv);
}

async function nodePost(path, body, membershipToken) {
  const headers = { "Content-Type": "application/json" };
  if (membershipToken) headers["Authorization"] = `Bearer ${membershipToken}`;

  const resp = await fetch(`${NODE_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }

  return { ok: resp.ok, status: resp.status, data: json };
}

async function nodeRequest(method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };

  const resp = await fetch(`${NODE_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }

  return { ok: resp.ok, status: resp.status, data: json };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔧  Private-Calls Guild Bootstrap");
  console.log("──────────────────────────────────");
  console.log(`   Node URL:  ${NODE_BASE_URL}`);
  console.log(`   Server ID: ${NODE_SERVER_ID}`);
  console.log();

  // ── Step 1: Create the guild ──────────────────────────────────────────────

  console.log("Step 1/2  Creating the private-calls guild on the node…");

  const token = await signPlatformOwnerToken();

  const createResp = await nodePost(
    "/v1/guilds",
    {
      name: "Private Calls",
      // No default voice channel — channels are created dynamically per call
      createDefaultVoice: false,
    },
    token,
  );

  if (!createResp.ok) {
    console.error(`\n❌  POST /v1/guilds failed (${createResp.status}):`);
    console.error(JSON.stringify(createResp.data, null, 2));

    if (createResp.status === 403) {
      console.error(
        "\nHint: The node rejected the token.  Make sure OFFICIAL_NODE_SERVER_ID in your\n" +
          "core .env matches the NODE_SERVER_ID configured on the server-node.",
      );
    }
    process.exit(1);
  }

  const guildId = createResp.data?.guildId;
  if (!guildId) {
    console.error(
      "\n❌  Guild created but response did not contain a guildId:",
    );
    console.error(JSON.stringify(createResp.data, null, 2));
    process.exit(1);
  }

  console.log(`   ✅  Guild created: ${guildId}`);

  // ── Step 2: Mark the guild as a system guild ──────────────────────────────

  console.log("Step 2/2  Marking guild as is_system via internal API…");

  const markResp = await nodeRequest(
    "POST",
    "/v1/internal/mark-system-guild",
    { guildId },
    { "x-node-sync-secret": SYNC_SECRET },
  );

  if (!markResp.ok) {
    // The mark-system endpoint may not be deployed yet on older nodes.
    // Print a fallback SQL command the admin can run manually.
    console.warn(
      `\n⚠️   Could not mark the guild via API (${markResp.status}).` +
        "\n    This is OK if your server-node is not yet updated." +
        "\n    Run the following SQL on your server-node database to finish setup:\n",
    );
    console.warn(
      `    UPDATE guilds SET is_system = 1 WHERE id = '${guildId}';\n`,
    );
  } else {
    console.log("   ✅  Guild marked as system (hidden from user listings).");
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  console.log("\n✅  Done!  Add the following line to your backend/.env:\n");
  console.log(`   PRIVATE_CALLS_GUILD_ID=${guildId}`);
  console.log(
    "\nThen restart the core server.  No server-node restart is needed.",
  );
  console.log();
}

main().catch((err) => {
  console.error("\n💥  Unexpected error:", err.message ?? err);
  process.exit(1);
});
