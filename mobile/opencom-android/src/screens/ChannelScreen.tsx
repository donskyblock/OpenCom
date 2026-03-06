import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "../context/AuthContext";
import type { Channel, ChannelMessage, CoreServer, Guild } from "../types";
import { colors, radii, spacing, typography } from "../theme";

type ChannelScreenProps = {
  server: CoreServer;
  guild: Guild;
  channel: Channel;
  onBack: () => void;
};

export function ChannelScreen({ server, guild, channel, onBack }: ChannelScreenProps) {
  const { api } = useAuth();
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const listRef = useRef<FlatList>(null);

  const refreshMessages = useCallback(async () => {
    try {
      const data = await api.listMessages(server, channel.id);
      setMessages((data.messages || []).slice().reverse());
    } catch {
      setStatus("Failed to load messages.");
    }
  }, [api, server, channel.id]);

  useEffect(() => {
    setLoading(true);
    refreshMessages().finally(() => setLoading(false));
  }, [refreshMessages]);

  useEffect(() => {
    const timer = setInterval(refreshMessages, 5000);
    return () => clearInterval(timer);
  }, [refreshMessages]);

  const onSend = useCallback(async () => {
    const content = composer.trim();
    if (!content || sending) return;
    setSending(true);
    setStatus("");
    try {
      await api.sendMessage(server, channel.id, content);
      setComposer("");
      await refreshMessages();
      listRef.current?.scrollToEnd({ animated: true });
    } catch {
      setStatus("Failed to send.");
    } finally {
      setSending(false);
    }
  }, [api, composer, server, channel.id, refreshMessages, sending]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          #{channel.name}
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageAuthor}>{item.username || item.author_id}</Text>
              <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
            </View>
            <Text style={styles.messageBody}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        }
      />

      <View style={styles.composerRow}>
        <TextInput
          value={composer}
          onChangeText={setComposer}
          style={styles.composerInput}
          placeholder={`Message #${channel.name}`}
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={4000}
          onSubmitEditing={onSend}
          editable={!sending}
        />
        <Pressable
          style={[styles.sendBtn, (!composer.trim() || sending) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!composer.trim() || sending}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backBtn: { marginRight: spacing.md, padding: spacing.xs },
  backText: { fontSize: 24, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text, flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: spacing.lg },
  message: {
    marginBottom: spacing.md,
    paddingVertical: spacing.xs
  },
  messageHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  messageAuthor: { ...typography.body, color: colors.brand, fontWeight: "600" },
  messageTime: { ...typography.label, color: colors.textDim },
  messageBody: { ...typography.body, color: colors.text },
  empty: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.textDim },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.md,
    backgroundColor: colors.sidebar,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    maxHeight: 100
  },
  sendBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    justifyContent: "center"
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "#fff", fontWeight: "700" },
  status: { color: colors.textDim, fontSize: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }
});
