import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function StockLogistiqueIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Stock Logistique",
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
      <Rect fill={detail} height={9} rx={3} width={12} x={28} y={4} />
      <Rect fill={color} height={24} rx={6} width={28} x={10} y={14} />
      <Path
        d="M17 27 l5 5 l9 -9"
        fill="none"
        stroke={detail}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
    </Svg>
  );
}