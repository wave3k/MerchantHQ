import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useEffect, useState } from "react";

import { EmptyState, Page } from "../components/Page";
import { LiveClock } from "../components/LiveClock";
import { TranslatedText as Text } from "../components/TranslatedText";
import { listProducts } from "../data/database";
import { userCanAccessScreen } from "../domain/permissions";
import { isLowStock } from "../domain/stock";
import { colors, fonts, radius, space } from "../theme";
import type { Product, ScreenKey, User } from "../types";

interface BoutiqueHomeScreenProps {
  db: SQLiteDatabase;
  user: User;
  onNavigate: (screen: ScreenKey) => void;
}

const quickActions: Array<{
  screen: ScreenKey;
  label: string;
  description: string;
  icon: IconName;
}> = [
  {
    screen: "products",
    label: "Voir les produits",
    description: "Consulter le catalogue et le stock.",
    icon: "Package",
  },
  {
    screen: "attendance",
    label: "Présences",
    description: "Marquer l'arrivée de l'équipe.",
    icon: "ClipboardCheck",
  },
];

export function BoutiqueHomeScreen({
  db,
  user,
  onNavigate,
}: BoutiqueHomeScreenProps) {
  const { width } = useWindowDimensions();
  const [lowStock, setLowStock] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const stacked = width < 900;

  useEffect(() => {
    void listProducts(db)
      .then((data) => {
        setLowStock(
          data
            .filter(isLowStock)
            .slice(0, 6),
        );
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "L’accueil de la boutique n’a pas pu être chargé.",
        ),
      );
  }, [db]);

  return (
    <Page
      action={<LiveClock />}
      description="Gérez vos stocks, votre équipe et les paramètres de la boutique."
      title="Boutique"
    >
      <View style={styles.actionsBand}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Opérations boutique</Text>
          <Text style={styles.sectionDescription}>
            Actions rapides pour la gestion interne.
          </Text>
        </View>
        <View style={styles.quickActions}>
          {quickActions
            .filter((action) => userCanAccessScreen(user, action.screen))
            .map((action) => (
              <Pressable
                accessibilityRole="button"
                key={action.screen}
                onPress={() => onNavigate(action.screen)}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.quickActionPressed,
                ]}
              >
                <View style={styles.actionIcon}>
                  <Icon
                    color={colors.accent}
                    name={action.icon}
                    size={23}
                  />
                </View>
                <View style={styles.actionCopy}>
                  <Text numberOfLines={1} style={styles.actionLabel}>
                    {action.label}
                  </Text>
                  <Text numberOfLines={2} style={styles.actionDescription}>
                    {action.description}
                  </Text>
                </View>
                <Icon
                  color={colors.muted}
                  name="ChevronRight"
                  size={20}
                />
              </Pressable>
            ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!lowStock && !error ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : lowStock ? (
        <View style={[styles.rails, stacked && styles.railsStacked]}>
          <View style={styles.rail}>
            <View style={styles.railHeader}>
              <View style={styles.railTitleCopy}>
                <Text style={styles.railTitle}>Stock à surveiller</Text>
                <Text style={styles.railDescription}>
                  Les produits à vérifier avant de vendre.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => onNavigate("products")}
                style={({ pressed }) => [
                  styles.textAction,
                  pressed && styles.textActionPressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.textActionLabel}>
                  Voir les produits
                </Text>
                <Icon
                  color={colors.accent}
                  name="ArrowRight"
                  size={17}
                />
              </Pressable>
            </View>
            {lowStock.length ? (
              <View>
                {lowStock.map((product) => (
                  <Pressable
                    accessibilityRole="button"
                    key={product.id}
                    onPress={() => onNavigate("products")}
                    style={({ pressed }) => [
                      styles.listRow,
                      pressed && styles.listRowPressed,
                    ]}
                  >
                    <View style={styles.warningMark}>
                      <Icon
                        color={colors.warning}
                        name="CircleAlert"
                        size={20}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {product.name}
                      </Text>
                      <Text style={styles.rowMeta}>
                        En stock : {product.stock} · seuil :{" "}
                        {product.low_stock_threshold}
                      </Text>
                    </View>
                    <Icon
                      color={colors.muted}
                      name="ChevronRight"
                      size={18}
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="CircleCheck"
                message="Aucun produit n’est sous son seuil de surveillance."
                title="Le stock est prêt"
              />
            )}
          </View>
        </View>
      ) : null}
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
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
  rails: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
  },
  railsStacked: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  rail: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  railHeader: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
    minHeight: 76,
    padding: space.md,
  },
  railTitleCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  railTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  railDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  textAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xxs,
    minHeight: 44,
    paddingHorizontal: space.xs,
  },
  textActionPressed: {
    opacity: 0.65,
  },
  textActionLabel: {
    color: colors.accentDark,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  listRow: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 68,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  listRowPressed: {
    backgroundColor: colors.paper2,
  },
  warningMark: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  rowMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  emptyAction: {
    alignItems: "center",
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: space.sm,
  },
  emptyActionLabel: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
});
