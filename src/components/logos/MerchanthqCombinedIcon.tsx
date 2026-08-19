import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "../../theme";

export function MerchanthqCombinedIcon({
  size = 80,
  color = colors.accent,
  detail = colors.accentSoft,
  accessibilityLabel = "Logo MerchantHQ Combin\u00e9",
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
      <Rect fill={color} height={14} rx={4} width={18} x={4} y={22} />
      <Rect fill={detail} height={5} rx={2} width={12} x={7} y={25} />
      <Rect fill={colors.accentDark} height={18} rx={4} width={18} x={26} y={18} />
      <Rect fill={detail} height={4} rx={1} width={4} x={30} y={22} />
      <Rect fill={detail} height={4} rx={1} width={4} x={36} y={22} />
      <Rect fill={detail} height={6} rx={2} width={4} x={32} y={30} />
      <Path
        d="M13 22 v-8"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path d="M13 14 h6 l-2 3 2 3 h-6 z" fill={color} />
    </Svg>
  );
}