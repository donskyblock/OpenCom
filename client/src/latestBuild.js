const DEFAULT_BASE_URL = process.env.OPENCOM_BUILD_BASE_URL || "https://opencom.online";

const BUILD_TARGETS = {
  win32: "downloads/opencom.exe",
  linux: "downloads/opencom.deb",
  darwin: "downloads/opencom.tar.gz"
};

const FALLBACK_PATHS = [
  "downloads/opencom.exe",
  "downloads/opencom.deb",
  "downloads/opencom.tar.gz"
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
    message: "No official build found at /downloads/opencom.exe, /downloads/opencom.deb, or /downloads/opencom.tar.gz"
  };
}
