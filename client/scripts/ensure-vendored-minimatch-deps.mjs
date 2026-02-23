import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");
const minimatchDir = path.join(clientDir, "vendor", "minimatch");
const nodeModulesDir = path.join(minimatchDir, "node_modules");

const sources = [
  {
    name: "balanced-match",
    from: path.join(minimatchDir, "deps-balanced-match")
  },
  {
    name: "brace-expansion",
    from: path.join(minimatchDir, "deps-brace-expansion")
  }
];

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensurePackage({ name, from }) {
  const to = path.join(nodeModulesDir, name);
  const exists = await pathExists(from);
  if (!exists) {
    throw new Error(`Missing vendored source '${from}'`);
  }

  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(from, to, { recursive: true });
}

async function main() {
  await fs.mkdir(nodeModulesDir, { recursive: true });
  for (const source of sources) {
    await ensurePackage(source);
  }
  console.log("Ensured vendored minimatch dependencies");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
