import * as Battery from "expo-battery";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { TranslatedText as Text } from "./TranslatedText";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import { activeLanguage } from "../i18n";
import {useThemedStyles,  colors, fonts, space } from "../theme";

function locale(): string {
  return activeLanguage === "en" ? "en-US" : "fr-FR";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

function batteryIcon(level: number, charging: boolean): IconName {
  if (charging || level >= 0.99) return "BatteryCharging";
  if (level >= 0.8) return "BatteryFull";
  if (level >= 0.5) return "BatteryMedium";
  if (level >= 0.2) return "BatteryLow";
  return "BatteryWarning";
}

export function LiveClock() {
  const styles = useThemedStyles(createStyles);
  const [now, setNow] = useState(() => new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      let mounted = true;
      void Battery.getBatteryLevelAsync().then((level) => {
        if (mounted) setBatteryLevel(level);
      });
      void Battery.getBatteryStateAsync().then((state) => {
        if (mounted) {
          setCharging(
            state === Battery.BatteryState.CHARGING ||
              state === Battery.BatteryState.FULL,
          );
        }
      });
      const levelSub = Battery.addBatteryLevelListener(({ batteryLevel: level }) => {
        if (mounted) setBatteryLevel(level);
      });
      const stateSub = Battery.addBatteryStateListener(({ batteryState: state }) => {
        if (mounted) {
          setCharging(
            state === Battery.BatteryState.CHARGING ||
              state === Battery.BatteryState.FULL,
          );
        }
      });
      return () => {
        mounted = false;
        levelSub.remove();
        stateSub.remove();
      };
    }

    // Web: navigator.getBattery()
    let mounted = true;
    let batteryManager: any = null;
    const onLevelChange = () => {
      if (mounted && batteryManager) {
        setBatteryLevel(batteryManager.level as number);
        setCharging(batteryManager.charging as boolean);
      }
    };
    void (navigator as any).getBattery?.().then((bm: any) => {
      if (!mounted) return;
      batteryManager = bm;
      setBatteryLevel(bm.level as number);
      setCharging(bm.charging as boolean);
      bm.addEventListener("levelchange", onLevelChange);
      bm.addEventListener("chargingchange", onLevelChange);
    }).catch(() => undefined);
    return () => {
      mounted = false;
      if (batteryManager) {
        batteryManager.removeEventListener("levelchange", onLevelChange);
        batteryManager.removeEventListener("chargingchange", onLevelChange);
      }
    };
  }, []);

  const batteryColor =
    batteryLevel !== null && batteryLevel <= 0.2 ? colors.error : colors.ink;

  return (
    <View style={styles.clock}>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(now)}</Text>
        {batteryLevel !== null ? (
          <View style={styles.battery}>
            <Icon
              name={batteryIcon(batteryLevel, charging)}
              size={18}
              color={batteryColor}
            />
            <Text style={[styles.batteryText, { color: batteryColor }]}>
              {Math.round(batteryLevel * 100)}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.date}>{formatDate(now)}</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  clock: {
    alignItems: "flex-end",
    gap: space.xxs,
  },
  timeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  time: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  battery: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  batteryText: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  date: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textTransform: "capitalize",
  },
});
}