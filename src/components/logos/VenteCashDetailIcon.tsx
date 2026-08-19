import Svg, { Circle, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function VenteCashDetailIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Vente Cash détaillé",
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
      <Circle cx={12} cy={7} fill={color} r={5} />
      <Circle cx={12} cy={7} fill={detail} r={2.5} />
      <Circle cx={38} cy={43} fill={color} r={5} />
      <Circle cx={38} cy={43} fill={detail} r={2.5} />
      <Rect fill={color} height={27} rx={8} width={32} x={8} y={12} />
      <Rect fill={detail} height={5} rx={2.5} width={24} x={12} y={17} />
      <Rect fill={detail} height={3.5} rx={1.75} width={24} x={12} y={30} />
    </Svg>
  );
}