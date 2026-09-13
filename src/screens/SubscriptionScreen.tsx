import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { AppButton } from "../components/AppButton";
import { AppLogoImage } from "../components/AppLogoImage";
import { TextField } from "../components/TextField";
import { TranslatedText as Text } from "../components/TranslatedText";
import { applySubscriptionCode } from "../data/cloudApi";
import { getSession } from "../data/cloudSession";
import { useThemedStyles, colors, fonts, radius, shadow, space } from "../theme";

interface SubscriptionScreenProps {
  onActivated: () => void;
  onLogout: () => void;
}

export function SubscriptionScreen({ onActivated, onLogout }: SubscriptionScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const stacked = width < 860;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 8) {
      setError("Saisissez le code d’abonnement complet.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await getSession();
      if (!session) throw new Error("Session introuvable.");
      await applySubscriptionCode(session.accountId, normalized);
      onActivated();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’activer l’abonnement.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={[styles.split, stacked && styles.splitStacked]}>
        <View style={[styles.brandPane, stacked && styles.brandPaneStacked]}>
          <View style={styles.brandCopy}>
            <AppLogoImage
              accessibilityLabel="MerchantHQ"
              size={84}
            />
            <Text style={styles.brand}>MerchantHQ</Text>
            <Text style={styles.promise}>
              Activez votre abonnement pour débloquer le cloud.
            </Text>
          </View>
          <View style={styles.offline}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineText}>Abonnement</Text>
          </View>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.rightContent}
          keyboardShouldPersistTaps="handled"
          style={[styles.rightScroll, stacked && styles.rightScrollStacked]}
        >
          <View style={[styles.card, stacked && styles.cardStacked]}>
            <Text style={styles.title}>Activez votre abonnement</Text>
            <Text style={styles.subtitle}>
              Votre compte ne possède pas encore d’abonnement actif. Saisissez
              le code reçu de votre administrateur pour continuer.
            </Text>

            <View style={styles.form}>
              <TextField
                autoCapitalize="characters"
                autoCorrect={false}
                label="Code d’abonnement"
                onChangeText={(value) => {
                  setCode(value.toUpperCase());
                  setError("");
                }}
                onSubmitEditing={() => void submit()}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={code}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AppButton
                fullWidth
                icon="ShieldCheck"
                label="Activer mon abonnement"
                loading={busy}
                onPress={() => void submit()}
              />
            </View>

            <View style={styles.logoutRow}>
              <Text onPress={onLogout} style={styles.logoutText}>
                Se déconnecter de ce compte
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles() {
  return StyleSheet.create({
  root: { backgroundColor: colors.paper, flex: 1 },
  split: { flex: 1, flexDirection: "row" },
  splitStacked: { flexDirection: "column" },
  brandPane: {
    alignSelf: "stretch",
    backgroundColor: colors.panelInk,
    flex: 1,
    padding: space.xxl,
  },
  brandPaneStacked: {
    alignSelf: "auto",
    flex: 0,
    gap: space.xl,
    minHeight: 250,
    padding: space.lg,
  },
  rightScroll: { alignSelf: "stretch", flex: 1.2 },
  rightScrollStacked: { alignSelf: "auto", flex: 1 },
  rightContent: { flexGrow: 1 },
  brandCopy: { alignItems: "center", flex: 1, gap: space.md, justifyContent: "center" },
  brand: {
    color: colors.onPanelInk,
    fontFamily: fonts.display,
    fontSize: 38,
    letterSpacing: -1,
  },
  promise: {
    color: colors.onPanelInk,
    fontFamily: fonts.body,
    fontSize: 19,
    lineHeight: 29,
    maxWidth: 380,
  },
  offline: { alignItems: "center", flexDirection: "row", gap: space.xs },
  offlineDot: {
    backgroundColor: colors.successBright,
    borderRadius: radius.round,
    height: 9,
    width: 9,
  },
  offlineText: {
    color: colors.onPanelInk,
    fontFamily: fonts.mono,
    fontSize: 12,
    textTransform: "uppercase",
  },
  card: {
    ...shadow,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.sm,
    margin: space.xxl,
    marginVertical: "auto",
    maxWidth: 520,
    padding: space.xl,
    width: "100%",
  },
  cardStacked: { alignSelf: "center", margin: space.md, width: "92%" },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 27,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  form: { gap: space.sm, marginTop: space.md },
  error: { color: colors.error, fontFamily: fonts.body, fontSize: 13 },
  logoutRow: { alignItems: "center", marginTop: space.lg },
  logoutText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  });
}