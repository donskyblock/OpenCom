import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { ListItem } from "../components/ListItem";
import type { Friend } from "../types";
import { colors, radii, spacing, typography } from "../theme";

type FriendsScreenProps = {
  onOpenDm: (friend: Friend) => void;
};

export function FriendsScreen({ onOpenDm }: FriendsScreenProps) {
  const { api } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<{ id: string; userId: string; username: string }[]>([]);
  const [outgoing, setOutgoing] = useState<{ id: string; userId: string; username: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests()
      ]);
      setFriends(friendsRes.friends || []);
      setIncoming(requestsRes.incoming || []);
      setOutgoing(requestsRes.outgoing || []);
    } catch {
      setStatus("Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const onAddFriend = useCallback(async () => {
    const username = addUsername.trim();
    if (!username || adding) return;
    setAdding(true);
    setStatus("");
    try {
      const res = await api.addFriend(username);
      await load();
      setAddUsername("");
      if (res.threadId && res.friend) {
        setStatus("Friend added! Opening DM...");
        const f = res.friend;
        onOpenDm({
          id: f.id,
          username: f.username ?? f.id,
          pfp_url: null,
          status: "online"
        });
      } else if (res.requestStatus === "pending") {
        setStatus("Friend request sent.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add friend.";
      setStatus(msg);
    } finally {
      setAdding(false);
    }
  }, [api, addUsername, adding, load, onOpenDm]);

  const onAcceptRequest = useCallback(
    async (requestId: string) => {
      try {
        await api.acceptFriendRequest(requestId);
        await load();
        setStatus("Request accepted.");
      } catch {
        setStatus("Failed to accept.");
      }
    },
    [api, load]
  );

  const onDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        await api.declineFriendRequest(requestId);
        await load();
      } catch {
        setStatus("Failed to decline.");
      }
    },
    [api, load]
  );

  const onRemoveFriend = useCallback(
    async (friendId: string) => {
      try {
        await api.removeFriend(friendId);
        await load();
        setStatus("Friend removed.");
      } catch {
        setStatus("Failed to remove.");
      }
    },
    [api, load]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.addRow}>
        <TextInput
          value={addUsername}
          onChangeText={setAddUsername}
          style={styles.addInput}
          placeholder="Username"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          editable={!adding}
        />
        <Pressable
          style={[styles.addBtn, adding && styles.addBtnDisabled]}
          onPress={onAddFriend}
          disabled={adding}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {incoming.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending requests</Text>
          {incoming.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <Text style={styles.requestName}>{req.username}</Text>
              <View style={styles.requestActions}>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => onAcceptRequest(req.id)}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={styles.declineBtn}
                  onPress={() => onDeclineRequest(req.id)}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sent</Text>
          {outgoing.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <Text style={styles.requestName}>{req.username}</Text>
              <Text style={styles.pendingLabel}>Pending</Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
      {friends.length === 0 ? (
        <Text style={styles.empty}>No friends yet. Add someone by username above.</Text>
      ) : (
        friends.map((f) => (
          <View key={f.id} style={styles.friendRow}>
            <Pressable
              style={styles.friendPress}
              onPress={() => onOpenDm(f)}
            >
              <Text style={styles.friendName}>{f.username}</Text>
              <Text style={styles.friendStatus}>{f.status || "offline"}</Text>
            </Pressable>
            <Pressable
              style={styles.removeBtn}
              onPress={() => onRemoveFriend(f.id)}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  addRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  addInput: {
    flex: 1,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text
  },
  addBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    justifyContent: "center"
  },
  addBtnDisabled: { opacity: 0.7 },
  addBtnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.elev,
    borderRadius: radii.md,
    marginBottom: spacing.sm
  },
  requestName: { ...typography.body, color: colors.text },
  requestActions: { flexDirection: "row", gap: spacing.sm },
  acceptBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm
  },
  acceptBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  declineBtn: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger
  },
  declineBtnText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
  pendingLabel: { ...typography.caption, color: colors.textDim },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm
  },
  friendPress: { flex: 1, paddingVertical: spacing.md },
  friendName: { ...typography.body, color: colors.text },
  friendStatus: { ...typography.caption, color: colors.textDim },
  removeBtn: { padding: spacing.sm },
  removeBtnText: { color: colors.danger, fontSize: 13 },
  empty: { color: colors.textDim, paddingVertical: spacing.md },
  status: { color: colors.textDim, fontSize: 13, marginTop: spacing.md }
});
