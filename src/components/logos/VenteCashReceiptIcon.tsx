import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function VenteCashReceiptIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Vente Cash Re\u00e7u",
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
      <Rect fill={detail} height={36} rx={4} width={28} x={10} y={6} />
      <Rect fill={color} height={3} rx={1.5} width={20} x={14} y={12} />
      <Rect fill={color} height={2} rx={1} width={16} x={14} y={19} opacity={0.5} />
      <Rect fill={color} height={2} rx={1} width={20} x={14} y={24} opacity={0.5} />
      <Rect fill={color} height={2} rx={1} width={12} x={14} y={29} opacity={0.5} />
      <Path
        d="M14 35 l3 3 3 -3 3 3 3 -3 3 3 3 -3"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}