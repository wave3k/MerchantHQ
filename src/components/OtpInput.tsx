import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
}: OtpInputProps) {
  const styles = useThemedStyles(createStyles);
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function update(index: number, text: string) {
    const clean = text.replace(/\D/g, "");
    if (!clean) {
      // effacement : on vide la case et on revient en arrière
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      if (index > 0) refs.current[index - 1]?.focus();
      return;
    }
    const chars = clean.split("");
    let arr = value.split("");
    for (let i = 0; i < chars.length && index + i < length; i++) {
      arr[index + i] = chars[i] ?? "";
    }
    const next = arr.join("").slice(0, length);
    onChange(next);
    const target = index + chars.length;
    if (target < length) {
      refs.current[target]?.focus();
    } else if (next.length === length) {
      onComplete?.(next);
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          accessibilityLabel={`Chiffre ${index + 1} sur ${length}`}
          autoCapitalize="none"
          autoCorrect={false}
          caretHidden
          key={index}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(t) => update(index, t)}
          textContentType="oneTimeCode"
          onFocus={() => {
            // permet de modifier une case en tapant directement
            if (digits[index]) {
              const next = value.slice(0, index) + value.slice(index + 1);
              onChange(next);
            }
          }}
          onKeyPress={({ nativeEvent }) =>
            handleKeyPress(index, nativeEvent.key)
          }
          placeholder="·"
          placeholderTextColor={colors.faint}
          ref={(el) => {
            refs.current[index] = el;
          }}
          selectTextOnFocus={false}
          style={[styles.box, digit ? styles.boxFilled : null]}
          textAlign="center"
          value={digit}
        />
      ))}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "center",
  },
  box: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    display: "flex",
    fontFamily: fonts.mono,
    fontSize: 28,
    fontWeight: "700",
    height: 56,
    justifyContent: "center",
    lineHeight: 56,
    padding: 0,
    textAlign: "center",
    width: 48,
  },
  boxFilled: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
});
}