import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { getWorkerUrl } from "../data/cloudSession";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

type Connectivity = "checking" | "online" | "offline";

// Petit témoin de connexion : vert quand le cloud est joignable, ambre sinon.
// Ne bloque rien — c'est une information, pas un verrou.
export function OfflineIndicator() {
  const styles = useThemedStyles(createStyles);
  const [status, setStatus] = useState<Connectivity>("checking");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function check() {
    const url = await getWorkerUrl();
    if (!url) {
      setStatus("offline");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      setStatus("online");
    } catch {
      setStatus("offline");
    } finally {
      clearTimeout(timeout);
    }
  }

  useEffect(() => {
    void check();
    timer.current = setInterval(() => {
      void check();
    }, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      if (timer.current) clearInterval(timer.current);
      subscription.remove();
    };
  }, []);

  const label =
    status === "online"
      ? "En ligne"
      : status === "offline"
        ? "Hors ligne"
        : "Vérification…";
  const dotColor =
    status === "online"
      ? colors.success
      : status === "offline"
        ? colors.warning
        : colors.faint;

  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessible
      style={styles.row}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    row: { alignItems: "center", flexDirection: "row", gap: space.xs },
    dot: {
      borderRadius: radius.round,
      height: 8,
      width: 8,
    },
    text: {
      color: colors.muted,
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
    },
  });
}