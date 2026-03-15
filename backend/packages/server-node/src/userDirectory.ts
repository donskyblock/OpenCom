import { env } from "./env.js";

export type BasicUserProfile = {
  id: string;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
};

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { expiresAt: number; profile: BasicUserProfile }>();

export async function resolveCoreUserProfiles(userIds: string[]): Promise<Map<string, BasicUserProfile>> {
  const out = new Map<string, BasicUserProfile>();
  const uniqueIds = Array.from(new Set((userIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  const missingIds: string[] = [];
  const now = Date.now();

  for (const userId of uniqueIds) {
    const cached = userCache.get(userId);
    if (cached && cached.expiresAt > now) {
      out.set(userId, cached.profile);
      continue;
    }
    missingIds.push(userId);
  }

  if (missingIds.length) {
    const fetched = await Promise.all(missingIds.map((userId) => fetchCoreUserProfile(userId)));
    for (let index = 0; index < missingIds.length; index += 1) {
      const userId = missingIds[index];
      const profile = fetched[index] || fallbackProfile(userId);
      userCache.set(userId, { expiresAt: now + USER_CACHE_TTL_MS, profile });
      out.set(userId, profile);
    }
  }

  for (const userId of uniqueIds) {
    if (!out.has(userId)) out.set(userId, fallbackProfile(userId));
  }

  return out;
}

export function preferredDisplayName(
  userId: string,
  profile?: BasicUserProfile | null,
  preferredName?: string | null
) {
  const direct = String(preferredName || "").trim();
  if (direct) return direct;
  const displayName = String(profile?.displayName || "").trim();
  if (displayName) return displayName;
  const username = String(profile?.username || "").trim();
  if (username) return username;
  return userId;
}

function fallbackProfile(userId: string): BasicUserProfile {
  return {
    id: userId,
    username: userId,
    displayName: null,
    pfpUrl: null
  };
}

async function fetchCoreUserProfile(userId: string): Promise<BasicUserProfile> {
  if (!userId || userId.startsWith("ext:")) return fallbackProfile(userId);

  const baseUrl = String(env.CORE_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) return fallbackProfile(userId);

  try {
    const response = await fetch(`${baseUrl}/v1/users/${encodeURIComponent(userId)}/profile`);
    if (!response.ok) return fallbackProfile(userId);

    const data = await response.json().catch(() => ({} as any));
    return {
      id: userId,
      username: String(data?.username || userId),
      displayName: data?.displayName ? String(data.displayName) : null,
      pfpUrl: data?.pfpUrl ? String(data.pfpUrl) : null
    };
  } catch {
    return fallbackProfile(userId);
  }
}
