import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.CORE_ENV_FILE,
  path.resolve(__dirname, "../../../../core.env"),
  path.resolve(__dirname, "../../../../.env.core"),
  path.resolve(__dirname, "../../../../.env"),
];

for (const candidate of candidates) {
  if (!candidate || !fs.existsSync(candidate)) continue;
  config({ path: candidate, override: true });
  break;
}
