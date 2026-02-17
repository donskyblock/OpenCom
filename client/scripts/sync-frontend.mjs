import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientDir, "..");
const frontendDistDir = path.resolve(repoRoot, "frontend", "dist");
const clientWebDir = path.resolve(clientDir, "src", "web");

async function copyDir(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

async function rewriteIndexForFileProtocol(webDir) {
  const indexPath = path.resolve(webDir, "index.html");
  const raw = await fs.readFile(indexPath, "utf8");
  const rewritten = raw
    .replace(/src="\/assets\//g, 'src="./assets/')
    .replace(/href="\/assets\//g, 'href="./assets/');
  if (rewritten !== raw) {
    await fs.writeFile(indexPath, rewritten, "utf8");
  }
}

async function main() {
  await fs.access(frontendDistDir);
  await copyDir(frontendDistDir, clientWebDir);
  await rewriteIndexForFileProtocol(clientWebDir);
  console.log("Synced frontend/dist -> client/src/web");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
