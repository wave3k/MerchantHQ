import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { AppButton } from "./AppButton";
import { getSession } from "../data/cloudSession";
import {
  prepareDeviceNotifications,
  refreshOperationalNotifications,
  sendTestNotification,
} from "../data/notifications";
import { planLabel, subscriptionDaysLeft } from "../domain/subscription";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

// Carte de tests réservée au mode développeur : notifications, plan,
// résumé du jour — pour vérifier qu'une fonctionnalité fonctionne.
export function DevTestCard({ db }: { db: SQLiteDatabase }) {
  const styles = useThemedStyles(createStyles);
  const [busy, setBusy] = useState<"notif" | "summary" | null>(null);
  const [permissions, setPermissions] = useState<string | null>(null);

  async function testNotification() {
    setBusy("notif");
    try {
      const ok = await sendTestNotification();
      if (!ok) setPermissions("Permission de notification refusée.");
    } finally {
      setBusy(null);
    }
  }

  async function testSummary() {
    setBusy("summary");
    try {
      await prepareDeviceNotifications(db);
    } finally {
      setBusy(null);
    }
  }

  async function showPermissions() {
    const session = await getSession().catch(() => null);
    if (!session?.subscriptionPermissions) {
      setPermissions("Aucune permission de plan enregistrée localement.");
      return;
    }
    const perms = session.subscriptionPermissions;
    const lines = [
      `${planLabel(session.subscriptionType ?? "")} · ${subscriptionDaysLeft(
        session.subscriptionExpiresAt,
      )} jour(s)`,
      `Tablettes : ${perms.tablets > 0 ? perms.tablets : "illimitées"}`,
      `Caissiers : ${perms.cashiers > 0 ? perms.cashiers : "illimités"}`,
      `Backup : ${perms.backup}`,
      `Rapports : ${perms.reports}`,
      `Export Excel : ${perms.export_excel ? "oui" : "non"}`,
      `Tickets : ${perms.tickets ? "oui" : "non"}`,
      `Support : ${perms.support}`,
    ];
    setPermissions(lines.join("\n"));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <AppButton
          compact
          icon="Bell"
          label="Tester une notification"
          loading={busy === "notif"}
          onPress={() => void testNotification()}
          tone="secondary"
        />
        <AppButton
          compact
          icon="ShieldCheck"
          label="Vérifier les permissions"
          onPress={() => void showPermissions()}
          tone="secondary"
        />
        <AppButton
          compact
          icon="Clock"
          label="Replanifier le résumé du jour"
          loading={busy === "summary"}
          onPress={() => void testSummary()}
          tone="secondary"
        />
      </View>
      {permissions ? <Text style={styles.output}>{permissions}</Text> : null}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrap: { gap: space.sm },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.xs,
    },
    output: {
      backgroundColor: colors.paper2,
      borderRadius: radius.md,
      color: colors.ink2,
      fontFamily: fonts.mono,
      fontSize: 12,
      lineHeight: 18,
      padding: space.sm,
    },
  });
}