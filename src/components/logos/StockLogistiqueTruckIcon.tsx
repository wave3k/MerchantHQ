import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function StockLogistiqueTruckIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Stock Camion",
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
      <Rect fill={color} height={18} rx={4} width={24} x={4} y={16} />
      <Path d="M28 22 h10 l6 6 v6 h-16 z" fill={colors.accentDark} />
      <Rect fill={detail} height={5} rx={1} width={6} x={30} y={24} />
      <Circle cx={12} cy={36} fill={colors.accentDark} r={3.5} />
      <Circle cx={12} cy={36} fill={detail} r={1.5} />
      <Circle cx={38} cy={36} fill={colors.accentDark} r={3.5} />
      <Circle cx={38} cy={36} fill={detail} r={1.5} />
    </Svg>
  );
}