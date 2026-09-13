import type { SQLiteDatabase } from "expo-sqlite";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import { useEffect, useMemo, useState } from "react";

import { Badge, EmptyState, Page } from "../components/Page";
import {
  listNotificationLogs,
  markNotificationsRead,
} from "../data/database";
import { formatDateTime } from "../domain/format";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { NotificationLog } from "../types";

interface NotificationsScreenProps {
  db: SQLiteDatabase;
}

const typeMeta: Record<
  string,
  { label: string; icon: IconName; tone: "accent" | "warning" | "success" | "neutral" }
> = {
  appointment: { label: "Rendez-vous", icon: "CalendarDays", tone: "accent" },
  stock: { label: "Stock", icon: "Package", tone: "warning" },
  daily_summary: { label: "Résumé", icon: "ChartColumn", tone: "success" },
  test: { label: "Test", icon: "CircleCheck", tone: "neutral" },
};

function typeOf(log: NotificationLog) {
  return typeMeta[log.type] ?? {
    label: log.type,
    icon: "Bell" as IconName,
    tone: "neutral" as const,
  };
}

export function NotificationsScreen({ db }: NotificationsScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    const rows = await listNotificationLogs(db, 100);
    setNotifications(rows);
  }

  useEffect(() => {
    void load();
  }, [db]);

  const unreadCount = useMemo(
    () => notifications.filter((row) => !row.read_at).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((row) => !row.read_at);
    return notifications.filter((row) => row.type === filter);
  }, [notifications, filter]);

  async function markAllRead() {
    await markNotificationsRead(db).catch(() => undefined);
    await load();
  }

  const filterTabs: Array<{ key: string; label: string }> = [
    { key: "all", label: "Toutes" },
    { key: "unread", label: "Non lues" },
    { key: "appointment", label: "Rendez-vous" },
    { key: "stock", label: "Stock" },
    { key: "daily_summary", label: "Résumé" },
  ];

  return (
    <Page
      description="Toutes les notifications envoyées par la boutique : contenu, heure et état."
      title="Centre de notifications"
      action={
        unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Marquer toutes les notifications comme lues"
            onPress={() => void markAllRead()}
            style={({ pressed }) => [
              styles.toggle,
              pressed && styles.togglePressed,
            ]}
          >
            <Icon name="Check" size={16} color={colors.accent} />
            <Text style={styles.toggleText}>Tout marquer lu ({unreadCount})</Text>
          </Pressable>
        ) : null
      }
    >
      <View style={styles.filters}>
        {filterTabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={({ pressed }) => [
                styles.filterChip,
                active && styles.filterChipActive,
                pressed && styles.filterChipPressed,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {filtered.length === 0 ? (
        <EmptyState
          icon="Bell"
          message="Aucune notification ne correspond à ce filtre."
          title="Aucune notification"
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((log) => {
            const meta = typeOf(log);
            const delivered = Boolean(log.delivered_at);
            const unread = !log.read_at;
            return (
              <Pressable
                key={log.id}
                style={({ pressed }) => [
                  styles.row,
                  unread && styles.rowUnread,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.iconWrap}>
                  <Icon
                    name={meta.icon}
                    size={20}
                    color={delivered ? colors.accent : colors.faint}
                  />
                </View>
                <View style={styles.rowContent}>
                  <View style={styles.rowTop}>
                    <Text style={styles.title}>{log.title}</Text>
                    <Badge label={meta.label} tone={meta.tone} />
                  </View>
                  <Text numberOfLines={2} style={styles.body}>
                    {log.body}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDateTime(log.created_at)}
                    {log.scheduled_for
                      ? ` · prévue pour ${formatDateTime(log.scheduled_for)}`
                      : ""}
                    {delivered ? " · envoyée" : " · planifiée"}
                    {log.read_at ? " · lue" : ""}
                  </Text>
                </View>
                {unread ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
  toggle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.rule,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    minHeight: 38,
    paddingHorizontal: space.md,
  },
  togglePressed: {
    backgroundColor: colors.paper2,
  },
  toggleText: {
    color: colors.accent,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.round,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  filterChipPressed: {
    opacity: 0.7,
  },
  filterChipText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: colors.accentDark,
  },
  list: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.sm,
    minHeight: 84,
    paddingHorizontal: space.md,
  },
  rowUnread: {
    backgroundColor: colors.accentSoft,
  },
  unreadDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    height: 8,
    marginTop: space.md,
    width: 8,
  },
  rowPressed: {
    backgroundColor: colors.accentSoft,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    marginTop: space.sm,
    width: 40,
  },
  rowContent: {
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
    paddingVertical: space.sm,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    color: colors.ink2,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
});
}