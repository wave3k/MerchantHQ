import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";

import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { t } from "../i18n";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  error,
  helper,
  containerStyle,
  style,
  ...props
}: TextFieldProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={styles.label}>{t(label)}</Text>
      <TextInput
        accessibilityLabel={t(label)}
        accessibilityState={{ disabled: props.editable === false }}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        {...props}
        placeholder={props.placeholder ? t(props.placeholder) : undefined}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.helper, error ? styles.error : null]}
      >
        {error ? t(error) : helper ? t(helper) : " "}
      </Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  wrapper: {
    alignSelf: "stretch",
    gap: space.xxs,
    minWidth: 0,
  },
  label: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  inputError: {
    borderColor: colors.error,
  },
  helper: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    minHeight: 18,
  },
  error: {
    color: colors.error,
  },
});
}
