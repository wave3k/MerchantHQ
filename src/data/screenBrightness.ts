import * as Brightness from "expo-brightness";
import { Platform } from "react-native";

const SCREENSAVER_BRIGHTNESS = 0.08;

export async function dimScreenForScreensaver(): Promise<() => Promise<void>> {
  if (!(await Brightness.isAvailableAsync())) return async () => undefined;
  const previous = await Brightness.getBrightnessAsync();
  await Brightness.setBrightnessAsync(SCREENSAVER_BRIGHTNESS);
  return async () => {
    if (Platform.OS === "android") {
      await Brightness.restoreSystemBrightnessAsync();
      return;
    }
    await Brightness.setBrightnessAsync(previous);
  };
}
