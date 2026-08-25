import { useState } from "react";
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
import { CashRegisterIcon } from "../components/CashRegisterIcon";
import { TextField } from "../components/TextField";
import { TranslatedText as Text } from "../components/TranslatedText";
import { loginAccount, registerAccount } from "../data/cloudApi";
import { t } from "../i18n";
import {useThemedStyles,  colors, fonts, radius, shadow, space } from "../theme";

interface CloudAccountScreenProps {
  onDone: () => void;
}

export function CloudAccountScreen({ onDone }: CloudAccountScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const stacked = width < 860;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [shopName, setShopName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const u = username.trim();
    const p = password;
    if (u.length < 3) {
      setError("Le nom d’utilisateur doit contenir au moins 3 caractères.");
      return;
    }
    if (p.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (mode === "register") {
      if (shopName.trim().length < 2) {
        setError("Indiquez le nom de la boutique.");
        return;
      }
      if (p !== confirm) {
        setError("Les deux mots de passe sont différents.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await registerAccount(u, p, shopName.trim());
      } else {
        await loginAccount(u, p);
      }
      onDone();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Opération impossible.";
      if (message.includes("fetch") || message.includes("Network")) {
        setError(
          "Connexion impossible. Vérifiez Internet puis réessayez — le compte est requis la première fois.",
        );
      } else {
        setError(message);
      }
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
            <CashRegisterIcon
              color={colors.accentInk}
              detail={colors.inkSurfaceText}
              size={84}
            />
            <Text style={styles.brand}>MerchantHQ</Text>
            <Text style={styles.promise}>
              {t("Votre boutique sur toutes vos tablettes. Sauvegarde automatique chaque soir.")}
            </Text>
          </View>
          <View style={styles.offline}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineText}>{t("Compte marchand")}</Text>
          </View>
        </View>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.rightContent}
          keyboardShouldPersistTaps="handled"
          style={[styles.rightScroll, stacked && styles.rightScrollStacked]}
        >
          <View style={[styles.card, stacked && styles.cardStacked]}>
            <Text style={styles.title}>
              {mode === "login" ? "Se connecter" : "Créer un compte"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "login"
                ? "Entrez vos identifiants. Chaque compte possède sa propre boutique et sa sauvegarde."
                : "Un compte = une boutique. Vos données seront sauvegardées chaque soir."}
            </Text>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => {
                  setMode("login");
                  setError("");
                }}
                style={[styles.tab, mode === "login" && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
                  Se connecter
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode("register");
                  setError("");
                }}
                style={[styles.tab, mode === "register" && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
                  Créer un compte
                </Text>
              </Pressable>
            </View>

            <View style={styles.form}>
              {mode === "register" ? (
                <TextField
                  label="Nom de la boutique"
                  onChangeText={setShopName}
                  placeholder="Ex. Boutique de Kinshasa"
                  value={shopName}
                />
              ) : null}
              <TextField
                autoCapitalize="none"
                autoCorrect={false}
                label="Nom d’utilisateur"
                onChangeText={setUsername}
                placeholder="ex. marie.shop"
                value={username}
              />
              <TextField
                label="Mot de passe"
                onChangeText={setPassword}
                placeholder="8 caractères minimum"
                secureTextEntry
                value={password}
              />
              {mode === "register" ? (
                <TextField
                  label="Confirmer le mot de passe"
                  onChangeText={setConfirm}
                  placeholder="Retapez le mot de passe"
                  secureTextEntry
                  value={confirm}
                />
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AppButton
                fullWidth
                icon={mode === "login" ? "LogIn" : "ShieldCheck"}
                label={mode === "login" ? "Se connecter" : "Créer le compte"}
                loading={busy}
                onPress={() => void submit()}
              />
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
    backgroundColor: colors.ink,
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
    color: colors.accentInk,
    fontFamily: fonts.display,
    fontSize: 38,
    letterSpacing: -1,
  },
  promise: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 380,
    textAlign: "center",
  },
  offline: { alignItems: "center", flexDirection: "row", gap: space.xs },
  offlineDot: {
    backgroundColor: colors.successBright,
    borderRadius: radius.round,
    height: 9,
    width: 9,
  },
  offlineText: {
    color: colors.inkSurfaceText,
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
    maxWidth: 580,
    padding: space.xl,
    width: "100%",
  },
  cardStacked: { alignSelf: "center", margin: space.md, width: "92%" },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 29, letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: "row", gap: space.xs, marginTop: space.sm },
  tab: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    paddingVertical: space.sm,
  },
  tabActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tabText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14 },
  tabTextActive: { color: colors.accentDark },
  form: { gap: space.sm, marginTop: space.md },
  error: { color: colors.error, fontFamily: fonts.body, fontSize: 13 },
});
}