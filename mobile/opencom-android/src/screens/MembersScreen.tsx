import { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  EmptyState,
  ScreenBackground,
  StatusBanner,
  SurfaceCard,
  TopBar,
} from "../components/chrome";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import type { CoreServer, Guild, GuildMember, Role } from "../types";
import { colors, radii, spacing, typography } from "../theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type MembersScreenProps = {
  server: CoreServer;
  guild: Guild;
  myId: string;
  onBack: () => void;
  onOpenDm?: (userId: string, username: string) => void;
};

type RoleSection = {
  role: Role | null;
  members: GuildMember[];
};

type ListRow =
  | { kind: "header"; role: Role | null; count: number }
  | { kind: "member"; member: GuildMember };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function buildRows(sections: RoleSection[]): ListRow[] {
  const rows: ListRow[] = [];
  for (const section of sections) {
    if (section.members.length === 0) continue;
    rows.push({
      kind: "header",
      role: section.role,
      count: section.members.length,
    });
    for (const member of section.members) {
      rows.push({ kind: "member", member });
    }
  }
  return rows;
}

function groupMembersByRole(
  members: GuildMember[],
  roles: Role[],
): RoleSection[] {
  // Sort roles by position descending (highest position = displayed first)
  const sortedRoles = [...roles].sort((a, b) => b.position - a.position);

  // Track which members have been placed
  const placed = new Set<string>();
  const sections: RoleSection[] = [];

  for (const role of sortedRoles) {
    const roleMembers = members.filter(
      (m) => m.roleIds?.includes(role.id) && !placed.has(m.id),
    );
    if (roleMembers.length > 0) {
      for (const m of roleMembers) placed.add(m.id);
      sections.push({ role, members: roleMembers });
    }
  }

  // Any members without a matched role go into "Members" section
  const unplaced = members.filter((m) => !placed.has(m.id));
  if (unplaced.length > 0) {
    sections.push({ role: null, members: unplaced });
  }

  return sections;
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  roleColor,
  status,
  customStatus,
  isMe,
  onPress,
  onLongPress,
}: {
  member: GuildMember;
  roleColor?: string | null;
  status?: string | null;
  customStatus?: string | null;
  isMe: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const displayName = member.displayName ?? member.username;
  const statusLabel =
    customStatus ?? (status && status !== "offline" ? status : null);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.memberRow,
        pressed && styles.memberRowPressed,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Avatar
        username={member.username}
        pfpUrl={member.pfp_url}
        size={40}
        status={status ?? undefined}
        showStatus
      />

      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text
            style={[
              styles.memberName,
              roleColor ? { color: roleColor } : undefined,
            ]}
            numberOfLines={1}
          >
            {displayName}
            {isMe ? <Text style={styles.meTag}> (you)</Text> : null}
          </Text>
        </View>
        {statusLabel ? (
          <Text style={styles.memberStatus} numberOfLines={1}>
            {statusLabel}
          </Text>
        ) : null}
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ role, count }: { role: Role | null; count: number }) {
  const name = role?.name ?? "Members";
  const color = role?.color ?? colors.textDim;

  return (
    <View style={styles.sectionHeader}>
      {role?.color ? (
        <View style={[styles.roleColorDot, { backgroundColor: color }]} />
      ) : null}
      <Text style={[styles.sectionTitle, { color }]}>
        {name.toUpperCase()} — {count}
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function MembersScreen({
  server,
  guild,
  myId,
  onBack,
  onOpenDm,
}: MembersScreenProps) {
  const { api, presenceByUserId } = useAuth();

  const [members, setMembers] = useState<GuildMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");

  // ── Load data ───────────────────────────────────────────────────────────────

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setStatus("");
      try {
        const [membersData, rolesData] = await Promise.all([
          api.getGuildMembers(server, guild.id),
          api.getRoles(server, guild.id),
        ]);
        setMembers(membersData.members ?? []);
        setRoles(rolesData.roles ?? []);
      } catch {
        setStatus("Failed to load members.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, server, guild.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // ── Member actions ──────────────────────────────────────────────────────────

  const openMemberActions = useCallback(
    (member: GuildMember) => {
      if (member.id === myId) return;

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: member.displayName ?? member.username,
            options: ["Message", "Kick", "Ban", "Cancel"],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 3,
          },
          (idx) => {
            if (idx === 0) onOpenDm?.(member.id, member.username);
            else if (idx === 1) confirmKick(member);
            else if (idx === 2) confirmBan(member);
          },
        );
      } else {
        Alert.alert(
          member.displayName ?? member.username,
          "What would you like to do?",
          [
            {
              text: "Message",
              onPress: () => onOpenDm?.(member.id, member.username),
            },
            { text: "Kick", onPress: () => confirmKick(member) },
            {
              text: "Ban",
              style: "destructive",
              onPress: () => confirmBan(member),
            },
            { text: "Cancel", style: "cancel" },
          ],
        );
      }
    },
    [myId, onOpenDm], // eslint-disable-line
  );

  const confirmKick = useCallback(
    (member: GuildMember) => {
      Alert.alert(
        "Kick Member",
        `Kick ${member.displayName ?? member.username} from ${guild.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Kick",
            style: "destructive",
            onPress: async () => {
              try {
                await api.kickMember(server, guild.id, member.id);
                setMembers((prev) => prev.filter((m) => m.id !== member.id));
                setStatus(`${member.username} was kicked.`);
              } catch {
                Alert.alert("Error", "Failed to kick member.");
              }
            },
          },
        ],
      );
    },
    [api, server, guild.id, guild.name],
  );

  const confirmBan = useCallback(
    (member: GuildMember) => {
      Alert.alert(
        "Ban Member",
        `Ban ${member.displayName ?? member.username} from ${guild.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Ban",
            style: "destructive",
            onPress: async () => {
              try {
                await api.banMember(server, guild.id, member.id);
                setMembers((prev) => prev.filter((m) => m.id !== member.id));
                setStatus(`${member.username} was banned.`);
              } catch {
                Alert.alert("Error", "Failed to ban member.");
              }
            },
          },
        ],
      );
    },
    [api, server, guild.id, guild.name],
  );

  // ── Build list rows ─────────────────────────────────────────────────────────

  const sections = groupMembersByRole(members, roles);
  const rows = buildRows(sections);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScreenBackground>
      <TopBar
        title="Members"
        subtitle={`${members.length} people in ${guild.name}`}
        onBack={onBack}
        right={<Text style={styles.headerCount}>{members.length}</Text>}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) =>
            row.kind === "header"
              ? `header-${row.role?.id ?? "none"}`
              : `member-${row.member.id}`
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <SurfaceCard style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{guild.name}</Text>
              <Text style={styles.summaryText}>
                Browse the guild roster by role, then message or moderate members
                with a long-press.
              </Text>
            </SurfaceCard>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                eyebrow="MEMBERS"
                icon="👥"
                title="No members found"
                hint="Members will appear here once the guild data loads."
              />
            </View>
          }
          renderItem={({ item: row }) => {
            if (row.kind === "header") {
              return <SectionHeader role={row.role} count={row.count} />;
            }

            const { member } = row;
            const presence = presenceByUserId[member.id];
            const memberRoles = roles
              .filter((role) => member.roleIds?.includes(role.id))
              .sort((a, b) => b.position - a.position);
            const topRole = memberRoles[0];
            const roleColor = topRole?.color ?? null;

            return (
              <MemberRow
                member={member}
                roleColor={roleColor}
                status={presence?.status ?? member.status ?? null}
                customStatus={presence?.customStatus ?? null}
                isMe={member.id === myId}
                onPress={() => {
                  if (member.id !== myId) {
                    openMemberActions(member);
                  }
                }}
                onLongPress={() => openMemberActions(member)}
              />
            );
          }}
        />
      )}

      {status ? <StatusBanner text={status} onDismiss={() => setStatus("")} /> : null}
    </ScreenBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerCount: {
    ...typography.caption,
    color: colors.textSoft,
    backgroundColor: colors.panelAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    fontWeight: "600",
    flexShrink: 0,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  summaryCard: {
    gap: spacing.xs,
  },
  summaryTitle: {
    ...typography.title,
    color: colors.text,
  },
  summaryText: {
    ...typography.body,
    color: colors.textDim,
    lineHeight: 22,
  },
  emptyWrap: {
    paddingTop: spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  roleColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  // Member row
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  memberRowPressed: { backgroundColor: colors.hover },
  memberInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  memberName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },
  meTag: {
    ...typography.caption,
    color: colors.textDim,
    fontWeight: "400",
  },
  memberStatus: {
    ...typography.caption,
    color: colors.textDim,
    textTransform: "capitalize",
  },
  chevron: {
    fontSize: 18,
    color: colors.textDim,
    flexShrink: 0,
  },

  // Empty state
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { ...typography.heading, color: colors.textDim },
});
