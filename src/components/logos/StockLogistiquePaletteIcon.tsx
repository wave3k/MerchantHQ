import Svg, { Rect } from "react-native-svg";

import { colors } from "../../theme";

export function StockLogistiquePaletteIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Stock Palette",
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
      <Rect fill={color} height={20} rx={4} width={36} x={6} y={20} />
      <Rect fill={colors.accentDark} height={14} rx={3} width={28} x={10} y={10} />
      <Rect fill={detail} height={10} rx={3} width={20} x={14} y={4} />
      <Rect
        fill={detail}
        height={3}
        rx={1.5}
        opacity={0.6}
        width={12}
        x={18}
        y={26}
      />
    </Svg>
  );
}