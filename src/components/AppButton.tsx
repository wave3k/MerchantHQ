import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";
import type { IconName } from "./Icon";

import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { t } from "../i18n";

type Tone = "primary" | "secondary" | "danger" | "ghost";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: Tone;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
}

const tones = {
  primary: {
    background: colors.accent,
    pressed: colors.accentDark,
    border: colors.accent,
    text: colors.accentInk,
  },
  secondary: {
    background: colors.surfaceStrong,
    pressed: colors.paper2,
    border: colors.ruleStrong,
    text: colors.ink,
  },
  danger: {
    background: colors.errorSoft,
    pressed: colors.errorPressed,
    border: colors.errorBorder,
    text: colors.error,
  },
  ghost: {
    background: "transparent",
    pressed: colors.paper2,
    border: "transparent",
    text: colors.ink2,
  },
} as const;

export function AppButton({
  label,
  onPress,
  icon,
  tone = "primary",
  disabled = false,
  loading = false,
  compact = false,
  fullWidth = false,
  accessibilityHint,
}: AppButtonProps) {
  const styles = useThemedStyles(createStyles);
  const palette = tones[tone];
  const translatedLabel = t(label);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translatedLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: pressed ? palette.pressed : palette.background,
          borderColor: palette.border,
          opacity: disabled ? 0.48 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={18} color={palette.text} /> : null}
          <Text numberOfLines={1} style={[styles.label, { color: palette.text }]}>
            {translatedLabel}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles() {
  return StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  regular: {
    paddingHorizontal: space.md,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: space.sm,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
});
}
