import { Platform } from "react-native";
import { useEffect, useMemo, useState } from "react";
import * as SecureStore from "./data/secureStore";

// Thème clair — palette « cobalt » (conservée).
const lightColors = {
  paper: "#F7F9FC",
  paper2: "#EEF2F7",
  surface: "#FBFCFE",
  surfaceStrong: "#FFFFFF",
  ink: "#1F2938",
  ink2: "#334155",
  muted: "#647389",
  faint: "#647389",
  rule: "#D9E0EA",
  ruleStrong: "#B9C5D4",
  accent: "#1D55C5",
  accentDark: "#16449E",
  accentSoft: "#E8EFFC",
  accentInk: "#F8FAFF",
  panelInk: "#1F2938",
  onPanelInk: "#F8FAFF",
  success: "#187A4D",
  successSoft: "#E8F6EF",
  warning: "#8A5700",
  warningSoft: "#FFF4D8",
  error: "#B42318",
  errorSoft: "#FEECEB",
  errorPressed: "#FAD9D6",
  errorBorder: "#F3B7B1",
  warningBorder: "#E7C77C",
  inkSurfaceText: "#C9D2DF",
  successBright: "#62C995",
  overlay: "rgba(17, 30, 50, 0.52)",
  ticketPaper: "#FFFFFF",
  ticketInk: "#1F2938",
  ticketMuted: "#647389",
  ticketRule: "#556273",
  ticketBorder: "#C9D2DF",
} as const;

// Thème sombre — dérivé du brand (teinte bleue ~260°), contrastes AA.
const darkColors: ColorPalette = {
  paper: "#0E1420",
  paper2: "#131B2A",
  surface: "#151D2C",
  surfaceStrong: "#1C2638",
  ink: "#E8EEF9",
  ink2: "#C6D1E3",
  muted: "#8E9DB8",
  faint: "#7C8AA5",
  rule: "#2A3448",
  ruleStrong: "#3A4761",
  accent: "#6C9EF2",
  accentDark: "#7BA6F5",
  accentSoft: "#1A2942",
  accentInk: "#0E1522",
  panelInk: "#0D1526",
  onPanelInk: "#E8EEF9",
  success: "#57C98A",
  successSoft: "#12291C",
  warning: "#F0C060",
  warningSoft: "#2E2410",
  error: "#FF7A70",
  errorSoft: "#3D1F20",
  errorPressed: "#512629",
  errorBorder: "#8F4D4D",
  warningBorder: "#705826",
  inkSurfaceText: "#DCE6F4",
  successBright: "#70DDAA",
  overlay: "rgba(0, 0, 0, 0.72)",
  ticketPaper: "#FFFFFF",
  ticketInk: "#1F2938",
  ticketMuted: "#647389",
  ticketRule: "#556273",
  ticketBorder: "#C9D2DF",
};

type ColorPalette = { [Key in keyof typeof lightColors]: string };

export type AppTheme = "light" | "dark";

// Migration : les anciennes valeurs « cobalt », « night », « contrast »
// sont mappées vers le nouveau système light/dark.
function migrateTheme(value: string | null): AppTheme {
  if (value === "dark" || value === "night" || value === "contrast") {
    return "dark";
  }
  return "light";
}

function readTheme(): AppTheme {
  try {
    return migrateTheme(SecureStore.getItem("commerce.theme"));
  } catch {
    return "light";
  }
}

export let activeTheme: AppTheme = readTheme();

const palettes: Record<AppTheme, ColorPalette> = {
  light: lightColors,
  dark: darkColors,
};

// Palette mutable : on y copie les couleurs du thème actif pour que le
// thème puisse changer en direct sans redémarrer l’application.
export const colors: ColorPalette = { ...lightColors };

export function applyTheme(theme: AppTheme): void {
  activeTheme = theme;
  Object.assign(colors, palettes[theme]);
  notifyThemeChange();
}

export const setTheme = applyTheme;

let themeListeners: Array<() => void> = [];

export function subscribeTheme(listener: () => void): () => void {
  themeListeners.push(listener);
  return () => {
    themeListeners = themeListeners.filter((candidate) => candidate !== listener);
  };
}

function notifyThemeChange(): void {
  for (const listener of themeListeners) {
    listener();
  }
}

export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(
    () =>
      subscribeTheme(() => {
        setVersion((value) => value + 1);
      }),
    [],
  );
  return version;
}

export function useThemedStyles<T>(factory: () => T): T {
  const version = useThemeVersion();
  return useMemo(factory, [version]);
}

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
  displaySemibold: "SpaceGrotesk_600SemiBold",
  body: "IBMPlexSans_400Regular",
  bodyMedium: "IBMPlexSans_500Medium",
  bodySemibold: "IBMPlexSans_600SemiBold",
  bodyBold: "IBMPlexSans_700Bold",
  mono: "JetBrainsMono_500Medium",
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  round: 999,
} as const;

export const shadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: activeTheme === "dark" ? "#000000" : "#13233C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
});