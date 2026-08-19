import Svg, { Path } from "react-native-svg";

import { colors } from "../../theme";

export function QgHubShieldIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo QG Hub Bouclier",
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
        d="M24 4 L8 12 v12 c0 10 16 18 16 18 c10 -8 16 -18 16 -18 V12 Z"
        fill={color}
      />
      <Path
        d="M24 10 L14 16 v8 c0 6 10 12 10 12 c6 -6 10 -12 10 -12 v-8 Z"
        fill={detail}
      />
      <Path
        d="M20 22 l3 3 6 -6"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}