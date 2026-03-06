import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createApiClient } from "../api";
import { resolveCoreApiUrl } from "../config";
import { loadTokens, saveTokens, clearTokens } from "../storage";
import type { AuthTokens, CoreServer } from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

type AuthContextValue = {
  api: ApiClient;
  tokens: AuthTokens | null;
  setTokens: (tokens: AuthTokens | null) => Promise<void>;
  me: { id: string; username: string } | null;
  setMe: (me: { id: string; username: string } | null) => void;
  servers: CoreServer[];
  setServers: React.Dispatch<React.SetStateAction<CoreServer[]>>;
  refreshServers: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const coreApiUrl = useMemo(() => resolveCoreApiUrl(), []);
  const tokensRef = useRef<AuthTokens | null>(null);

  const [tokens, setTokensState] = useState<AuthTokens | null>(null);
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [servers, setServers] = useState<CoreServer[]>([]);

  const setTokens = useCallback(async (next: AuthTokens | null) => {
    tokensRef.current = next;
    setTokensState(next);
    if (next) {
      await saveTokens(next);
    } else {
      await clearTokens();
      setMe(null);
      setServers([]);
    }
  }, []);

  const api = useMemo(
    () =>
      createApiClient({
        coreApiUrl,
        getTokens: () => tokensRef.current,
        setTokens,
        updateServerMembershipToken: (serverId, membershipToken) => {
          setServers((current) =>
            current.map((s) => (s.id === serverId ? { ...s, membershipToken } : s))
          );
        }
      }),
    [coreApiUrl, setTokens]
  );

  const refreshServers = useCallback(async () => {
    const [meData, serversData] = await Promise.all([api.getMe(), api.getServers()]);
    setMe({ id: meData.id, username: meData.username });
    setServers(serversData.servers || []);
  }, [api]);

  const value = useMemo(
    () => ({ api, tokens, setTokens, me, setMe, servers, setServers, refreshServers }),
    [api, tokens, setTokens, me, servers, refreshServers]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
