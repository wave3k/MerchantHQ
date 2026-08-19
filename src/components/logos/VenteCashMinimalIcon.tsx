import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "../../theme";

export function VenteCashMinimalIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Vente Cash Minimale",
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
      <Circle cx={24} cy={24} fill={color} r={14} />
      <Circle cx={24} cy={24} fill={detail} r={9} />
      <Circle cx={24} cy={24} fill={color} r={4} />
      <Path
        d="M24 15 v-2 M24 35 v-2 M15 24 h-2 M35 24 h-2"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}