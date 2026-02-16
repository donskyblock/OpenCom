#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

read -r -p "Extension scope [server/client] (default: server): " SCOPE_INPUT
SCOPE="$(echo "${SCOPE_INPUT:-server}" | tr '[:upper:]' '[:lower:]')"
if [[ "${SCOPE}" != "server" && "${SCOPE}" != "client" ]]; then
  echo "Scope must be 'server' or 'client'."
  exit 1
fi

read -r -p "Extension id (kebab-case): " EXT_ID
if [[ -z "${EXT_ID}" ]]; then
  echo "Extension id is required."
  exit 1
fi

read -r -p "Extension name: " EXT_NAME
if [[ -z "${EXT_NAME}" ]]; then
  EXT_NAME="${EXT_ID}"
fi

read -r -p "Author (optional): " EXT_AUTHOR
read -r -p "Description (optional): " EXT_DESC

TARGET_DIR="${ROOT_DIR}/$(tr '[:lower:]' '[:upper:]' <<< "${SCOPE:0:1}")${SCOPE:1}/${EXT_ID}"
if [[ -e "${TARGET_DIR}" ]]; then
  echo "Extension directory already exists: ${TARGET_DIR}"
  exit 1
fi

mkdir -p "${TARGET_DIR}"

cat > "${TARGET_DIR}/extension.json" <<EOF
{
  "id": "${EXT_ID}",
  "name": "${EXT_NAME}",
  "author": "${EXT_AUTHOR}",
  "version": "0.1.0",
  "description": "${EXT_DESC}",
  "scope": "${SCOPE}",
  "entry": "index.js",
  "permissions": ["all"],
  "configDefaults": {}
}
EOF

if [[ "${SCOPE}" == "server" ]]; then
  cat > "${TARGET_DIR}/index.js" <<'EOF'
import { command, createServerContext } from "../../lib/opencom-extension-sdk.js";

export const commands = [
  command({
    name: "hello",
    description: "Example command",
    async execute(ctx) {
      return { content: `Hello from ${ctx.meta.extensionId}` };
    }
  })
];

export async function activate(ctx) {
  const context = createServerContext(ctx);
  context.log(`Activated on server ${ctx.serverId}`);
}

export async function deactivate(ctx) {
  const context = createServerContext(ctx);
  context.log(`Deactivated on server ${ctx.serverId}`);
}
EOF
else
  cat > "${TARGET_DIR}/index.js" <<'EOF'
export async function activateClient(api) {
  api.setStatus?.("Client extension loaded.");
}
EOF
fi

echo "Created extension scaffold at ${TARGET_DIR}"
