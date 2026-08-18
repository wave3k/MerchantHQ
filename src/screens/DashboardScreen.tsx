import type { SQLiteDatabase } from "expo-sqlite";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import { useEffect, useState } from "react";

import { AppButton } from "../components/AppButton";
import { Badge, EmptyState, Page } from "../components/Page";
import { getDashboardStats } from "../data/database";
import { formatDateTime, formatMoney } from "../domain/format";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { DashboardStats, ScreenKey, User } from "../types";

interface DashboardScreenProps {
  db: SQLiteDatabase;
  user: User;
  onNavigate: (screen: ScreenKey) => void;
}

function StatCard({
  icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: IconName;
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <View style={[styles.statCard, tone === "warning" && styles.statWarning]}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <Icon
          name={icon}
          size={20}
          color={tone === "warning" ? colors.warning : colors.accent}
        />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

export function DashboardScreen({
  db,
  user,
  onNavigate,
}: DashboardScreenProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void getDashboardStats(db)
      .then(setStats)
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Le tableau de bord n’a pas pu être chargé.",
        ),
      );
  }, [db]);

  if (!stats && !error) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const employee = user.role === "employee";

  return (
    <Page
      action={
        <AppButton
          icon="ShoppingCart"
          label="Nouvelle vente"
          onPress={() => onNavigate("orders")}
        />
      }
      description={
        employee
          ? "Votre espace de caisse et les dernières commandes."
          : "Activité du jour, évolution de la semaine et alertes de stock."
      }
      title={`Bonjour, ${user.name.split(" ")[0]}`}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {stats ? (
        <>
          <View style={styles.statsGrid}>
            {!employee ? (
              <>
                <StatCard
                  icon="Wallet"
                  label="Chiffre du jour"
                  note={`${stats.ordersToday} commande(s) encaissée(s)`}
                  value={formatMoney(stats.revenueToday)}
                />
                <StatCard
                  icon="CalendarDays"
                  label="Cette semaine"
                  note={`${stats.newClientsWeek} nouveau(x) client(s)`}
                  value={formatMoney(stats.revenueWeek)}
                />
                <StatCard
                  icon="ChartColumn"
                  label="Ce mois"
                  note={`${stats.newClientsMonth} nouveau(x) client(s)`}
                  value={formatMoney(stats.revenueMonth)}
                />
              </>
            ) : (
              <>
                <StatCard
                  icon="Receipt"
                  label="Commandes du jour"
                  note="Toutes les caisses"
                  value={String(stats.ordersToday)}
                />
                <StatCard
                  icon="UserPlus"
                  label="Nouveaux clients"
                  note="Ajoutés aujourd’hui"
                  value={String(stats.newClientsToday)}
                />
              </>
            )}
            <StatCard
              icon="CircleAlert"
              label="Stock à surveiller"
              note={
                stats.lowStockCount
                  ? "Produits au seuil ou en dessous"
                  : "Aucune alerte"
              }
              tone={stats.lowStockCount ? "warning" : "neutral"}
              value={String(stats.lowStockCount)}
            />
          </View>

          <View style={styles.columns}>
            <View style={styles.panelWide}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelTitle}>Dernières commandes</Text>
                  <Text style={styles.panelSubtitle}>Encaissements récents</Text>
                </View>
                <AppButton
                  compact
                  label="Voir la caisse"
                  onPress={() => onNavigate("orders")}
                  tone="ghost"
                />
              </View>
              {stats.recentOrders.length === 0 ? (
                <EmptyState
                  icon="Receipt"
                  message="La première commande apparaîtra ici après l’encaissement."
                  title="Aucune commande aujourd’hui"
                />
              ) : (
                <View>
                  {stats.recentOrders.map((order) => (
                    <View key={order.id} style={styles.orderRow}>
                      <View style={styles.orderIdentity}>
                        <Text style={styles.orderNumber}>{order.order_number}</Text>
                        <Text style={styles.orderMeta}>
                          {order.client_name ?? "Client de passage"} ·{" "}
                          {formatDateTime(order.created_at)}
                        </Text>
                      </View>
                      <Badge
                        label={
                          order.payment_method === "cash"
                            ? "Espèces"
                            : order.payment_method === "card"
                              ? "Carte"
                              : "Mobile Money"
                        }
                        tone="success"
                      />
                      <Text style={styles.orderTotal}>{formatMoney(order.total)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {!employee ? (
              <View style={styles.panelNarrow}>
                <View>
                  <Text style={styles.panelTitle}>Produits populaires</Text>
                  <Text style={styles.panelSubtitle}>Depuis le début du mois</Text>
                </View>
                {stats.topProducts.length === 0 ? (
                  <Text style={styles.muted}>Les ventes alimenteront ce classement.</Text>
                ) : (
                  stats.topProducts.map((product, index) => (
                    <View key={product.name} style={styles.productRow}>
                      <Text style={styles.rank}>{String(index + 1).padStart(2, "0")}</Text>
                      <View style={styles.productCopy}>
                        <Text numberOfLines={1} style={styles.productName}>
                          {product.name}
                        </Text>
                        <Text style={styles.productQty}>
                          {product.quantity} unité(s)
                        </Text>
                      </View>
                      <Text style={styles.productRevenue}>
                        {formatMoney(product.revenue)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  statCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: space.xs,
    minWidth: 190,
    padding: space.md,
  },
  statWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
  },
  statTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  statValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 26,
    fontVariant: ["tabular-nums"],
  },
  statNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  columns: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
  },
  panelWide: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1.45,
    overflow: "hidden",
  },
  panelNarrow: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 0.8,
    gap: space.md,
    padding: space.md,
  },
  panelHeader: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: space.md,
  },
  panelTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  panelSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: space.xxs,
  },
  orderRow: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 70,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  orderIdentity: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 13,
  },
  orderMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: space.xxs,
  },
  orderTotal: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    minWidth: 100,
    textAlign: "right",
  },
  productRow: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.sm,
  },
  rank: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  productQty: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  productRevenue: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
});
