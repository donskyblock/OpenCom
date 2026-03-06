import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useCoreGateway, httpToCoreGatewayWs } from "../hooks/useGateway";
import { Avatar } from "../components/Avatar";
import type { DmThreadApi } from "../types";
import { colors, radii, spacing, typography } from "../theme";

type DmsScreenProps = {
  onSelectDm: (thread: DmThreadApi) => void;
};

function formatLastTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function DmsScreen({ onSelectDm }: DmsScreenProps) {
  const {
    api,
    tokens,
    coreApiUrl,
    presenceByUserId,
    dmThreads,
    setDmThreads,
    upsertDmMessage,
    updatePresence,
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");

  const gatewayWsUrl = httpToCoreGatewayWs(coreApiUrl);

  // ── Load DMs ─────────────────────────────────────────────────────────────

  const loadDms = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setStatus("");
      try {
        const data = await api.getDms();
        const threads = (data.dms ?? []) as DmThreadApi[];
        setDmThreads(threads);
      } catch {
        setStatus("Failed to load messages.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, setDmThreads],
  );

  useEffect(() => {
    loadDms();
  }, [loadDms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDms(true);
  }, [loadDms]);

  // ── Real-time gateway ────────────────────────────────────────────────────

  useCoreGateway({
    wsUrl: gatewayWsUrl,
    accessToken: tokens?.accessToken ?? null,
    enabled: !!tokens?.accessToken,
    onEvent: useCallback(
      (event) => {
        if (event.type === "DM_NEW_MESSAGE") {
          upsertDmMessage(event.threadId, event.message);
          // If thread not in list yet, refresh from server
          setDmThreads((prev) => {
            const exists = prev.some((t) => t.id === event.threadId);
            if (!exists) {
              // Trigger a background refresh to pick up new thread
              api
                .getDms()
                .then((data) => {
                  setDmThreads(data.dms ?? []);
                })
                .catch(() => {});
            }
            return prev;
          });
        } else if (event.type === "PRESENCE_UPDATE") {
          updatePresence(event.userId, event.status, event.customStatus);
        }
      },
      [upsertDmMessage, updatePresence, api, setDmThreads],
    ),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.subtle}>Loading messages...</Text>
      </View>
    );
  }

  if (dmThreads.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.empty}>No direct messages yet.</Text>
        <Text style={styles.emptyHint}>
          Add friends to start a conversation.
        </Text>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={dmThreads}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const presence = presenceByUserId[item.participantId];
          const status = presence?.status;
          const lastTime = formatLastTime(item.lastMessageAt);
          const preview = item.lastMessageContent
            ? item.lastMessageContent.length > 60
              ? item.lastMessageContent.slice(0, 60) + "…"
              : item.lastMessageContent
            : null;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.threadRow,
                pressed && styles.threadRowPressed,
              ]}
              onPress={() => onSelectDm(item)}
            >
              <Avatar
                username={item.name}
                pfpUrl={item.pfp_url}
                size={46}
                status={status}
                showStatus
              />
              <View style={styles.threadInfo}>
                <View style={styles.threadTop}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {lastTime ? (
                    <Text style={styles.threadTime}>{lastTime}</Text>
                  ) : null}
                </View>
                {preview ? (
                  <Text style={styles.threadPreview} numberOfLines={1}>
                    {preview}
                  </Text>
                ) : status ? (
                  <Text
                    style={[styles.threadPreview, styles.threadPreviewStatus]}
                    numberOfLines={1}
                  >
                    {presence?.customStatus ?? status}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  subtle: { color: colors.textDim, marginTop: spacing.sm },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  empty: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
    fontWeight: "600",
  },
  emptyHint: {
    color: colors.textDim,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  status: {
    color: colors.textDim,
    fontSize: 13,
    padding: spacing.md,
    textAlign: "center",
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  threadRowPressed: { backgroundColor: colors.hover },
  threadInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  threadTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  threadName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },
  threadTime: {
    ...typography.label,
    color: colors.textDim,
    flexShrink: 0,
  },
  threadPreview: {
    ...typography.caption,
    color: colors.textDim,
  },
  threadPreviewStatus: {
    textTransform: "capitalize",
    fontStyle: "italic",
  },
  chevron: {
    fontSize: 20,
    color: colors.textDim,
    flexShrink: 0,
  },
});
