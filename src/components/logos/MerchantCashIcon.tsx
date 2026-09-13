import { AppLogoImage } from "../AppLogoImage";
import type { LogoProps } from "./LogoProps";

export function MerchantCashIcon({
  size = 40,
  accessibilityLabel = "Logo MerchantHQ",
}: LogoProps) {
  return <AppLogoImage accessibilityLabel={accessibilityLabel} size={size} />;
}
