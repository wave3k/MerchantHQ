import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import Icon from "../components/Icon";
import { Page } from "../components/Page";
import { TranslatedText as Text } from "../components/TranslatedText";
import { formatCurrencyValue, getPrimaryCurrency } from "../domain/format";
import {
  evaluateExpression,
  marginRate,
  percentageOf,
  withDiscount,
  withTax,
} from "../domain/calculator";
import { useThemedStyles, colors, fonts, radius, space } from "../theme";

const keypad: Array<Array<{ label: string; value: string; kind?: "action" | "operator" | "equals" }>> = [
  [
    { label: "C", value: "clear", kind: "action" },
    { label: "⌫", value: "backspace", kind: "action" },
    { label: "%", value: "percent", kind: "operator" },
    { label: "÷", value: "/", kind: "operator" },
  ],
  [
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: "×", value: "*", kind: "operator" },
  ],
  [
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "−", value: "-", kind: "operator" },
  ],
  [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "+", value: "+", kind: "operator" },
  ],
  [
    { label: "0", value: "0" },
    { label: ".", value: "." },
    { label: "(", value: "(" },
    { label: ")", value: ")" },
  ],
  [
    { label: "=", value: "equals", kind: "equals" },
  ],
];

function numericValue(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CalculatorScreen() {
  const styles = useThemedStyles(createStyles);
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [percentageBase, setPercentageBase] = useState("100");
  const [percentageRate, setPercentageRate] = useState("10");
  const [taxBase, setTaxBase] = useState("100");
  const [taxRate, setTaxRate] = useState("16");
  const [discountBase, setDiscountBase] = useState("100");
  const [discountRate, setDiscountRate] = useState("10");
  const [cost, setCost] = useState("60");
  const [salePrice, setSalePrice] = useState("100");

  const primaryCurrency = getPrimaryCurrency();
  const formattedResult = useMemo(() => {
    if (!result) return "";
    return formatCurrencyValue(numericValue(result), primaryCurrency);
  }, [primaryCurrency, result]);

  function calculate() {
    try {
      const value = evaluateExpression(expression);
      setResult(String(Number(value.toFixed(10))));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calcul impossible");
    }
  }

  function press(value: string) {
    setError("");
    if (value === "clear") {
      setExpression("");
      setResult("");
      return;
    }
    if (value === "backspace") {
      setExpression((current) => current.slice(0, -1));
      return;
    }
    if (value === "percent") {
      try {
        const current = evaluateExpression(expression || "0");
        setExpression(String(current / 100));
      } catch {
        setError("Calculez d’abord une valeur valide");
      }
      return;
    }
    if (value === "equals") {
      calculate();
      return;
    }
    setExpression((current) => `${current}${value}`);
  }

  return (
    <Page
      description="Calculez rapidement un montant, une remise, une taxe ou une marge."
      title="Calculatrice"
    >
      <View style={styles.layout}>
        <View style={styles.calculatorCard}>
          <View style={styles.display}>
            <Text numberOfLines={1} style={styles.expression}>{expression || "0"}</Text>
            <Text numberOfLines={1} style={styles.result}>{formattedResult || "Prêt à calculer"}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <View style={styles.keypad}>
            {keypad.map((row, rowIndex) => (
              <View key={`key-row-${rowIndex}`} style={styles.keyRow}>
                {row.map((button) => (
                  <Pressable
                    accessibilityLabel={button.label}
                    accessibilityRole="button"
                    key={`${rowIndex}-${button.value}`}
                    onPress={() => press(button.value)}
                    style={({ pressed }) => [
                      styles.key,
                      button.kind === "equals" && styles.equalsKey,
                      button.kind === "operator" && styles.operatorKey,
                      button.kind === "action" && styles.actionKey,
                      pressed && styles.keyPressed,
                    ]}
                  >
                    <Text style={[
                      styles.keyText,
                      button.kind === "operator" && styles.operatorText,
                      button.kind === "action" && styles.actionText,
                      button.kind === "equals" && styles.equalsText,
                    ]}>{button.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.toolsColumn}>
          <Text style={styles.toolsTitle}>Calculs utiles</Text>
          <ToolCard
            firstLabel="Montant"
            firstValue={percentageBase}
            onFirstChange={setPercentageBase}
            secondLabel="Pourcentage"
            secondValue={percentageRate}
            onSecondChange={setPercentageRate}
            title="Pourcentage d’un montant"
            result={`${percentageOf(numericValue(percentageBase), numericValue(percentageRate))} ${primaryCurrency}`}
          />
          <ToolCard
            firstLabel="Montant"
            firstValue={taxBase}
            onFirstChange={setTaxBase}
            secondLabel="Taxe %"
            secondValue={taxRate}
            onSecondChange={setTaxRate}
            title="Ajouter une taxe"
            result={`${withTax(numericValue(taxBase), numericValue(taxRate)).toFixed(2)} ${primaryCurrency}`}
          />
          <ToolCard
            firstLabel="Prix"
            firstValue={discountBase}
            onFirstChange={setDiscountBase}
            secondLabel="Remise %"
            secondValue={discountRate}
            onSecondChange={setDiscountRate}
            title="Appliquer une remise"
            result={`${withDiscount(numericValue(discountBase), numericValue(discountRate)).toFixed(2)} ${primaryCurrency}`}
          />
          <ToolCard
            firstLabel="Coût"
            firstValue={cost}
            onFirstChange={setCost}
            secondLabel="Prix de vente"
            secondValue={salePrice}
            onSecondChange={setSalePrice}
            title="Marge commerciale"
            result={`${marginRate(numericValue(cost), numericValue(salePrice)).toFixed(2)} %`}
          />
        </View>
      </View>
    </Page>
  );
}

function ToolCard({
  title,
  firstLabel,
  firstValue,
  onFirstChange,
  secondLabel,
  secondValue,
  onSecondChange,
  result,
}: {
  title: string;
  firstLabel: string;
  firstValue: string;
  onFirstChange: (value: string) => void;
  secondLabel: string;
  secondValue: string;
  onSecondChange: (value: string) => void;
  result: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.toolCard}>
      <Text style={styles.toolTitle}>{title}</Text>
      <View style={styles.toolInputs}>
        <View style={styles.toolField}>
          <Text style={styles.fieldLabel}>{firstLabel}</Text>
          <TextInput accessibilityLabel={firstLabel} keyboardType="decimal-pad" onChangeText={onFirstChange} style={styles.toolInput} value={firstValue} />
        </View>
        <View style={styles.toolField}>
          <Text style={styles.fieldLabel}>{secondLabel}</Text>
          <TextInput accessibilityLabel={secondLabel} keyboardType="decimal-pad" onChangeText={onSecondChange} style={styles.toolInput} value={secondValue} />
        </View>
      </View>
      <View style={styles.toolResult}>
        <Icon color={colors.accent} name="Check" size={16} />
        <Text style={styles.toolResultText}>{result}</Text>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    layout: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
    calculatorCard: {
      backgroundColor: colors.surface,
      borderColor: colors.rule,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexBasis: 360,
      flexGrow: 1,
      maxWidth: 520,
      padding: space.md,
    },
    display: {
      backgroundColor: colors.panelInk,
      borderRadius: radius.md,
      minHeight: 104,
      padding: space.md,
    },
    expression: { color: colors.inkSurfaceText, fontFamily: fonts.mono, fontSize: 20, textAlign: "right" },
    result: { color: colors.onPanelInk, fontFamily: fonts.displayMedium, fontSize: 30, marginTop: space.sm, textAlign: "right" },
    error: { color: colors.error, fontFamily: fonts.body, fontSize: 12, marginTop: space.xs, textAlign: "right" },
    keypad: { gap: space.xs, marginTop: space.md },
    keyRow: { flexDirection: "row", gap: space.xs },
    key: { alignItems: "center", backgroundColor: colors.surfaceStrong, borderColor: colors.rule, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 54, justifyContent: "center" },
    keyPressed: { backgroundColor: colors.accentSoft, transform: [{ translateY: 1 }] },
    keyText: { color: colors.ink, fontFamily: fonts.displayMedium, fontSize: 20 },
    actionKey: { backgroundColor: colors.paper2 },
    actionText: { color: colors.error },
    operatorKey: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    operatorText: { color: colors.accent, fontSize: 22 },
    equalsKey: { backgroundColor: colors.accent, borderColor: colors.accent, flex: 1 },
    equalsText: { color: colors.accentInk },
    toolsColumn: { flexBasis: 360, flexGrow: 2, gap: space.sm, minWidth: 300 },
    toolsTitle: { color: colors.ink, fontFamily: fonts.displayMedium, fontSize: 20 },
    toolCard: { backgroundColor: colors.surface, borderColor: colors.rule, borderRadius: radius.md, borderWidth: 1, gap: space.sm, padding: space.sm },
    toolTitle: { color: colors.ink, fontFamily: fonts.bodySemibold, fontSize: 15 },
    toolInputs: { flexDirection: "row", gap: space.sm },
    toolField: { flex: 1, gap: space.xxs, minWidth: 0 },
    fieldLabel: { color: colors.muted, fontFamily: fonts.bodySemibold, fontSize: 11 },
    toolInput: { backgroundColor: colors.surfaceStrong, borderColor: colors.ruleStrong, borderRadius: radius.sm, borderWidth: 1, color: colors.ink, fontFamily: fonts.mono, fontSize: 15, minHeight: 40, paddingHorizontal: space.sm },
    toolResult: { alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: radius.sm, flexDirection: "row", gap: space.xs, minHeight: 38, paddingHorizontal: space.sm },
    toolResultText: { color: colors.accent, fontFamily: fonts.displayMedium, fontSize: 17 },
  });
}
