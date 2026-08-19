import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function QgHubIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo QG Hub",
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
      <Path
        d="M24 6 v10"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={3.5}
      />
      <Path d="M24 6 h8 l-3 4 3 4 h-8 z" fill={color} />
      <Rect fill={color} height={24} rx={7} width={26} x={11} y={16} />
      <Rect fill={detail} height={5} rx={2.5} width={5} x={15} y={22} />
      <Rect fill={detail} height={5} rx={2.5} width={5} x={28} y={22} />
      <Rect fill={detail} height={9} rx={3} width={6} x={21} y={31} />
    </Svg>
  );
}