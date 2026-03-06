import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import type { Friend } from "../types";
import { colors, radii, spacing, typography } from "../theme";

type FriendsScreenProps = {
  onOpenDm: (friend: Friend) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  online: colors.success,
  idle: "#f0b429",
  dnd: colors.danger,
  offline: colors.textDim,
  invisible: colors.textDim,
};

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
  invisible: "Invisible",
};

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {title.toUpperCase()} — {count}
      </Text>
    </View>
  );
}

// ─── Friend row ───────────────────────────────────────────────────────────────

function FriendRow({
  friend,
  status,
  customStatus,
  onMessage,
  onRemove,
}: {
  friend: Friend;
  status?: string | null;
  customStatus?: string | null;
  onMessage: () => void;
  onRemove: () => void;
}) {
  const resolvedStatus = status ?? friend.status ?? "offline";
  const statusColor = STATUS_COLORS[resolvedStatus] ?? STATUS_COLORS.offline;
  const statusLabel =
    customStatus ?? STATUS_LABELS[resolvedStatus] ?? "Offline";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.friendRow,
        pressed && styles.friendRowPressed,
      ]}
      onPress={onMessage}
    >
      <Avatar
        username={friend.username}
        pfpUrl={friend.pfp_url}
        size={44}
        status={resolvedStatus}
        showStatus
      />

      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {friend.username}
        </Text>
        <Text
          style={[styles.friendStatus, { color: statusColor }]}
          numberOfLines={1}
        >
          {statusLabel}
        </Text>
      </View>

      <View style={styles.friendActions}>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            styles.iconBtnMessage,
            pressed && styles.iconBtnPressed,
          ]}
          onPress={onMessage}
          hitSlop={6}
        >
          <Text style={styles.iconBtnText}>💬</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            styles.iconBtnRemove,
            pressed && styles.iconBtnPressed,
          ]}
          onPress={onRemove}
          hitSlop={6}
        >
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Incoming request row ─────────────────────────────────────────────────────

