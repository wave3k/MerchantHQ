import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { AppButton } from "../components/AppButton";
import { AppLogoImage } from "../components/AppLogoImage";
import { OtpInput } from "../components/OtpInput";
import { TranslatedText as Text } from "../components/TranslatedText";
import { resendVerification, verifyEmail } from "../data/cloudApi";
import { getSession } from "../data/cloudSession";
import { useThemedStyles, colors, fonts, radius, shadow, space } from "../theme";

interface EmailVerificationScreenProps {
  email: string;
  onVerified: () => void;
  onLogout: () => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function EmailVerificationScreen({
  email,
  onVerified,
  onLogout,
}: EmailVerificationScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const stacked = width < 860;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<number>(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      const next = Math.max(0, cooldown - 1);
      cooldownRef.current = next;
      setCooldown(next);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function startCooldown(seconds: number) {
    cooldownRef.current = seconds;
    setCooldown(seconds);
  }

  async function submitVerify(fullCode: string) {
    if (!/^\d{6}$/.test(fullCode)) {
      setError("Saisissez le code à 6 chiffres reçu par e-mail.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const session = await getSession();
      if (!session) throw new Error("Session introuvable.");
      const result = await verifyEmail(session.accountId, fullCode);
      if (result.emailVerified) {
        onVerified();
      } else {
        setError("Le code n’a pas été accepté. Réessayez.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Vérification impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitResend() {
    setResending(true);
    setError("");
    setNotice("");
    try {
      const session = await getSession();
      if (!session) throw new Error("Session introuvable.");
      await resendVerification(session.accountId);
      setNotice("Un nouveau code vous a été envoyé par e-mail.");
      startCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Renvoi du code impossible.",
      );
      startCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setResending(false);
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
              Une dernière étape pour protéger votre compte.
            </Text>
          </View>
          <View style={styles.offline}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineText}>Vérification e-mail</Text>
          </View>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.rightContent}
          keyboardShouldPersistTaps="handled"
          style={[styles.rightScroll, stacked && styles.rightScrollStacked]}
        >
          <View style={[styles.card, stacked && styles.cardStacked]}>
            <Text style={styles.title}>Vérifiez votre adresse e-mail</Text>
            <Text style={styles.subtitle}>
              Un code à 6 chiffres vous a été envoyé à{" "}
              <Text style={styles.emailStrong}>{email}</Text>. Saisissez-le
              pour activer les sauvegardes et le cloud.
            </Text>

            <View style={styles.form}>
              <Text style={styles.codeLabel}>Code de vérification</Text>
              <OtpInput
                onChange={(value) => {
                  setCode(value);
                  setError("");
                }}
                onComplete={(value) => void submitVerify(value)}
                value={code}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <AppButton
                fullWidth
                icon="ShieldCheck"
                label="Vérifier mon adresse e-mail"
                loading={busy}
                onPress={() => void submitVerify(code)}
              />
              <Pressable
                accessibilityRole="button"
                disabled={resending || cooldown > 0}
                onPress={() => void submitResend()}
                style={[styles.resend, (resending || cooldown > 0) && styles.resendDisabled]}
              >
                <Text style={styles.resendText}>
                  {cooldown > 0
                    ? `Renvoyer le code (${cooldown}s)`
                    : resending
                      ? "Envoi…"
                      : "Renvoyer le code"}
                </Text>
              </Pressable>
              <View style={styles.logoutRow}>
                <Pressable accessibilityRole="button" onPress={onLogout}>
                  <Text style={styles.logoutText}>
                    Se déconnecter de ce compte
                  </Text>
                </Pressable>
              </View>
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
  emailStrong: { color: colors.ink, fontFamily: fonts.bodySemibold },
  form: { gap: space.sm, marginTop: space.md },
  codeLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: "center",
  },
  error: { color: colors.error, fontFamily: fonts.body, fontSize: 13 },
  notice: { color: colors.success, fontFamily: fonts.body, fontSize: 13 },
  resend: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  resendDisabled: { opacity: 0.5 },
  resendText: { color: colors.accent, fontFamily: fonts.bodySemibold, fontSize: 14 },
  logoutRow: { alignItems: "center", marginTop: space.sm },
  logoutText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textDecorationLine: "underline" },
  });
}