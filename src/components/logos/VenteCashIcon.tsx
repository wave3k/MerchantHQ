import Svg, { Circle, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function VenteCashIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Vente Cash",
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
      <Rect fill={color} height={30} rx={9} width={30} x={9} y={9} />
      <Circle cx={24} cy={24} fill={detail} r={10} />
      <Circle cx={24} cy={24} fill={color} r={4.5} />
    </Svg>
  );
}