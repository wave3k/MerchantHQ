import { AppLogoImage } from "./AppLogoImage";

export function CashRegisterIcon({
  size = 80,
  accessibilityLabel = "Logo MerchantHQ",
}: {
  size?: number;
  color?: string;
  detail?: string;
  accessibilityLabel?: string;
}) {
  return <AppLogoImage accessibilityLabel={accessibilityLabel} size={size} />;
}
