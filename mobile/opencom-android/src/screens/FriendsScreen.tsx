import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Avatar } from "../components/Avatar";
import {
  EmptyState,
  ScreenBackground,
  SectionLabel,
  SegmentedControl,
  StatusBanner,
  SurfaceCard,
  TopBar,
} from "../components/chrome";
import { useAuth } from "../context/AuthContext";
import { colors, radii, spacing, typography } from "../theme";
import type { Friend } from "../types";

type FriendsScreenProps = {
  onOpenDm: (friend: Friend) => void;
};

type FriendView = "online" | "all" | "add" | "requests";

const STATUS_COLORS: Record<string, string> = {
  online: colors.success,
  idle: colors.warning,
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

function FriendRow({
  friend,
  status,
  customStatus,
  onMessage,
  onRemove,
  showDivider,
}: {
  friend: Friend;
  status?: string | null;
  customStatus?: string | null;
  onMessage: () => void;
  onRemove: () => void;
  showDivider?: boolean;
}) {
  const resolvedStatus = status ?? friend.status ?? "offline";
  const statusLabel =
    customStatus ?? STATUS_LABELS[resolvedStatus] ?? STATUS_LABELS.offline;

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.friendRow, pressed && styles.friendRowPressed]}
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
            style={[styles.friendStatus, { color: STATUS_COLORS[resolvedStatus] }]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>
        <View style={styles.friendActions}>
          <Pressable
            style={({ pressed }) => [
              styles.smallAction,
              styles.smallActionPrimary,
              pressed && styles.smallActionPressed,
            ]}
            onPress={onMessage}
          >
            <Text style={styles.smallActionPrimaryText}>Message</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.smallAction,
              styles.smallActionGhost,
              pressed && styles.smallActionPressed,
            ]}
            onPress={onRemove}
          >
            <Text style={styles.smallActionGhostText}>Remove</Text>
          </Pressable>
        </View>
      </Pressable>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

