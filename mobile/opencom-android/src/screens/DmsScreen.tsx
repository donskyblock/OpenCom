import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { ListItem } from "../components/ListItem";
import type { DmThreadApi } from "../types";
import { colors, spacing, typography } from "../theme";

type DmsScreenProps = {
  onSelectDm: (thread: DmThreadApi) => void;
};

export function DmsScreen({ onSelectDm }: DmsScreenProps) {
  const { api } = useAuth();
  const [dms, setDms] = useState<DmThreadApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const loadDms = useCallback(async () => {
    try {
      const data = await api.getDms();
      setDms(data.dms || []);
    } catch {
      setStatus("Failed to load DMs.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadDms();
  }, [loadDms]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.subtle}>Loading messages...</Text>
      </View>
    );
  }

  if (dms.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No direct messages yet.</Text>
        <Text style={styles.emptyHint}>Add friends to start a conversation.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={dms}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle={item.lastMessageAt ? "Last message" : undefined}
            onPress={() => onSelectDm(item)}
          />
        )}
      />
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  subtle: { color: colors.textDim, marginTop: spacing.sm },
  empty: { color: colors.text, ...typography.body, textAlign: "center" },
  emptyHint: { color: colors.textDim, marginTop: spacing.sm },
  status: { color: colors.textDim, fontSize: 13, padding: spacing.md }
});
