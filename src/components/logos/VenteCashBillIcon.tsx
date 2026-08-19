import Svg, { Circle, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function VenteCashBillIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Vente Cash Billet",
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
      <Rect fill={color} height={20} rx={4} width={40} x={4} y={14} />
      <Rect fill={detail} height={12} rx={2} width={32} x={8} y={18} />
      <Circle cx={24} cy={24} fill={color} opacity={0.4} r={5} />
    </Svg>
  );
}