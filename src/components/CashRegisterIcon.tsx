import Svg, { Rect } from "react-native-svg";

import { colors } from "../theme";

export function CashRegisterIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo MerchantHQ",
}: {
  size?: number;
  color?: string;
  detail?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Svg
      accessibilityLabel={accessibilityLabel}
      height={size}
      viewBox="0 0 48 48"
      width={size}
    >
      <Rect fill={color} height={7} rx={2.5} width={20} x={14} y={4} />
      <Rect fill={color} height={28} rx={9} width={36} x={6} y={14} />
      <Rect fill={detail} height={3} rx={1.5} width={30} x={9} y={18.5} />
      <Rect fill={detail} height={4} rx={2} width={12} x={18} y={32} />
    </Svg>
  );
}
