import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

type ListItemProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  badge?: number | null;
  dimmed?: boolean;
};

export function ListItem({
  title,
  subtitle,
  onPress,
  onLongPress,
  selected,
  left,
  right,
  badge,
  dimmed,
}: ListItemProps) {
  const inner = (
    <View style={styles.row}>
      {left ? <View style={styles.leftSlot}>{left}</View> : null}

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            selected && styles.titleSelected,
            dimmed && styles.titleDimmed,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {badge != null && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}

      {right ? <View style={styles.rightSlot}>{right}</View> : null}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.wrapper,
          selected && styles.wrapperSelected,
          pressed && styles.wrapperPressed,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{inner}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "transparent",
  },
  wrapperSelected: { backgroundColor: colors.active },
  wrapperPressed: { backgroundColor: colors.hover },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  leftSlot: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    color: colors.text,
  },
  titleSelected: { color: colors.brand },
  titleDimmed: { color: colors.textDim },
  subtitle: {
    ...typography.caption,
    color: colors.textDim,
  },
  rightSlot: {
    flexShrink: 0,
    marginLeft: spacing.xs,
  },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: radii.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
