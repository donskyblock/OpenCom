import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientDir, "..");
const frontendDir = path.resolve(repoRoot, "frontend");
const clientWebDir = path.resolve(clientDir, "src", "web");
const frontendSrcDir = path.resolve(frontendDir, "src");
const frontendIndexHtml = path.resolve(frontendDir, "index.html");
const frontendViteConfig = path.resolve(frontendDir, "vite.config.js");
const frontendPackageJson = path.resolve(frontendDir, "package.json");
const frontendLockFile = path.resolve(frontendDir, "package-lock.json");
const clientWebIndex = path.resolve(clientWebDir, "index.html");

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

async function copyBrandAssets() {
  const assets = ["logo.png", "logo.jpg"];
  await Promise.all(assets.map(async (name) => {
    const source = path.resolve(frontendDir, name);
    const destination = path.resolve(clientWebDir, name);
    try {
      await fs.copyFile(source, destination);
    } catch {}
  }));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function latestMtimeMsInTree(rootDir) {
  let latest = 0;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.resolve(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      const stat = await fs.stat(full);
      if (stat.mtimeMs > latest) latest = stat.mtimeMs;
    }
  }
  return latest;
}

async function latestFrontendInputMtimeMs() {
  const paths = [frontendIndexHtml, frontendViteConfig, frontendPackageJson, frontendLockFile];
  let latest = await latestMtimeMsInTree(frontendSrcDir);
  for (const p of paths) {
    if (!(await exists(p))) continue;
    const stat = await fs.stat(p);
    if (stat.mtimeMs > latest) latest = stat.mtimeMs;
  }
  return latest;
}

async function shouldBuild() {
  if (process.env.OPENCOM_FORCE_SYNC_WEB === "1") return true;
  if (!(await exists(clientWebIndex))) return true;
  const outputStat = await fs.stat(clientWebIndex);
  const inputLatest = await latestFrontendInputMtimeMs();
  return inputLatest > outputStat.mtimeMs;
}

async function main() {
  if (!(await shouldBuild())) {
    console.log("Embedded frontend is up to date; skipping rebuild.");
    return;
  }

  const outDirArg = path.relative(frontendDir, clientWebDir).replace(/\\/g, "/");
  await run("npm", ["run", "build", "--", "--base", "./", "--outDir", outDirArg, "--emptyOutDir"], frontendDir);
  await copyBrandAssets();
  console.log("Built frontend directly into client/src/web");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
