import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function StockLogistiqueDetailIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Stock Logistique détaillé",
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
      <Rect fill={detail} height={10} rx={3.5} width={14} x={30} y={4} />
      <Rect fill={color} height={24} rx={6} width={28} x={10} y={16} />
      <Path
        d="M24 32 v-8"
        fill="none"
        stroke={detail}
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Path
        d="M19 26 l5 -5 5 5"
        fill="none"
        stroke={detail}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
    </Svg>
  );
}