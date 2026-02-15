import { getLatestOfficialBuild } from "./src/latestBuild.js";

const platformArg = process.argv[2];
const baseUrlArg = process.argv[3];

const result = await getLatestOfficialBuild({
  platform: platformArg || process.platform,
  baseUrl: baseUrlArg
});

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
