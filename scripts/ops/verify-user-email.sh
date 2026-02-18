#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
USERNAME="${1:-}"

if [[ -z "$USERNAME" ]]; then
  read -r -p "Enter username (lowercase): " USERNAME
fi

if [[ -z "$USERNAME" ]]; then
  echo "[error] Username is required."
  exit 1
fi

if [[ "$USERNAME" =~ [A-Z] ]]; then
  echo "[error] Username must be lowercase."
  exit 1
fi

if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/backend/.env"
  set +a
fi

if [[ -z "${CORE_DATABASE_URL:-}" ]]; then
  echo "[error] CORE_DATABASE_URL is not set."
  exit 1
fi

cd "$ROOT_DIR/backend"

node --input-type=module - "$USERNAME" <<'NODE'
import mysql from "mysql2/promise";

const [, , username] = process.argv;
const connection = await mysql.createConnection(process.env.CORE_DATABASE_URL);

try {
  const [rows] = await connection.execute(
    `SELECT id, username, email, email_verified_at
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [username]
  );

  if (!rows.length) {
    console.error(`[error] No user found for username "${username}".`);
    process.exit(1);
  }

  const user = rows[0];
  if (user.email_verified_at) {
    console.log(`[ok] Email already verified for ${user.username} (${user.email}).`);
    console.log(`[info] Verified at: ${user.email_verified_at}`);
    process.exit(0);
  }

  await connection.execute(
    `UPDATE users
     SET email_verified_at = NOW()
     WHERE id = ?`,
    [user.id]
  );

  console.log(`[ok] Email verified for ${user.username} (${user.email}).`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
} finally {
  await connection.end();
}
NODE
