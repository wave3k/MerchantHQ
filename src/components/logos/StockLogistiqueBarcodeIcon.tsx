import Svg, { Rect } from "react-native-svg";

import { colors } from "../../theme";

export function StockLogistiqueBarcodeIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Stock Code-barres",
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
      <Rect fill={color} height={32} rx={6} width={32} x={8} y={8} />
      <Rect fill={detail} height={16} rx={1} width={3} x={13} y={14} />
      <Rect fill={detail} height={16} rx={1} width={2} x={18} y={14} />
      <Rect fill={detail} height={16} rx={1} width={4} x={22} y={14} />
      <Rect fill={detail} height={16} rx={1} width={2} x={28} y={14} />
      <Rect fill={detail} height={16} rx={1} width={3} x={32} y={14} />
      <Rect
        fill={detail}
        height={2}
        opacity={0.5}
        rx={1}
        width={20}
        x={14}
        y={34}
      />
    </Svg>
  );
}