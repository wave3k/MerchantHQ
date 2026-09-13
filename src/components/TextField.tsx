import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { useState } from "react";

import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { t } from "../i18n";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

// Chaque clavier natif a son équivalent web : on déduit inputMode depuis
// keyboardType pour que les navigateurs affichent aussi le bon clavier.
function inputModeFor(keyboardType?: TextInputProps["keyboardType"]): TextInputProps["inputMode"] {
  switch (keyboardType) {
    case "number-pad":
    case "decimal-pad":
    case "numeric":
      return "decimal";
    case "phone-pad":
      return "tel";
    case "email-address":
      return "email";
    case "url":
      return "url";
    default:
      return undefined;
  }
}

export function TextField({
  label,
  error,
  helper,
  containerStyle,
  style,
  onFocus,
  onBlur,
  keyboardType,
  ...props
}: TextFieldProps) {
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={styles.label}>{t(label)}</Text>
      <TextInput
        accessibilityLabel={t(label)}
        accessibilityState={{ disabled: props.editable === false }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        style={[
          styles.input,
          focused && !error ? styles.inputFocused : null,
          error ? styles.inputError : null,
          style,
        ]}
        {...props}
        keyboardType={keyboardType}
        inputMode={inputModeFor(keyboardType)}
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
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  inputFocused: {
    borderColor: colors.accent,
    borderWidth: 1.5,
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
