import Icon from "../components/Icon";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Page } from "../components/Page";
import { LiveClock } from "../components/LiveClock";
import { TranslatedText as Text } from "../components/TranslatedText";
import { userCanAccessScreen } from "../domain/permissions";
import { colors, fonts, radius, space } from "../theme";
import type { ScreenKey, User } from "../types";

interface DashboardHomeScreenProps {
  db: SQLiteDatabase;
  user: User;
  onNavigate: (screen: ScreenKey) => void;
}

export function DashboardHomeScreen({
  user,
  onNavigate,
}: DashboardHomeScreenProps) {
  return (
    <Page
      action={<LiveClock />}
      description="Supervisez les performances de votre entreprise."
      title="Dashboard"
    >
      <View style={styles.actionsBand}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Analyse et performances</Text>
          <Text style={styles.sectionDescription}>
            Plongez dans les détails de vos revenus.
          </Text>
        </View>
        <View style={styles.quickActions}>
          {userCanAccessScreen(user, "statistics") ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onNavigate("statistics")}
              style={({ pressed }) => [
                styles.quickAction,
                pressed && styles.quickActionPressed,
              ]}
            >
              <View style={styles.actionIcon}>
                <Icon
                  color={colors.accent}
                  name="ChartColumn"
                  size={23}
                />
              </View>
              <View style={styles.actionCopy}>
                <Text numberOfLines={1} style={styles.actionLabel}>
                  Statistiques détaillées
                </Text>
                <Text numberOfLines={2} style={styles.actionDescription}>
                  Revenus, panier moyen, et produits populaires.
                </Text>
              </View>
              <Icon
                color={colors.muted}
                name="ChevronRight"
                size={20}
              />
            </Pressable>
          ) : null}
          {userCanAccessScreen(user, "expenses") ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onNavigate("expenses")}
              style={({ pressed }) => [
                styles.quickAction,
                pressed && styles.quickActionPressed,
              ]}
            >
              <View style={styles.actionIcon}>
                <Icon color={colors.accent} name="Coins" size={23} />
              </View>
              <View style={styles.actionCopy}>
                <Text numberOfLines={1} style={styles.actionLabel}>
                  Suivi des dépenses
                </Text>
                <Text numberOfLines={2} style={styles.actionDescription}>
                  Sorties d’argent, catégories et total mensuel.
                </Text>
              </View>
              <Icon
                color={colors.muted}
                name="ChevronRight"
                size={20}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  actionsBand: {
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    gap: space.md,
    paddingBottom: space.lg,
  },
  sectionHeading: {
    gap: space.xxs,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 21,
  },
  sectionDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 230,
    flexDirection: "row",
    flexGrow: 1,
    gap: space.sm,
    minHeight: 76,
    padding: space.sm,
  },
  quickActionPressed: {
    backgroundColor: colors.accentSoft,
    transform: [{ translateY: 1 }],
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  actionCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  actionLabel: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  actionDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
});
