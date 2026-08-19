import Icon from "./Icon";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CashRegisterIcon } from "./CashRegisterIcon";
import { dimScreenForScreensaver } from "../data/screenBrightness";
import { t } from "../i18n";
import { locale } from "../domain/format";
import { colors, fonts, radius, space } from "../theme";

export function Screensaver({
  shopName,
  onWake,
}: {
  shopName: string;
  onWake: () => void;
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1_000);
    let restore: (() => Promise<void>) | undefined;
    let mounted = true;
    void dimScreenForScreensaver()
      .then((nextRestore) => {
        if (mounted) restore = nextRestore;
        else void nextRestore();
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      clearInterval(interval);
      if (restore) void restore().catch(() => undefined);
    };
  }, []);

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale(), {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(currentTime),
    [currentTime],
  );
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat(locale(), {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(currentTime),
    [currentTime],
  );

  return (
    <Pressable
      accessibilityHint="Ouvre l’écran de connexion"
      accessibilityLabel="Réveiller MerchantHQ"
      accessibilityRole="button"
      onPress={onWake}
      style={({ pressed }) => [
        styles.screen,
        pressed && styles.screenPressed,
      ]}
    >
      <CashRegisterIcon
        color={colors.accentInk}
        detail={colors.inkSurfaceText}
        size={112}
      />
      <Text accessibilityRole="header" style={styles.time}>{time}</Text>
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.name}>{shopName}</Text>
      <View style={styles.prompt}>
        <Icon name="Fingerprint" size={20} color={colors.accent} />
        <Text style={styles.promptText}>{t("Touchez pour vous reconnecter")}</Text>
      </View>
      <Text style={styles.brand}>MerchantHQ</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: colors.ink,
    flex: 1,
    justifyContent: "center",
    padding: space.xl,
  },
  screenPressed: {
    opacity: 0.9,
  },
  time: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.display,
    fontSize: 104,
    fontVariant: ["tabular-nums"],
    letterSpacing: -4,
    lineHeight: 112,
  },
  date: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    marginBottom: space.lg,
    opacity: 0.72,
    textTransform: "capitalize",
  },
  name: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.display,
    fontSize: 42,
    maxWidth: 760,
    textAlign: "center",
  },
  prompt: {
    alignItems: "center",
    borderColor: colors.ruleStrong,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    marginTop: space.xl,
    minHeight: 48,
    paddingHorizontal: space.lg,
  },
  promptText: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  brand: {
    bottom: space.lg,
    color: colors.inkSurfaceText,
    fontFamily: fonts.mono,
    fontSize: 10,
    position: "absolute",
    textTransform: "uppercase",
    opacity: 0.58,
  },
});
