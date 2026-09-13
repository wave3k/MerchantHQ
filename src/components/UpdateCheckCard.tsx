import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Updates from "expo-updates";
import { APP_VERSION } from "../appInfo";
import { AppButton } from "./AppButton";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up_to_date" }
  | { status: "available"; updateId?: string }
  | { status: "downloaded" }
  | { status: "error"; message: string };

// Vérifie les mises à jour OTA (EAS Update) et permet de les installer tout
// de suite ou au prochain démarrage. Sur le web et dans Expo Go, l'API est
// un stub : la carte reste silencieusement inopérante.
export function UpdateCheckCard() {
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [busy, setBusy] = useState<"check" | "now" | "next" | null>(null);

  async function check() {
    setState({ status: "checking" });
    setBusy("check");
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setState({ status: "available", updateId: result.manifest?.id });
      } else {
        setState({ status: "up_to_date" });
      }
    } catch {
      setState({
        status: "error",
        message: "Impossible de vérifier les mises à jour. Réessayez.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function install(now: boolean) {
    setBusy(now ? "now" : "next");
    try {
      await Updates.fetchUpdateAsync();
      setState({ status: "downloaded" });
      if (now) await Updates.reloadAsync();
    } catch {
      setState({
        status: "error",
        message: "Le téléchargement de la mise à jour a échoué.",
      });
    } finally {
      setBusy(null);
    }
  }

  // Sur le web et en développement (Expo Go / dev build), l'API EAS Update est
  // désactivée : on l'explique clairement au lieu d'afficher une erreur.
  if (Platform.OS === "web" || !Updates.isEnabled) {
    return (
      <View style={styles.row}>
        <Text style={styles.meta}>Version {APP_VERSION}</Text>
        <Text style={styles.hint}>
          {Platform.OS === "web"
            ? "Les mises à jour arrivent automatiquement sur cette version."
            : "Les mises à jour OTA s’installent depuis la version publiée de l’application (APK/Play Store)."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.statusRow}>
        <Text style={styles.versionBadge}>Version {APP_VERSION}</Text>
        {state.status === "available" ? (
          <Text style={styles.available}>Mise à jour disponible</Text>
        ) : state.status === "up_to_date" ? (
          <Text style={styles.ok}>Vous êtes à jour</Text>
        ) : state.status === "downloaded" ? (
          <Text style={styles.ok}>Téléchargée</Text>
        ) : state.status === "error" ? (
          <Text style={styles.error}>{state.message}</Text>
        ) : null}
      </View>

      {state.status === "idle" || state.status === "checking" ? (
        <AppButton
          compact
          icon="RefreshCw"
          label="Vérifier les mises à jour"
          loading={busy === "check"}
          onPress={() => void check()}
          tone="secondary"
        />
      ) : null}

      {state.status === "available" ? (
        <View style={styles.actions}>
          <AppButton
            compact
            icon="Download"
            label="Installer maintenant"
            loading={busy === "now"}
            onPress={() => void install(true)}
          />
          <AppButton
            compact
            icon="Clock"
            label="Au prochain démarrage"
            loading={busy === "next"}
            onPress={() => void install(false)}
            tone="secondary"
          />
        </View>
      ) : null}

      {state.status === "up_to_date" || state.status === "downloaded" ? (
        <AppButton
          compact
          icon="RefreshCw"
          label="Revérifier"
          onPress={() => void check()}
          tone="ghost"
        />
      ) : null}

      {state.status === "error" ? (
        <AppButton
          compact
          icon="RefreshCw"
          label="Réessayer"
          onPress={() => void check()}
          tone="secondary"
        />
      ) : null}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrap: { gap: space.sm },
    statusRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
    },
    versionBadge: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.round,
      color: colors.accentDark,
      fontFamily: fonts.bodySemibold,
      fontSize: 12,
      overflow: "hidden",
      paddingHorizontal: space.sm,
      paddingVertical: space.xxs,
    },
    available: {
      color: colors.accentDark,
      fontFamily: fonts.bodySemibold,
      fontSize: 13,
    },
    ok: {
      color: colors.success,
      fontFamily: fonts.bodySemibold,
      fontSize: 13,
    },
    error: {
      color: colors.error,
      fontFamily: fonts.body,
      fontSize: 13,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.xs,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
    },
    meta: {
      color: colors.ink2,
      fontFamily: fonts.bodySemibold,
      fontSize: 13,
    },
    hint: {
      color: colors.muted,
      fontFamily: fonts.body,
      fontSize: 12,
    },
  });
}