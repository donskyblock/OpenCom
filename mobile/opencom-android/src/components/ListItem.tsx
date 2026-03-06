import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

type ListItemProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  selected?: boolean;
};

export function ListItem({ title, subtitle, onPress, selected }: ListItemProps) {
  const content = (
    <View style={styles.content}>
      <Text style={[styles.title, selected && styles.titleSelected]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.wrapper,
          selected && styles.wrapperSelected,
          pressed && styles.wrapperPressed
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "transparent"
  },
  wrapperSelected: { backgroundColor: colors.active },
  wrapperPressed: { backgroundColor: colors.hover },
  content: { gap: 2 },
  title: { ...typography.body, color: colors.text },
  titleSelected: { color: colors.brand },
  subtitle: { ...typography.caption, color: colors.textDim }
});
