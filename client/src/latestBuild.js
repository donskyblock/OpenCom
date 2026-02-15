const DEFAULT_REPOSITORY = process.env.GITHUB_REPOSITORY || "donskyblock/OpenCom";
const DEFAULT_BRANCH = process.env.OPENCOM_BUILD_BRANCH || "main";
const DEFAULT_BASE_URL = process.env.OPENCOM_BUILD_BASE_URL || `https://raw.githubusercontent.com/${DEFAULT_REPOSITORY}/${DEFAULT_BRANCH}`;

const BUILD_TARGETS = {
  win32: "frontend/OpenCom.exe",
  linux: "frontend/OpenCom.deb",
  darwin: "frontend/OpenCom.tar.gz"
};

const FALLBACK_PATHS = [
  "frontend/OpenCom.exe",
  "frontend/OpenCom.deb",
  "frontend/OpenCom.tar.gz"
];

async function exists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export async function getLatestOfficialBuild({ platform = process.platform, baseUrl } = {}) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const preferred = BUILD_TARGETS[platform];
  const candidates = preferred
    ? [preferred, ...FALLBACK_PATHS.filter((item) => item !== preferred)]
    : FALLBACK_PATHS;

  for (const relativePath of candidates) {
    const url = `${normalizedBase}/${relativePath}`;
    if (await exists(url)) {
      return {
        ok: true,
        platform,
        path: relativePath,
        url
      };
    }
  }

  return {
    ok: false,
    platform,
    checked: candidates,
    message: "No official build found at frontend/OpenCom.exe, frontend/OpenCom.deb, or frontend/OpenCom.tar.gz"
  };
}

