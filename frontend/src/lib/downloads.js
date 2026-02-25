function normalizeBasePath(basePath = "/") {
  const value = String(basePath || "/").trim();
  if (!value) return "/";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const DOWNLOAD_BASE_PATH = `${normalizeBasePath(import.meta.env.BASE_URL)}/downloads`;

export const DOWNLOAD_TARGETS = [
  { href: `${DOWNLOAD_BASE_PATH}/OpenCom.exe`, label: "Windows (.exe)" },
  { href: `${DOWNLOAD_BASE_PATH}/OpenCom.deb`, label: "Linux (.deb)" },
  { href: `${DOWNLOAD_BASE_PATH}/OpenCom.snap`, label: "Linux (.snap)" },
  { href: `${DOWNLOAD_BASE_PATH}/OpenCom.tar.gz`, label: "Linux (.tar.gz)" }
];

export function getPreferredDownloadTarget(targets = DOWNLOAD_TARGETS) {
  if (typeof navigator === "undefined") return targets[0] || null;
  const platform = `${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  if (platform.includes("win")) {
    return targets.find((target) => target.label.toLowerCase().includes("windows")) || targets[0] || null;
  }
  return targets.find((target) => target.label.toLowerCase().includes(".deb")) || targets[0] || null;
}
