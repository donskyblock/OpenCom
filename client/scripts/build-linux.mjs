import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "..");

const isWindows = process.platform === "win32";
const electronBuilderCmd = isWindows
  ? path.join(clientDir, "node_modules", ".bin", "electron-builder.cmd")
  : path.join(clientDir, "node_modules", ".bin", "electron-builder");

function run(cmd, args, cwd = clientDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: isWindows,
      stdio: "inherit"
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${cmd} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const requireDeb = process.env.OPENCOM_REQUIRE_DEB === "1";
  const tarballPath = path.join(clientDir, "dist", "OpenCom.tar.gz");

  try {
    await run(electronBuilderCmd, ["--linux", "deb", "tar.gz"]);
    return;
  } catch (error) {
    if (requireDeb) {
      throw error;
    }
    const hasTarball = await fileExists(tarballPath);
    if (hasTarball) {
      console.warn("Deb packaging failed; tar.gz artifact was produced successfully.");
      console.warn("Install libxcrypt-compat to restore .deb packaging on Arch-based systems.");
      return;
    }
    console.warn("Deb packaging failed. Falling back to tar.gz only.");
  }

  await run(electronBuilderCmd, ["--linux", "tar.gz"]);
  console.warn("Built tar.gz successfully. Install libxcrypt-compat to restore .deb packaging on Arch-based systems.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
