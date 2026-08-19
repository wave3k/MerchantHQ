import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "../../theme";

export function QgHubStarIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo QG Hub \u00c9toile",
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
        d="M24 4 l5.5 11.2 12.3 1.8 -8.9 8.7 2.1 12.3 L24 31.4 13 28 l2.1 -12.3 -8.9 -8.7 12.3 -1.8 z"
        fill={color}
      />
      <Circle cx={24} cy={21} fill={detail} r={6} />
      <Path
        d="M21 21 l2 2 4 -4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}