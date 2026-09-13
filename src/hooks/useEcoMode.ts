import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Battery from "expo-battery";

// Seuil de batterie faible (20 %).
const LOW_BATTERY_THRESHOLD = 0.2;

// Mode éco : activé quand le mode économie d'énergie du système est actif, ou
// quand la batterie est faible et que l'appareil n'est pas en charge.
//
// On évite volontairement `Battery.usePowerState()` qui s'appuie sur l'API
// d'événements legacy, indisponible sur le web. Le hook reste inactif sur web.
export function useEcoMode(): boolean {
  const [eco, setEco] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let mounted = true;

    async function update(): Promise<void> {
      try {
        const state = await Battery.getPowerStateAsync();
        const low =
          state.batteryLevel >= 0 &&
          state.batteryLevel <= LOW_BATTERY_THRESHOLD;
        const charging =
          state.batteryState === Battery.BatteryState.CHARGING ||
          state.batteryState === Battery.BatteryState.FULL;
        const next = Boolean(state.lowPowerMode) || (low && !charging);
        if (mounted) setEco(next);
      } catch {
        // Batterie indisponible : mode éco inactif.
      }
    }

    void update();

    const subscriptions = [
      Battery.addBatteryLevelListener(() => void update()),
      Battery.addBatteryStateListener(() => void update()),
      Battery.addLowPowerModeListener(() => void update()),
    ];

    return () => {
      mounted = false;
      for (const subscription of subscriptions) {
        try {
          subscription?.remove?.();
        } catch {}
      }
    };
  }, []);

  return eco;
}