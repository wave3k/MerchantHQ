/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5 */
/* Hallmark · macrostructure: Ecosystem Index · tone: utilitaire · anchor hue: framboise */
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { Badge, EmptyState, Page } from "../components/Page";
import { getStatistics } from "../data/database";
import { formatDateTime, formatMoney, locale } from "../domain/format";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type {
  ScreenKey,
  StatisticsData,
  StatisticsPeriod,
} from "../types";

interface StatisticsScreenProps {
  db: SQLiteDatabase;
  onNavigate: (screen: ScreenKey) => void;
}

const periodLabels: Record<StatisticsPeriod, string> = {
  today: "Aujourd’hui",
  week: "Cette semaine",
  month: "Ce mois",
};

export function StatisticsScreen({
  db,
  onNavigate,
}: StatisticsScreenProps) {
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<StatisticsPeriod>("month");
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const split = width >= 980;

  async function load(nextPeriod = period) {
    setLoading(true);
    try {
      setStatistics(await getStatistics(db, nextPeriod));
    } catch (caught) {
      Alert.alert(
        "Statistiques indisponibles",
        caught instanceof Error
          ? caught.message
          : "Les données n’ont pas pu être calculées.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(period);
  }, [db, period]);

  const maxRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...(statistics?.revenueByDay.map((item) => item.revenue) ?? []),
      ),
    [statistics],
  );

  return (
    <Page
      action={
        <View style={styles.headerActions}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.periods}
            showsHorizontalScrollIndicator={false}
          >
            {(Object.keys(periodLabels) as StatisticsPeriod[]).map((value) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: period === value }}
                key={value}
                onPress={() => setPeriod(value)}
                style={[
                  styles.period,
                  period === value && styles.periodActive,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.periodText,
                    period === value && styles.periodTextActive,
                  ]}
                >
                  {periodLabels[value]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      }
      description="Toutes les ventes, les produits et le travail de l’équipe au même endroit."
      title="Dashboard"
    >
      {loading && !statistics ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : statistics ? (
        <>
          <View style={[styles.lead, !split && styles.leadStacked]}>
            <View style={styles.revenueBlock}>
              <Text style={styles.revenueLabel}>
                Revenus · {periodLabels[statistics.period]}
              </Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.revenue}>
                {formatMoney(statistics.revenue)}
              </Text>
              <Text style={styles.revenueContext}>
                {statistics.orderCount === 0
                  ? "Aucune vente sur cette période."
                  : `${statistics.orderCount} vente(s), panier moyen ${formatMoney(
                      statistics.averageBasket,
                    )}.`}
              </Text>
            </View>
            <View style={styles.kpis}>
              <Metric
                label="Commandes"
                value={String(statistics.orderCount)}
              />
              <Metric
                label="Articles vendus"
                value={String(statistics.itemsSold)}
              />
              <Metric
                label="Panier moyen"
                value={formatMoney(statistics.averageBasket)}
              />
              <Metric
                label="Nouveaux clients"
                value={String(statistics.newClients)}
              />
            </View>
          </View>

          {statistics.orderCount === 0 ? (
            <EmptyState
              icon="ChartColumn"
              message="Les classements et l’évolution des revenus apparaîtront dès qu’une vente sera enregistrée sur cette période."
              title="Pas encore de ventes"
            />
          ) : (
            <>
              <View style={[styles.rankings, !split && styles.rankingsStacked]}>
                <RankingPanel
                  rows={statistics.topProducts.map((item) => ({
                    label: item.name,
                    meta: `${item.quantity} article(s)`,
                    value: formatMoney(item.revenue),
                  }))}
                  title="Produits les mieux vendus"
                />
                <RankingPanel
                  rows={statistics.topEmployees.map((item) => ({
                    label: item.name,
                    meta: `${item.orderCount} vente(s)`,
                    value: formatMoney(item.revenue),
                  }))}
                  title="Meilleurs employés"
                />
              </View>

              <View style={styles.chart}>
                <View style={styles.chartHeader}>
                  <Text style={styles.panelTitle}>Revenus par jour</Text>
                  <Text style={styles.chartHint}>
                    {statistics.revenueByDay.length} jour(s) avec ventes
                  </Text>
                </View>
                <View style={styles.bars}>
                  {statistics.revenueByDay.map((item) => (
                    <View key={item.day} style={styles.barRow}>
                      <Text style={styles.barDate}>
                        {new Intl.DateTimeFormat(locale(), {
                          day: "2-digit",
                          month: "short",
                        }).format(new Date(`${item.day}T12:00:00`))}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(
                                4,
                                (item.revenue / maxRevenue) * 100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barValue}>
                        {formatMoney(item.revenue)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

            </>
          )}

          {statistics.recentOrders.length ? (
            <View style={styles.ordersPanel}>
              <View style={styles.ordersHeader}>
                <View>
                  <Text style={styles.panelTitle}>Dernières commandes</Text>
                  <Text style={styles.chartHint}>
                    Les encaissements les plus récents
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onNavigate("orders")}
                  style={({ pressed }) => [
                    styles.ordersAction,
                    pressed && styles.ordersActionPressed,
                  ]}
                >
                  <Text numberOfLines={1} style={styles.ordersActionLabel}>
                    Voir la caisse
                  </Text>
                </Pressable>
              </View>
              {statistics.recentOrders.map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderCopy}>
                    <Text style={styles.orderNumber}>
                      {order.order_number}
                    </Text>
                    <Text numberOfLines={1} style={styles.orderMeta}>
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
                  <Text numberOfLines={1} style={styles.orderTotal}>
                    {formatMoney(order.total)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

function RankingPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; meta: string; value: string }>;
}) {
  return (
    <View style={styles.panel}>
      <Text style={[styles.panelTitle, styles.panelHeading]}>{title}</Text>
      <View style={styles.rankingRows}>
        {rows.map((row, index) => (
          <View key={`${row.label}-${index}`} style={styles.rankingRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.rankingCopy}>
              <Text numberOfLines={1} style={styles.rankingLabel}>
                {row.label}
              </Text>
              <Text style={styles.rankingMeta}>{row.meta}</Text>
            </View>
            <Text numberOfLines={1} style={styles.rankingValue}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    justifyContent: "flex-end",
  },
  periods: {
    gap: space.xxs,
  },
  period: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: space.sm,
  },
  periodActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  periodText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  periodTextActive: {
    color: colors.surfaceStrong,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320,
  },
  lead: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: space.md,
  },
  leadStacked: {
    flexDirection: "column",
  },
  revenueBlock: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    flex: 1.15,
    justifyContent: "center",
    minHeight: 220,
    padding: space.lg,
  },
  revenueLabel: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    opacity: 0.86,
  },
  revenue: {
    color: colors.surfaceStrong,
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: -1.4,
    marginVertical: space.xs,
  },
  revenueContext: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  kpis: {
    flex: 0.85,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  metric: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: "46%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 104,
    minWidth: 150,
    padding: space.md,
  },
  metricValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 23,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: space.xxs,
  },
  rankings: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
  },
  rankingsStacked: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  panel: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  panelTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  panelHeading: {
    marginHorizontal: space.md,
    marginTop: space.md,
  },
  rankingRows: {
    marginTop: space.sm,
  },
  rankingRow: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 64,
    paddingHorizontal: space.md,
  },
  rank: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 13,
    width: 20,
  },
  rankingCopy: {
    flex: 1,
    minWidth: 0,
  },
  rankingLabel: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  rankingMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  rankingValue: {
    color: colors.ink2,
    fontFamily: fonts.mono,
    fontSize: 12,
    maxWidth: 140,
  },
  chart: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  chartHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  bars: {
    gap: space.sm,
    marginTop: space.lg,
  },
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    minHeight: 28,
  },
  barDate: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    width: 64,
  },
  barTrack: {
    backgroundColor: colors.paper2,
    borderRadius: radius.sm,
    flex: 1,
    height: 12,
    overflow: "hidden",
  },
  barFill: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    height: "100%",
  },
  barValue: {
    color: colors.ink2,
    fontFamily: fonts.mono,
    fontSize: 11,
    textAlign: "right",
    width: 116,
  },
  ordersPanel: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  ordersHeader: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
    minHeight: 72,
    padding: space.md,
  },
  ordersAction: {
    alignItems: "center",
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: space.sm,
  },
  ordersActionPressed: {
    backgroundColor: colors.paper2,
  },
  ordersActionLabel: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  orderRow: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 68,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  orderCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  orderNumber: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  orderMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  orderTotal: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    minWidth: 100,
    textAlign: "right",
  },
});