function RequestRow({
  username,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  showDivider,
}: {
  username: string;
  subtitle: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  showDivider?: boolean;
}) {
  return (
    <View>
      <View style={styles.requestRow}>
        <Avatar username={username} size={42} />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {username}
          </Text>
          <Text style={styles.requestSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.requestActions}>
          {primaryLabel && onPrimary ? (
            <Pressable
              style={({ pressed }) => [
                styles.smallAction,
                styles.smallActionPrimary,
                pressed && styles.smallActionPressed,
              ]}
              onPress={onPrimary}
            >
              <Text style={styles.smallActionPrimaryText}>{primaryLabel}</Text>
            </Pressable>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <Pressable
              style={({ pressed }) => [
                styles.smallAction,
                styles.smallActionGhost,
                pressed && styles.smallActionPressed,
              ]}
              onPress={onSecondary}
            >
              <Text style={styles.smallActionGhostText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

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
  const [adding, setAdding] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<FriendView>("online");
  const [query, setQuery] = useState("");

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

        for (const friend of friendList) {
          if (friend.status) {
            updatePresence(friend.id, friend.status, null);
          }
        }

        if (friendList.length > 0) {
          try {
            const ids = friendList.map((friend) => friend.id);
            const presenceData = await api.getPresence(ids);
            for (const [userId, presence] of Object.entries(
              presenceData.presence ?? {},
            )) {
              updatePresence(userId, presence.status, presence.customStatus ?? null);
            }
          } catch {
            // Presence refresh is best effort.
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

  const onAddFriend = useCallback(async () => {
    const username = addUsername.trim();
    if (!username || adding) return;
    setAdding(true);
    setStatus("");
    try {
      const result = await api.addFriend(username);
      await load(true);
      setAddUsername("");
      if (result.threadId && result.friend) {
        setStatus("Friend added!");
        onOpenDm({
          id: result.friend.id,
          username: result.friend.username ?? result.friend.id,
          pfp_url: null,
          status: "online",
        });
      } else if (result.requestStatus === "pending") {
        setStatus(`Friend request sent to @${username}`);
      } else {
        setStatus("Request sent!");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to add friend.";
      setStatus(message);
    } finally {
      setAdding(false);
    }
  }, [addUsername, adding, api, load, onOpenDm]);

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
                setFriends((prev) => prev.filter((entry) => entry.id !== friend.id));
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

  const normalizedQuery = query.trim().toLowerCase();

  const allFriends = useMemo(
    () =>
      friends.filter((friend) =>
        normalizedQuery
          ? friend.username.toLowerCase().includes(normalizedQuery)
          : true,
      ),
    [friends, normalizedQuery],
  );

  const onlineFriends = useMemo(
    () =>
      allFriends.filter((friend) => {
        const resolved = presenceByUserId[friend.id]?.status ?? friend.status ?? "offline";
        return resolved !== "offline" && resolved !== "invisible";
      }),
    [allFriends, presenceByUserId],
  );

  const offlineFriends = useMemo(
    () =>
      allFriends.filter((friend) => {
        const resolved = presenceByUserId[friend.id]?.status ?? friend.status ?? "offline";
        return resolved === "offline" || resolved === "invisible";
      }),
    [allFriends, presenceByUserId],
  );

  const statusTone =
    status.toLowerCase().includes("failed") || status.toLowerCase().includes("error")
      ? "danger"
      : status.toLowerCase().includes("added") ||
          status.toLowerCase().includes("sent") ||
          status.toLowerCase().includes("accepted") ||
          status.toLowerCase().includes("removed")
        ? "success"
        : "neutral";

  if (loading) {
    return (
      <ScreenBackground>
        <TopBar title="Friends" subtitle="Loading your social graph" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Fetching friends and requests…</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <TopBar
        title="Friends"
        subtitle={`${friends.length} ${friends.length === 1 ? "friend" : "friends"} in your orbit`}
      />
      <ScrollView
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
        <SurfaceCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>FRIENDS SURFACE</Text>
          <Text style={styles.heroTitle}>Stay close to the people you talk to most</Text>
          <Text style={styles.heroBody}>
            Search, add, and jump into DMs using the same layered hierarchy as desktop.
          </Text>
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value as FriendView)}
            options={[
              { value: "online", label: "Online" },
              { value: "all", label: "All" },
              { value: "add", label: "Add" },
              { value: "requests", label: "Requests" },
            ]}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholder="Search friends"
            placeholderTextColor={colors.textDim}
          />
        </SurfaceCard>

        {(view === "online" || view === "all") && onlineFriends.length > 0 ? (
          <SurfaceCard style={styles.activeNowCard}>
            <SectionLabel title="Active Now" />
            <View style={styles.activeNowGrid}>
              {onlineFriends.slice(0, 4).map((friend) => (
                <Pressable
                  key={`active-${friend.id}`}
                  style={({ pressed }) => [
                    styles.activeNowItem,
                    pressed && styles.activeNowItemPressed,
                  ]}
                  onPress={() => onOpenDm(friend)}
                >
                  <Avatar
                    username={friend.username}
                    pfpUrl={friend.pfp_url}
                    size={34}
                    status={presenceByUserId[friend.id]?.status ?? friend.status}
                    showStatus
                  />
                  <View style={styles.activeNowInfo}>
                    <Text style={styles.activeNowName} numberOfLines={1}>
                      {friend.username}
                    </Text>
                    <Text style={styles.activeNowStatus} numberOfLines={1}>
                      {presenceByUserId[friend.id]?.customStatus ?? "Available now"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </SurfaceCard>
        ) : null}

        {view === "add" ? (
          <SurfaceCard style={styles.formCard}>
            <SectionLabel title="Add Friend" />
            <Text style={styles.formHint}>
              Type the exact username and OpenCom will either connect you instantly or send a request.
            </Text>
            <TextInput
              value={addUsername}
              onChangeText={setAddUsername}
              style={styles.searchInput}
              placeholder="Exact username"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!adding}
              returnKeyType="send"
              onSubmitEditing={onAddFriend}
            />
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (!addUsername.trim() || adding) && styles.primaryButtonDisabled,
                pressed && addUsername.trim() && !adding && styles.primaryButtonPressed,
              ]}
              onPress={onAddFriend}
              disabled={!addUsername.trim() || adding}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Friend Request</Text>
              )}
            </Pressable>
          </SurfaceCard>
        ) : null}

        {view === "requests" ? (
          <>
            {incoming.length > 0 ? (
              <SurfaceCard style={styles.listCard} padded={false}>
                <View style={styles.cardHeaderWrap}>
                  <SectionLabel title={`Incoming (${incoming.length})`} />
                </View>
                {incoming.map((request, index) => (
                  <RequestRow
                    key={request.id}
                    username={request.username}
                    subtitle="Incoming request"
                    primaryLabel="Accept"
                    onPrimary={() => onAccept(request.id)}
                    secondaryLabel="Decline"
                    onSecondary={() => onDecline(request.id)}
                    showDivider={index < incoming.length - 1}
                  />
                ))}
              </SurfaceCard>
            ) : null}

            {outgoing.length > 0 ? (
              <SurfaceCard style={styles.listCard} padded={false}>
                <View style={styles.cardHeaderWrap}>
                  <SectionLabel title={`Outgoing (${outgoing.length})`} />
                </View>
                {outgoing.map((request, index) => (
                  <RequestRow
                    key={request.id}
                    username={request.username}
                    subtitle="Waiting for a response"
                    showDivider={index < outgoing.length - 1}
                  />
                ))}
              </SurfaceCard>
            ) : null}

            {incoming.length === 0 && outgoing.length === 0 ? (
              <EmptyState
                eyebrow="REQUESTS"
                icon="👋"
                title="No pending friend requests"
                hint="When someone sends you a request, it will show up here."
              />
            ) : null}
          </>
        ) : null}

        {view === "online" ? (
          onlineFriends.length > 0 ? (
            <SurfaceCard style={styles.listCard} padded={false}>
              <View style={styles.cardHeaderWrap}>
                <SectionLabel title={`Online (${onlineFriends.length})`} />
              </View>
              {onlineFriends.map((friend, index) => {
                const presence = presenceByUserId[friend.id];
                return (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    status={presence?.status ?? friend.status}
                    customStatus={presence?.customStatus}
                    onMessage={() => onOpenDm(friend)}
                    onRemove={() => onRemoveFriend(friend)}
                    showDivider={index < onlineFriends.length - 1}
                  />
                );
              })}
            </SurfaceCard>
          ) : (
            <EmptyState
              eyebrow="ONLINE"
              icon="👥"
              title="No friends online right now"
              hint="Your online friends will appear here when they sign in."
            />
          )
        ) : null}

        {view === "all" ? (
          allFriends.length > 0 ? (
            <>
              {onlineFriends.length > 0 ? (
                <SurfaceCard style={styles.listCard} padded={false}>
                  <View style={styles.cardHeaderWrap}>
                    <SectionLabel title={`Online (${onlineFriends.length})`} />
                  </View>
                  {onlineFriends.map((friend, index) => {
                    const presence = presenceByUserId[friend.id];
                    return (
                      <FriendRow
                        key={`online-${friend.id}`}
                        friend={friend}
                        status={presence?.status ?? friend.status}
                        customStatus={presence?.customStatus}
                        onMessage={() => onOpenDm(friend)}
                        onRemove={() => onRemoveFriend(friend)}
                        showDivider={index < onlineFriends.length - 1}
                      />
                    );
                  })}
                </SurfaceCard>
              ) : null}

              {offlineFriends.length > 0 ? (
                <SurfaceCard style={styles.listCard} padded={false}>
                  <View style={styles.cardHeaderWrap}>
                    <SectionLabel title={`Offline (${offlineFriends.length})`} />
                  </View>
                  {offlineFriends.map((friend, index) => {
                    const presence = presenceByUserId[friend.id];
                    return (
                      <FriendRow
                        key={`offline-${friend.id}`}
                        friend={friend}
                        status={presence?.status ?? friend.status}
                        customStatus={presence?.customStatus}
                        onMessage={() => onOpenDm(friend)}
                        onRemove={() => onRemoveFriend(friend)}
                        showDivider={index < offlineFriends.length - 1}
                      />
                    );
                  })}
                </SurfaceCard>
              ) : null}
            </>
          ) : (
            <EmptyState
              eyebrow="ALL FRIENDS"
              icon="🔍"
              title="No matching friends"
              hint={
                normalizedQuery
                  ? "Try a different search term."
                  : "Add some friends to start building your social graph."
              }
            />
          )
        ) : null}
      </ScrollView>

      {status ? (
        <StatusBanner
          text={status}
          tone={statusTone}
          onDismiss={() => setStatus("")}
        />
      ) : null}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textDim,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  heroCard: {
    gap: spacing.sm,
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.textDim,
  },
  heroTitle: {
    ...typography.title,
    color: colors.text,
  },
  heroBody: {
    ...typography.body,
    color: colors.textDim,
    lineHeight: 22,
  },
  searchInput: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  activeNowCard: {
    gap: spacing.sm,
  },
  activeNowGrid: {
    gap: spacing.sm,
  },
  activeNowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeNowItemPressed: {
    backgroundColor: colors.hover,
  },
  activeNowInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activeNowName: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  activeNowStatus: {
    ...typography.caption,
    color: colors.textDim,
  },
  formCard: {
    gap: spacing.sm,
  },
  formHint: {
    ...typography.body,
    color: colors.textDim,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  listCard: {
    overflow: "hidden",
  },
  cardHeaderWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  friendRowPressed: {
    backgroundColor: colors.hover,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  friendName: {
    ...typography.heading,
    color: colors.text,
  },
  friendStatus: {
    ...typography.caption,
  },
  friendActions: {
    gap: spacing.xs,
    flexShrink: 0,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  requestInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requestName: {
    ...typography.heading,
    color: colors.text,
  },
  requestSubtitle: {
    ...typography.caption,
    color: colors.textDim,
  },
  requestActions: {
    gap: spacing.xs,
    flexShrink: 0,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + 56,
    marginRight: spacing.lg,
  },
  smallAction: {
    minWidth: 74,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  smallActionPressed: {
    opacity: 0.82,
  },
  smallActionPrimary: {
    backgroundColor: colors.brandMuted,
    borderColor: colors.borderStrong,
  },
  smallActionPrimaryText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  smallActionGhost: {
    backgroundColor: colors.panelAlt,
    borderColor: colors.border,
  },
  smallActionGhostText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: "700",
  },
});
