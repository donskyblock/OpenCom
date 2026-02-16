#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat <<USAGE
Usage: ./scripts/ops/create-server.sh --name <server-name> --base-url <https://node.url> --owner-username <username>

Creates a Core server record and assigns the specified username as owner.
Reads CORE_DATABASE_URL from backend/.env (if present) or current environment.
USAGE
}

SERVER_NAME=""
BASE_URL=""
OWNER_USERNAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      SERVER_NAME="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --owner-username)
      OWNER_USERNAME="${2:-}"
      shift 2
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    *)
      echo "[error] Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$SERVER_NAME" || -z "$BASE_URL" || -z "$OWNER_USERNAME" ]]; then
  echo "[error] Missing required arguments"
  usage
  exit 1
fi

if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$ROOT_DIR/backend/.env"; set +a
fi

if [[ -z "${CORE_DATABASE_URL:-}" ]]; then
  echo "[error] CORE_DATABASE_URL is not set. Add it to backend/.env or export it before running this script."
  exit 1
fi

cd "$ROOT_DIR/backend"

node --input-type=module - "$SERVER_NAME" "$BASE_URL" "$OWNER_USERNAME" <<'NODE'
import mysql from "mysql2/promise";

const [, , serverName, baseUrl, ownerUsername] = process.argv;
const dbUrl = process.env.CORE_DATABASE_URL;

const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 26);

const connection = await mysql.createConnection(dbUrl);

try {
  await connection.beginTransaction();

  const [userRows] = await connection.execute(
    "SELECT id FROM users WHERE username=? LIMIT 1",
    [ownerUsername]
  );

  const ownerId = userRows?.[0]?.id;
  if (!ownerId) {
    throw new Error(`OWNER_USERNAME_NOT_FOUND:${ownerUsername}`);
  }

  await connection.execute(
    "INSERT INTO servers (id,name,base_url,owner_user_id) VALUES (?,?,?,?)",
    [id, serverName, baseUrl, ownerId]
  );

  await connection.execute(
    "INSERT INTO memberships (server_id,user_id,roles) VALUES (?,?,?)",
    [id, ownerId, JSON.stringify(["owner"])]
  );

  await connection.commit();
  console.log(JSON.stringify({ serverId: id, name: serverName, baseUrl, ownerUsername }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error(error.message || error);
  process.exit(1);
} finally {
  await connection.end();
}
NODE
