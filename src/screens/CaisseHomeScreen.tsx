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
import { listAppointments } from "../data/database";
import { userCanAccessScreen } from "../domain/permissions";
import { formatDateTime } from "../domain/format";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import type { Appointment, ScreenKey, User } from "../types";

interface CaisseHomeScreenProps {
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
    screen: "orders",
    label: "Nouvelle vente",
    description: "Ouvrir le panier et encaisser.",
    icon: "ShoppingCart",
  },
  {
    screen: "clients",
    label: "Nouveau client",
    description: "Ajouter ou retrouver un client.",
    icon: "UserPlus",
  },
  {
    screen: "appointments",
    label: "Nouveau rendez-vous",
    description: "Planifier le prochain passage.",
    icon: "CalendarPlus",
  },
];

export function CaisseHomeScreen({
  db,
  user,
  onNavigate,
}: CaisseHomeScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState("");
  const stacked = width < 900;

  useEffect(() => {
    void listAppointments(db)
      .then((data) => {
        const now = Date.now();
        setAppointments(
          data
            .filter(
              (appointment) =>
                appointment.status === "scheduled" &&
                new Date(appointment.scheduled_at).getTime() >= now,
            )
            .slice(0, 5),
        );
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "L’accueil de la caisse n’a pas pu être chargé.",
        ),
      );
  }, [db]);

  return (
    <Page
      action={<LiveClock />}
      description="Les actions utiles maintenant pour les encaissements."
      title="Caisse"
    >
      <View style={styles.actionsBand}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Que voulez-vous faire ?</Text>
          <Text style={styles.sectionDescription}>
            Choisissez une action pour commencer.
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
      {!appointments && !error ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : appointments ? (
        <View style={[styles.rails, stacked && styles.railsStacked]}>
          <View style={styles.rail}>
            <View style={styles.railHeader}>
              <View style={styles.railTitleCopy}>
                <Text style={styles.railTitle}>Prochains rendez-vous</Text>
                <Text style={styles.railDescription}>
                  Les visites à préparer.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => onNavigate("appointments")}
                style={({ pressed }) => [
                  styles.textAction,
                  pressed && styles.textActionPressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.textActionLabel}>
                  Voir tout
                </Text>
                <Icon
                  color={colors.accent}
                  name="ArrowRight"
                  size={17}
                />
              </Pressable>
            </View>
            {appointments.length ? (
              <View>
                {appointments.map((appointment) => (
                  <Pressable
                    accessibilityRole="button"
                    key={appointment.id}
                    onPress={() => onNavigate("appointments")}
                    style={({ pressed }) => [
                      styles.listRow,
                      pressed && styles.listRowPressed,
                    ]}
                  >
                    <View style={styles.dateMark}>
                      <Icon
                        color={colors.accent}
                        name="CalendarClock"
                        size={19}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {appointment.client_name}
                      </Text>
                      <Text numberOfLines={1} style={styles.rowMeta}>
                        {formatDateTime(appointment.scheduled_at)}
                        {appointment.product_name
                          ? ` · ${appointment.product_name}`
                          : ""}
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
                action={
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onNavigate("appointments")}
                    style={styles.emptyAction}
                  >
                    <Text numberOfLines={1} style={styles.emptyActionLabel}>
                      Planifier un rendez-vous
                    </Text>
                  </Pressable>
                }
                icon="CalendarDays"
                message="Les prochains passages apparaîtront ici."
                title="Aucun rendez-vous à venir"
              />
            )}
          </View>
        </View>
      ) : null}
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
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
  dateMark: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
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
}
