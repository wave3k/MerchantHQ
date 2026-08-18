import { Platform } from "react-native";
import * as SecureStore from "./data/secureStore";

const cobaltColors = {
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

type ColorPalette = { [Key in keyof typeof cobaltColors]: string };

const nightColors: ColorPalette = {
  paper: "#10141D",
  paper2: "#1A2230",
  surface: "#1A2230",
  surfaceStrong: "#202939",
  ink: "#F3F7FD",
  ink2: "#DEE6F2",
  muted: "#A9B6CA",
  faint: "#A9B6CA",
  rule: "#33405A",
  ruleStrong: "#4E5F80",
  accent: "#5B8DEF",
  accentDark: "#7BA6F5",
  accentSoft: "#1B2942",
  accentInk: "#0E1522",
  success: "#5ECB8F",
  successSoft: "#13291C",
  warning: "#F5C462",
  warningSoft: "#2E2410",
  error: "#FF8A82",
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

const contrastColors: ColorPalette = {
  paper: "#FFFFFF",
  paper2: "#F2F2F2",
  surface: "#FFFFFF",
  surfaceStrong: "#FFFFFF",
  ink: "#000000",
  ink2: "#111111",
  muted: "#333333",
  faint: "#444444",
  rule: "#777777",
  ruleStrong: "#222222",
  accent: "#0033B3",
  accentDark: "#00217A",
  accentSoft: "#DCE7FF",
  accentInk: "#FFFFFF",
  success: "#006B3C",
  successSoft: "#DDF8EB",
  warning: "#704400",
  warningSoft: "#FFF0C7",
  error: "#A40000",
  errorSoft: "#FFE2E2",
  errorPressed: "#FFCACA",
  errorBorder: "#A40000",
  warningBorder: "#704400",
  inkSurfaceText: "#FFFFFF",
  successBright: "#70E0A8",
  overlay: "rgba(0, 0, 0, 0.72)",
  ticketPaper: "#FFFFFF",
  ticketInk: "#1F2938",
  ticketMuted: "#647389",
  ticketRule: "#556273",
  ticketBorder: "#C9D2DF",
};

export type AppTheme = "cobalt" | "night" | "contrast";

function readTheme(): AppTheme {
  try {
    const value = SecureStore.getItem("commerce.theme");
    return value === "night" || value === "contrast" ? value : "cobalt";
  } catch {
    return "cobalt";
  }
}

export const activeTheme = readTheme();
export const colors =
  activeTheme === "night"
    ? nightColors
    : activeTheme === "contrast"
      ? contrastColors
      : cobaltColors;

export const fonts = {
  display: "SpaceGrotesk_600SemiBold",
  displayMedium: "SpaceGrotesk_500Medium",
  body: "IBMPlexSans_400Regular",
  bodyMedium: "IBMPlexSans_500Medium",
  bodySemibold: "IBMPlexSans_600SemiBold",
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
    shadowColor: activeTheme === "night" ? "#000000" : "#13233C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
});
