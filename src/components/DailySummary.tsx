import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { SQLiteDatabase } from "expo-sqlite";
import Icon from "./Icon";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";
import { getDaySummary } from "../data/database";
import { formatMoney } from "../domain/format";

interface DailySummaryProps {
  db: SQLiteDatabase;
}

// Bouton « Résumé du jour » affiché à côté de l'horloge le soir (>= 17h),
// ou dès qu'il y a des ventes aujourd'hui. Ouvre une synthèse de la journée.
export function DailySummary({ db }: DailySummaryProps) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [data, setData] = useState<{
    orders: number;
    revenue: number;
    clients: number;
    expenses: number;
    items: number;
  } | null>(null);

  useEffect(() => {
    const check = () => {
      const hour = new Date().getHours();
      if (hour >= 17) {
        setShow(true);
      } else {
        void getDaySummary(db).then((d) => setShow((d?.orders ?? 0) > 0));
      }
    };
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [db]);

  async function openSummary() {
    setData(await getDaySummary(db));
    setOpen(true);
  }

  if (!show) return null;

  return (
    <>
      <Animated.View entering={FadeIn.duration(400)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir le résumé du jour"
          onPress={() => void openSummary()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Icon name="Clock" size={15} color={colors.accentInk} />
          <Text style={styles.buttonText}>Résumé du jour</Text>
        </Pressable>
      </Animated.View>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Résumé du jour</Text>
                <Text style={styles.subtitle}>
                  {new Date().toLocaleDateString("fr", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.close} accessibilityRole="button">
                <Icon name="X" size={20} color={colors.ink2} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
              {[
                { label: "Ventes du jour", value: data ? formatMoney(data.revenue) : "—", icon: "Banknote" },
                { label: "Commandes", value: data ? String(data.orders) : "—", icon: "ShoppingCart" },
                { label: "Articles vendus", value: data ? String(data.items) : "—", icon: "Package" },
                { label: "Nouveaux clients", value: data ? String(data.clients) : "—", icon: "Users" },
                { label: "Dépenses", value: data ? formatMoney(data.expenses) : "—", icon: "Wallet" },
              ].map((item) => (
                <View key={item.label} style={styles.stat}>
                  <Icon name={item.icon as never} size={18} color={colors.accent} />
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.done}>
              <Text style={styles.doneText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles() {
  return StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    flexDirection: "row",
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
  },
  buttonText: {
    color: colors.accentInk,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: 460,
    padding: space.lg,
    width: "100%",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: space.xxs,
    textTransform: "capitalize",
  },
  close: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingVertical: space.lg,
  },
  stat: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    flexBasis: "46%",
    flexGrow: 1,
    gap: space.xxs,
    padding: space.md,
  },
  statValue: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
  },
  done: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    minHeight: 44,
    justifyContent: "center",
  },
  doneText: {
    color: colors.ink2,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  });
}