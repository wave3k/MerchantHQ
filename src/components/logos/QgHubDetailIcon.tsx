import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "../../theme";

export function QgHubDetailIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo QG Hub détaillé",
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
        d="M24 24 L11 11 M24 24 L37 11 M24 24 L11 37 M24 24 L37 37"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={3}
      />
      <Circle cx={24} cy={24} fill={color} r={11} />
      <Circle cx={24} cy={24} fill={detail} r={4.5} />
      <Circle cx={11} cy={11} fill={detail} r={4} />
      <Circle cx={37} cy={11} fill={detail} r={4} />
      <Circle cx={11} cy={37} fill={detail} r={4} />
      <Circle cx={37} cy={37} fill={detail} r={4} />
    </Svg>
  );
}