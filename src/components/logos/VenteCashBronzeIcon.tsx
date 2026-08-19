import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";

import { colors } from "../../theme";

export function VenteCashBronzeIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo Vente Cash Bronze",
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
      <Circle cx={24} cy={24} fill={color} r={16} />
      <Circle cx={24} cy={24} fill={colors.accentDark} r={12} />
      <Circle
        cx={24}
        cy={24}
        fill="none"
        r={12}
        stroke={detail}
        strokeWidth={1}
      />
      <SvgText
        fill={detail}
        fontSize={18}
        fontWeight="bold"
        textAnchor="middle"
        x={24}
        y={30}
      >
        C
      </SvgText>
    </Svg>
  );
}