function IncomingRequestRow({
  request,
  onAccept,
  onDecline,
}: {
  request: { id: string; userId: string; username: string };
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.requestRow}>
      <Avatar username={request.username} size={40} />
      <Text style={styles.requestName} numberOfLines={1}>
        {request.username}
      </Text>
      <View style={styles.requestActions}>
        <Pressable
          style={({ pressed }) => [
            styles.acceptBtn,
            pressed && styles.acceptBtnPressed,
          ]}
          onPress={onAccept}
        >
          <Text style={styles.acceptBtnText}>✓ Accept</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.declineBtn,
            pressed && styles.declineBtnPressed,
          ]}
          onPress={onDecline}
        >
          <Text style={styles.declineBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Outgoing request row ─────────────────────────────────────────────────────

function OutgoingRequestRow({
  request,
}: {
  request: { id: string; userId: string; username: string };
}) {
  return (
    <View style={styles.requestRow}>
      <Avatar username={request.username} size={40} />
      <View style={styles.outgoingInfo}>
        <Text style={styles.requestName} numberOfLines={1}>
          {request.username}
        </Text>
        <Text style={styles.pendingLabel}>Waiting for response…</Text>
      </View>
      <View style={styles.pendingBadge}>
        <Text style={styles.pendingBadgeText}>Pending</Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function FriendsScreen({ onOpenDm }: FriendsScreenProps) {
  const { api, presenceByUserId, updatePresence } = useAuth();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<
    { id: string; userId: string; username: string }[]
  >([]);
  const [outgoing, setOutgoing] = useState<
    { id: string; userId: string; username: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  // ── Load data ─────────────────────────────────────────────────────────────

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setStatus("");
      try {
        const [friendsRes, requestsRes] = await Promise.all([
          api.getFriends(),
          api.getFriendRequests(),
        ]);
        const friendList = friendsRes.friends ?? [];
        setFriends(friendList);
        setIncoming(requestsRes.incoming ?? []);
        setOutgoing(requestsRes.outgoing ?? []);

        // Seed presence from friend statuses
        for (const f of friendList) {
          if (f.status) {
            updatePresence(f.id, f.status, null);
          }
        }

        // Bulk-fetch live presence
        if (friendList.length > 0) {
          try {
            const ids = friendList.map((f) => f.id);
            const presenceData = await api.getPresence(ids);
            const map = presenceData.presence ?? {};
            for (const [userId, p] of Object.entries(map)) {
              updatePresence(userId, p.status, p.customStatus ?? null);
            }
          } catch {
            // non-fatal
          }
        }
      } catch {
        setStatus("Failed to load friends.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, updatePresence],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // ── Add friend ────────────────────────────────────────────────────────────

  const onAddFriend = useCallback(async () => {
    const username = addUsername.trim();
    if (!username || adding) return;
    setAdding(true);
    setStatus("");
    try {
      const res = await api.addFriend(username);
      await load(true);
      setAddUsername("");
      if (res.threadId && res.friend) {
        setStatus("Friend added!");
        onOpenDm({
          id: res.friend.id,
          username: res.friend.username ?? res.friend.id,
          pfp_url: null,
          status: "online",
        });
      } else if (res.requestStatus === "pending") {
        setStatus("Friend request sent to @" + username);
      } else {
        setStatus("Request sent!");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add friend.";
      setStatus(msg);
    } finally {
      setAdding(false);
    }
  }, [api, addUsername, adding, load, onOpenDm]);

  // ── Accept / decline requests ─────────────────────────────────────────────

  const onAccept = useCallback(
    async (requestId: string) => {
      try {
        await api.acceptFriendRequest(requestId);
        await load(true);
        setStatus("Friend request accepted!");
      } catch {
        Alert.alert("Error", "Failed to accept request.");
      }
    },
    [api, load],
  );

  const onDecline = useCallback(
    async (requestId: string) => {
      try {
        await api.declineFriendRequest(requestId);
        await load(true);
      } catch {
        Alert.alert("Error", "Failed to decline request.");
      }
    },
    [api, load],
  );

  // ── Remove friend ─────────────────────────────────────────────────────────

  const onRemoveFriend = useCallback(
    (friend: Friend) => {
      Alert.alert(
        "Remove Friend",
        `Remove ${friend.username} from your friends list?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await api.removeFriend(friend.id);
                setFriends((prev) => prev.filter((f) => f.id !== friend.id));
                setStatus(`${friend.username} removed.`);
              } catch {
                Alert.alert("Error", "Failed to remove friend.");
              }
            },
          },
        ],
      );
    },
    [api],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const onlineFriends = friends.filter((f) => {
    const p = presenceByUserId[f.id];
    const s = p?.status ?? f.status ?? "offline";
    return s !== "offline" && s !== "invisible";
  });

  const offlineFriends = friends.filter((f) => {
    const p = presenceByUserId[f.id];
    const s = p?.status ?? f.status ?? "offline";
    return s === "offline" || s === "invisible";
  });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand}
          colors={[colors.brand]}
        />
      }
    >
      {/* ── Add friend ── */}
      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add Friend</Text>
        <Text style={styles.addHint}>Add someone by their exact username.</Text>
        <View style={styles.addRow}>
          <TextInput
            value={addUsername}
            onChangeText={setAddUsername}
            style={styles.addInput}
            placeholder="Enter username"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!adding}
            returnKeyType="send"
            onSubmitEditing={onAddFriend}
          />
          <Pressable
            style={[
              styles.addBtn,
              (adding || !addUsername.trim()) && styles.addBtnDisabled,
            ]}
            onPress={onAddFriend}
            disabled={adding || !addUsername.trim()}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Add</Text>
            )}
          </Pressable>
        </View>
        {!!status && (
          <Text
            style={[
              styles.statusText,
              (status.includes("added") ||
                status.includes("sent") ||
                status.includes("accepted") ||
                status.includes("removed")) &&
                styles.statusTextSuccess,
            ]}
          >
            {status}
          </Text>
        )}
      </View>

      {/* ── Incoming requests ── */}
      {incoming.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Pending Requests" count={incoming.length} />
          <View style={styles.sectionCard}>
            {incoming.map((req, i) => (
              <View key={req.id}>
                <IncomingRequestRow
                  request={req}
                  onAccept={() => onAccept(req.id)}
                  onDecline={() => onDecline(req.id)}
                />
                {i < incoming.length - 1 && (
                  <View style={styles.rowSeparator} />
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Outgoing requests ── */}
      {outgoing.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Sent" count={outgoing.length} />
          <View style={styles.sectionCard}>
            {outgoing.map((req, i) => (
              <View key={req.id}>
                <OutgoingRequestRow request={req} />
                {i < outgoing.length - 1 && (
                  <View style={styles.rowSeparator} />
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Online friends ── */}
      {onlineFriends.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Online" count={onlineFriends.length} />
          <View style={styles.sectionCard}>
            {onlineFriends.map((f, i) => {
              const presence = presenceByUserId[f.id];
              return (
                <View key={f.id}>
                  <FriendRow
                    friend={f}
                    status={presence?.status ?? f.status}
                    customStatus={presence?.customStatus}
                    onMessage={() => onOpenDm(f)}
                    onRemove={() => onRemoveFriend(f)}
                  />
                  {i < onlineFriends.length - 1 && (
                    <View style={styles.rowSeparator} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Offline friends ── */}
      {offlineFriends.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Offline" count={offlineFriends.length} />
          <View style={styles.sectionCard}>
            {offlineFriends.map((f, i) => {
              const presence = presenceByUserId[f.id];
              return (
                <View key={f.id}>
                  <FriendRow
                    friend={f}
                    status={presence?.status ?? f.status ?? "offline"}
                    customStatus={presence?.customStatus}
                    onMessage={() => onOpenDm(f)}
                    onRemove={() => onRemoveFriend(f)}
                  />
                  {i < offlineFriends.length - 1 && (
                    <View style={styles.rowSeparator} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Empty state ── */}
      {friends.length === 0 &&
        incoming.length === 0 &&
        outgoing.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyHint}>
              Add someone by username above to get started.
            </Text>
          </View>
        )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Add card
  addCard: {
    backgroundColor: colors.sidebar,
    margin: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  addTitle: {
    ...typography.heading,
    color: colors.text,
  },
  addHint: {
    ...typography.caption,
    color: colors.textDim,
  },
  addRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
    minHeight: 42,
  },
  addBtnDisabled: { opacity: 0.55 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  statusText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
  },
  statusTextSuccess: { color: colors.success },

  // Section
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDim,
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: colors.sidebar,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  rowSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 44 + spacing.md,
  },

  // Friend row
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  friendRowPressed: { backgroundColor: colors.hover },
  friendInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  friendName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  friendStatus: {
    ...typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  friendActions: {
    flexDirection: "row",
    gap: spacing.xs,
    flexShrink: 0,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  iconBtnMessage: {
    borderColor: colors.brand,
    backgroundColor: "rgba(115,134,255,0.08)",
  },
  iconBtnRemove: {
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  iconBtnPressed: { opacity: 0.6 },
  iconBtnText: { fontSize: 16 },

  // Incoming request row
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  requestName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
    minWidth: 0,
  },
  requestActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexShrink: 0,
  },
  acceptBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtnPressed: { opacity: 0.75 },
  acceptBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
  },
  declineBtnPressed: {
    backgroundColor: "rgba(239,95,118,0.15)",
  },
  declineBtnText: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 14,
  },

  // Outgoing request row
  outgoingInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  pendingLabel: {
    ...typography.caption,
    color: colors.textDim,
    fontStyle: "italic",
  },
  pendingBadge: {
    backgroundColor: colors.elev,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDim,
    letterSpacing: 0.3,
  },

  // Empty state
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },
  emptyHint: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: "center",
    lineHeight: 20,
  },
});
