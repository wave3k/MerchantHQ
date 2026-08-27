import { CashRegisterIcon } from "../CashRegisterIcon";
import type { LogoProps } from "../logos";

export function MerchantCashIcon({
  size = 40,
  color = "#1D55C5",
  detail = "#E8EFFC",
  accessibilityLabel = "Logo MerchantHQ",
}: LogoProps) {
  return (
    <CashRegisterIcon
      accessibilityLabel={accessibilityLabel}
      color={color}
      detail={detail}
      size={size}
    />
  );
}