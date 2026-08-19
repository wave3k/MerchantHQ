import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function MerchanthqEmblemIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo MerchantHQ Embl\u00e8me",
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
      <Circle cx={24} cy={24} fill={color} r={20} />
      <Circle cx={24} cy={24} fill={colors.accentDark} r={16} />
      <Rect fill={detail} height={10} rx={3} width={12} x={12} y={16} />
      <Rect
        fill={color}
        height={3}
        opacity={0.5}
        rx={1}
        width={6}
        x={15}
        y={19}
      />
      <Rect fill={detail} height={14} rx={3} width={10} x={26} y={18} />
      <Rect
        fill={color}
        height={3}
        opacity={0.5}
        rx={1}
        width={3}
        x={29}
        y={21}
      />
      <Rect
        fill={color}
        height={3}
        opacity={0.5}
        rx={1}
        width={3}
        x={33}
        y={21}
      />
      <Rect
        fill={color}
        height={5}
        opacity={0.5}
        rx={2}
        width={4}
        x={30}
        y={27}
      />
      <Path
        d="M18 16 v-5"
        fill="none"
        stroke={detail}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M18 11 h4 l-1.5 2 1.5 2 h-4 z" fill={detail} />
    </Svg>
  );
}