import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "../../theme";

export function QgHubPinIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo QG Hub Localisation",
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
        d="M24 4 C16 4 10 10.5 10 18.5 C10 29 24 44 24 44 C24 44 38 29 38 18.5 C38 10.5 32 4 24 4 z"
        fill={color}
      />
      <Circle cx={24} cy={18} fill={detail} r={7} />
      <Circle cx={24} cy={18} fill={color} r={3} />
    </Svg>
  );
}