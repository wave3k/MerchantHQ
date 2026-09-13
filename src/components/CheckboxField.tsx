import { Pressable, StyleSheet, View } from "react-native";
import Icon from "./Icon";
import { TranslatedText as Text } from "./TranslatedText";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

// Case à cocher accessible (checkbox) avec description optionnelle.
export function CheckboxField({
  label,
  checked,
  onChange,
  description,
}: CheckboxFieldProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon name="Check" size={16} color={colors.accentInk} /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

function createStyles() {
  return StyleSheet.create({
    row: {
      alignItems: "flex-start",
      alignSelf: "stretch",
      flexDirection: "row",
      gap: space.sm,
      paddingVertical: space.xxs,
    },
    rowPressed: {
      opacity: 0.7,
    },
    box: {
      alignItems: "center",
      borderColor: colors.ruleStrong,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      height: 22,
      justifyContent: "center",
      marginTop: 1,
      width: 22,
    },
    boxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    copy: {
      flex: 1,
      gap: space.xxs,
      minWidth: 0,
    },
    label: {
      color: colors.ink2,
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      lineHeight: 19,
    },
    description: {
      color: colors.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
    },
  });
}