import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

const root = process.cwd();
const vendorRoot = path.join(root, "vendor", "minimatch");
const vendorNodeModules = path.join(vendorRoot, "node_modules");

const MINIMATCH_VERSION = "10.2.1";

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed with exit code ${res.status ?? "unknown"}`,
    );
  }
}

async function packAndExtract(spec, dest) {
  const work = await fs.mkdtemp(path.join(tmpdir(), "opencom-pack-"));
  try {
    run("npm", ["pack", spec, "--silent"], work);
    const files = await fs.readdir(work);
    const tgz = files.find((f) => f.endsWith(".tgz"));
    if (!tgz) throw new Error(`No tarball produced for ${spec}`);
    run("tar", ["-xzf", tgz], work);

    await fs.rm(dest, { recursive: true, force: true });
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.cp(path.join(work, "package"), dest, {
      recursive: true,
      force: true,
      verbatimSymlinks: false,
    });
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

async function main() {
  await fs.rm(vendorRoot, { recursive: true, force: true });
  await fs.mkdir(vendorNodeModules, { recursive: true });

  // ✅ USE SAFE VERSION
  await packAndExtract(`minimatch@${MINIMATCH_VERSION}`, vendorRoot);
  await packAndExtract(
    "brace-expansion@2.0.1",
    path.join(vendorNodeModules, "brace-expansion"),
  );
  await packAndExtract(
    "balanced-match@1.0.2",
    path.join(vendorNodeModules, "balanced-match"),
  );

  // ✅ Ensure entry point
  await fs.writeFile(
    path.join(vendorRoot, "index.js"),
    "module.exports = require('./dist/commonjs/index.js')\n",
  );

  // ✅ CRITICAL: PRESERVE + FORCE VERSION
  const pkgPath = path.join(vendorRoot, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));

  pkg.version = MINIMATCH_VERSION;
  pkg.main = "index.js";
  pkg.type = "commonjs";

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  console.log(`Ensured vendored minimatch ${MINIMATCH_VERSION}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
