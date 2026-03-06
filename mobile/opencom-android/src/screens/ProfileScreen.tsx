import { useCallback } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { colors, radii, spacing, typography } from "../theme";

type ProfileScreenProps = {
  onLogout: () => void;
  onOpenSettings: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  online: "🟢  Online",
  idle: "🌙  Idle",
  dnd: "⛔  Do Not Disturb",
  offline: "⬛  Offline",
  invisible: "👻  Invisible",
};

export function ProfileScreen({
  onLogout,
  onOpenSettings,
}: ProfileScreenProps) {
  const { me, myProfile, selfStatus } = useAuth();

  const displayName = myProfile?.displayName ?? me?.username ?? "User";
  const username = me?.username ?? "";
  const bio = myProfile?.bio ?? null;
  const pfpUrl = myProfile?.pfp_url ?? null;
  const bannerUrl = myProfile?.banner_url ?? null;
  const statusLabel = STATUS_LABELS[selfStatus] ?? STATUS_LABELS.online;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Banner + avatar */}
      <View style={styles.heroSection}>
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={styles.banner}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}

        <View style={styles.avatarRow}>
          <View style={styles.avatarContainer}>
            <Avatar
              username={displayName}
              pfpUrl={pfpUrl}
              size={76}
              status={selfStatus}
              showStatus
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              pressed && styles.editBtnPressed,
            ]}
            onPress={onOpenSettings}
          >
            <Text style={styles.editBtnText}>⚙️ Edit Profile</Text>
          </Pressable>
        </View>
      </View>

      {/* Identity card */}
      <View style={styles.card}>
        <Text style={styles.displayName} numberOfLines={1}>
          {displayName}
        </Text>
        {username && displayName !== username && (
          <Text style={styles.username} numberOfLines={1}>
            @{username}
          </Text>
        )}
        {!bio && !bannerUrl && <Text style={styles.username}>@{username}</Text>}

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

        {bio ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.bioLabel}>ABOUT ME</Text>
            <Text style={styles.bio}>{bio}</Text>
          </>
        ) : null}
      </View>

      {/* Account info */}
      {myProfile?.email ? (
        <View style={styles.card}>
          <Text style={styles.infoLabel}>EMAIL</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {myProfile.email}
          </Text>
        </View>
      ) : null}

      {/* Quick actions */}
      <View style={styles.card}>
        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={onOpenSettings}
        >
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionLabel}>Settings & Profile</Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={onOpenSettings}
        >
          <Text style={styles.actionIcon}>🔒</Text>
          <Text style={styles.actionLabel}>Account & Security</Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={onOpenSettings}
        >
          <Text style={styles.actionIcon}>📱</Text>
          <Text style={styles.actionLabel}>Active Sessions</Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
      </View>

      {/* Danger zone */}
      <View style={styles.card}>
        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
          ]}
          onPress={onLogout}
        >
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={[styles.actionLabel, styles.actionLabelDanger]}>
            Log Out
          </Text>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },

  // Hero section
  heroSection: {
    marginBottom: spacing.md,
  },
  banner: {
    width: "100%",
    height: 120,
    backgroundColor: colors.elev,
  },
  bannerPlaceholder: {
    width: "100%",
    height: 80,
    backgroundColor: colors.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginTop: -38,
  },
  avatarContainer: {
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.sidebar,
    marginBottom: 4,
  },
  editBtnPressed: {
    backgroundColor: colors.hover,
  },
  editBtnText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },

  // Identity card
  card: {
    backgroundColor: colors.sidebar,
    borderRadius: radii.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  displayName: {
    ...typography.title,
    color: colors.text,
    marginBottom: 2,
  },
  username: {
    ...typography.caption,
    color: colors.textDim,
    marginBottom: spacing.xs,
  },
  statusRow: {
    marginTop: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.textDim,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  bioLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDim,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },

  // Account info card
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDim,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },

  // Action rows
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  actionRowPressed: {
    backgroundColor: colors.hover,
    borderRadius: radii.md,
  },
  actionIcon: {
    fontSize: 18,
    width: 26,
    textAlign: "center",
  },
  actionLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  actionChevron: {
    fontSize: 20,
    color: colors.textDim,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 42,
  },
});
