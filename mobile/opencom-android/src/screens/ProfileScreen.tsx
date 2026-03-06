import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii, spacing, typography } from "../theme";

type ProfileScreenProps = {
  onLogout: () => void;
};

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { me } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {(me?.username?.[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>{me?.username ?? "User"}</Text>
        <Text style={styles.id}>{me?.id ?? ""}</Text>
      </View>

      <Pressable style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  card: {
    backgroundColor: colors.sidebar,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md
  },
  avatarText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "700"
  },
  username: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs
  },
  id: {
    ...typography.caption,
    color: colors.textDim
  },
  logoutBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center"
  },
  logoutBtnText: { color: "#fff", fontWeight: "700" }
});
