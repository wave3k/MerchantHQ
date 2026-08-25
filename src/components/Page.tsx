import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import type { ReactNode } from "react";

import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { t } from "../i18n";

interface PageProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Page({
  title,
  description,
  action,
  children,
  scroll = true,
  contentStyle,
}: PageProps) {
  const styles = useThemedStyles(createStyles);
  const content = (
    <View style={[styles.content, contentStyle]}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t(title)}</Text>
          <Text style={styles.description}>{t(description)}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      {scroll ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = "Rechercher",
}: SearchFieldProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.search}>
      <Icon name="Search" size={19} color={colors.muted} />
      <TextInput
        accessibilityLabel={t(placeholder)}
        onChangeText={onChangeText}
        placeholder={t(placeholder)}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Effacer la recherche")}
          hitSlop={10}
          onPress={() => onChangeText("")}
        >
          <Icon name="CircleX" size={19} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{t(title)}</Text>
      <Text style={styles.emptyMessage}>{t(message)}</Text>
      {action}
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}

const badgeTones = {
  neutral: { background: colors.paper2, text: colors.ink2 },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.errorSoft, text: colors.error },
  accent: { background: colors.accentSoft, text: colors.accentDark },
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const styles = useThemedStyles(createStyles);
  const palette = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text numberOfLines={1} style={[styles.badgeText, { color: palette.text }]}>
        {t(label)}
      </Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  keyboard: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: space.xxl,
  },
  content: {
    gap: space.lg,
    padding: space.lg,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    justifyContent: "space-between",
  },
  heading: {
    flexBasis: 220,
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  search: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    minHeight: 48,
    paddingHorizontal: space.sm,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    minWidth: 0,
    paddingVertical: space.xs,
  },
  empty: {
    alignItems: "center",
    alignSelf: "stretch",
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: space.sm,
    justifyContent: "center",
    minHeight: 260,
    padding: space.xl,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.round,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    textAlign: "center",
  },
  emptyMessage: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 420,
    textAlign: "center",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
});
}
