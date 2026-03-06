import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { ListItem } from "../components/ListItem";
import type { Channel, CoreServer, Guild } from "../types";
import { colors, radii, spacing, typography } from "../theme";

type ServersScreenProps = {
  onSelectChannel: (server: CoreServer, guild: Guild, channel: Channel) => void;
};

export function ServersScreen({ onSelectChannel }: ServersScreenProps) {
  const { api, servers, refreshServers } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState("");

  const [selectedServerId, setSelectedServerId] = useState("");
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);

  const selectedServer = useMemo(
    () => servers.find((s) => s.id === selectedServerId) ?? null,
    [servers, selectedServerId]
  );

  useEffect(() => {
    if (servers.length && !selectedServerId) setSelectedServerId(servers[0].id);
  }, [servers, selectedServerId]);

  useEffect(() => {
    if (!selectedServer) {
      setGuilds([]);
      setSelectedGuildId("");
      setChannels([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const g = await api.listGuilds(selectedServer);
        if (!alive) return;
        setGuilds(g || []);
        const preferred =
          g?.find((x) => x.id === selectedGuildId)?.id ||
          selectedServer.defaultGuildId ||
          g?.[0]?.id ||
          "";
        setSelectedGuildId(preferred);
      } catch {
        if (alive) setStatus("Failed to load guilds.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, selectedServer, selectedGuildId]);

  useEffect(() => {
    if (!selectedServer || !selectedGuildId) {
      setChannels([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const state = await api.getGuildState(selectedServer, selectedGuildId);
        if (!alive) return;
        const textChannels = (state.channels || [])
          .filter((c) => c.type === "text")
          .sort((a, b) => a.position - b.position);
        setChannels(textChannels);
      } catch {
        if (alive) setStatus("Failed to load channels.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, selectedServer, selectedGuildId]);

  const selectedGuild = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId) ?? null,
    [guilds, selectedGuildId]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      await refreshServers();
    } catch {
      setStatus("Failed to load servers.");
    } finally {
      setLoading(false);
    }
  }, [refreshServers]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const onJoinInvite = useCallback(async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setJoining(true);
    setStatus("");
    try {
      const joined = await api.joinInvite(code);
      await refreshServers();
      if (joined.serverId) setSelectedServerId(joined.serverId);
      setInviteCode("");
      setStatus("Invite accepted.");
    } catch {
      setStatus("Invite join failed.");
    } finally {
      setJoining(false);
    }
  }, [api, inviteCode, refreshServers]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.subtle}>Loading servers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inviteRow}>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          style={styles.inviteInput}
          placeholder="Invite code"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
          onPress={onJoinInvite}
          disabled={joining}
        >
          <Text style={styles.joinBtnText}>Join</Text>
        </Pressable>
      </View>

      {servers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>No servers yet. Join one with an invite code above.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Servers</Text>
          <FlatList
            data={servers}
            keyExtractor={(s) => s.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serverPills}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.pill, selectedServerId === item.id && styles.pillActive]}
                onPress={() => setSelectedServerId(item.id)}
              >
                <Text
                  style={[styles.pillText, selectedServerId === item.id && styles.pillTextActive]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </Pressable>
            )}
          />

          {selectedServer && guilds.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Guilds</Text>
              <FlatList
                data={guilds}
                keyExtractor={(g) => g.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.serverPills}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.pill, selectedGuildId === item.id && styles.pillActive]}
                    onPress={() => setSelectedGuildId(item.id)}
                  >
                    <Text
                      style={[styles.pillText, selectedGuildId === item.id && styles.pillTextActive]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            </>
          )}

          {selectedServer && selectedGuild && (
            <>
              <Text style={styles.sectionTitle}>Channels</Text>
              <FlatList
                data={channels}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => (
                  <ListItem
                    title={`# ${item.name}`}
                    onPress={() => onSelectChannel(selectedServer, selectedGuild, item)}
                  />
                )}
              />
            </>
          )}
        </>
      )}

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  subtle: { color: colors.textDim, marginTop: spacing.sm },
  empty: { color: colors.textDim, textAlign: "center", padding: spacing.xl },
  inviteRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  inviteInput: {
    flex: 1,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text
  },
  joinBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    justifyContent: "center"
  },
  joinBtnDisabled: { opacity: 0.7 },
  joinBtnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm
  },
  serverPills: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    backgroundColor: colors.elev,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full
  },
  pillActive: { backgroundColor: colors.brand },
  pillText: { color: colors.textSoft },
  pillTextActive: { color: "#fff", fontWeight: "600" },
  status: { color: colors.textDim, fontSize: 13, marginTop: spacing.sm }
});
