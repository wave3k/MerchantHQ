import * as SecureStore from "../data/secureStore";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "../components/Icon";
import { useEffect, useState } from "react";

import { AppButton } from "../components/AppButton";
import { TextField } from "../components/TextField";
import {
  changeBossPassword,
  createBoss,
  hasUsers,
  listUsers,
  login,
  resetBossPassword,
  verifyBossPassword,
} from "../data/database";
import { ensureBundledCloudBackupConfig } from "../data/cloudBackup";
import { pushOwnerAccount, syncOwnerAccount } from "../data/accountSync";
import { roleLabel } from "../domain/permissions";
import { colors, fonts, radius, shadow, space } from "../theme";
import type { User } from "../types";
import { t } from "../i18n";
import { CashRegisterIcon } from "../components/CashRegisterIcon";
import { TranslatedText as Text } from "../components/TranslatedText";

interface AuthScreenProps {
  db: SQLiteDatabase;
  onAuthenticated: (user: User) => void;
}

export function AuthScreen({ db, onAuthenticated }: AuthScreenProps) {
  const { width } = useWindowDimensions();
  const stacked = width < 860;
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("boss");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [versionTaps, setVersionTaps] = useState(0);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [developerError, setDeveloperError] = useState("");
  const selectedUser = users.find((user) => user.id === selected) ?? null;

  useEffect(() => {
    void (async () => {
      await ensureBundledCloudBackupConfig();
      let exists = await hasUsers(db);
      if (exists) {
        void syncOwnerAccount(db, { attempts: 1, timeoutMs: 3_000 }).catch(
          () => undefined,
        );
      } else {
        try {
          await syncOwnerAccount(db, { attempts: 1, timeoutMs: 3_000 });
          exists = await hasUsers(db);
        } catch {
          // Une première installation hors ligne pourra créer le compte propriétaire.
        }
      }
      setSetup(!exists);
      if (exists) {
        const available = await listUsers(db);
        setUsers(available);
        const stored = await SecureStore.getItemAsync("last_user_id");
        const storedId = stored ? Number.parseInt(stored, 10) : null;
        setSelected(
          available.some((user) => user.id === storedId)
            ? storedId
            : available[0]?.id ?? null,
        );
      }
      setLoading(false);
    })();
  }, [db]);

  useEffect(() => {
    if (!developerOpen) return;
    const timeout = setTimeout(() => {
      setDeveloperOpen(false);
      setDeveloperUnlocked(false);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    }, 5 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [developerOpen]);

  async function submitLogin() {
    if (!selected) {
      setError("Sélectionnez un compte pour continuer.");
      return;
    }
    if (selectedUser?.has_password && !password) {
      setError("Saisissez le code secret de ce compte.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await login(db, selected, password);
      if (!user) {
        setError("Mot de passe incorrect. Vérifiez le code puis réessayez.");
        return;
      }
      await SecureStore.setItemAsync("last_user_id", String(user.id));
      setPassword("");
      onAuthenticated(user);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La connexion n’a pas pu être effectuée.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitSetup() {
    if (name.trim().length < 2) {
      setError("Indiquez le nom du propriétaire.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Le nom de connexion doit contenir au moins 3 caractères.");
      return;
    }
    if (password.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const boss = await createBoss(db, name, username, password);
      void pushOwnerAccount(db).catch(() => {
        // Le compte sera envoyé dès que Turso redeviendra joignable.
      });
      await SecureStore.setItemAsync("last_user_id", String(boss.id));
      onAuthenticated(boss);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Le compte Propriétaire n’a pas pu être créé.";
      setError(message);
      Alert.alert("Création impossible", message);
    } finally {
      setBusy(false);
    }
  }

  // unused, developer unlocks instantly now
  async function unlockDeveloper() {
    setDeveloperUnlocked(true);
  }

  async function updateOwnerPassword() {
    if (nextPassword !== confirmPassword) {
      setDeveloperError("Les deux nouveaux mots de passe sont différents.");
      return;
    }
    if (nextPassword.length < 4) {
      setDeveloperError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    setBusy(true);
    setDeveloperError("");
    try {
      await resetBossPassword(db, nextPassword);
      let synced = true;
      try {
        await pushOwnerAccount(db);
      } catch {
        synced = false;
      }
      Alert.alert(
        "Mot de passe réinitialisé",
        synced
          ? "Le compte propriétaire a aussi été mis à jour dans Turso."
          : "Le mot de passe est enregistré sur la tablette. Turso sera mis à jour dès le retour d’Internet.",
      );
      setDeveloperOpen(false);
      setDeveloperUnlocked(false);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    } catch (caught) {
      setDeveloperError(
        caught instanceof Error
          ? caught.message
          : "Le mot de passe n’a pas été modifié.",
      );
    } finally {
      setBusy(false);
    }
  }

  function closeDeveloper() {
    setDeveloperOpen(false);
    setDeveloperUnlocked(false);
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setDeveloperError("");
    setVersionTaps(0);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Ouverture de la boutique…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.scroll, stacked && styles.scrollStacked]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.brandPane, stacked && styles.brandPaneStacked]}>
          <View style={styles.brandCopy}>
            <CashRegisterIcon
              color={colors.accentInk}
              detail={colors.inkSurfaceText}
              size={84}
            />
            <Text style={styles.brand}>Commerce Manager</Text>
            <Text style={styles.promise}>
              {t("La caisse, les produits et les clients au même endroit.")}
            </Text>
          </View>
          <View style={styles.offline}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineText}>{t("Fonctionne sans Internet")}</Text>
          </View>
        </View>

        <View style={[styles.rightPane, stacked && styles.rightPaneStacked]}>
          <View style={[styles.card, stacked && styles.cardStacked]}>
            {developerOpen ? (
            <>
              <View style={styles.developerHeading}>
                <View style={styles.developerMark}>
                  <Icon name="Wrench" size={22} color={colors.accent} />
                </View>
                <View style={styles.developerCopy}>
                  <Text style={styles.title}>{t("Accès développeur")}</Text>
                  <Text style={styles.subtitle}>
                    Cette session se ferme automatiquement après 5 minutes.
                  </Text>
                </View>
              </View>
              <View style={styles.form}>
                <TextField
                  label="Nouveau mot de passe Propriétaire"
                  onChangeText={setNextPassword}
                  placeholder="4 caractères minimum"
                  secureTextEntry
                  value={nextPassword}
                />
                <TextField
                  error={developerError || undefined}
                  label="Confirmer le nouveau mot de passe"
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  value={confirmPassword}
                />
                <AppButton
                  fullWidth
                  icon="ShieldCheck"
                  label="Réinitialiser le mot de passe"
                  loading={busy}
                  onPress={() => void updateOwnerPassword()}
                />
                <AppButton
                  fullWidth
                  icon="LogOut"
                  label="Quitter le mode développeur"
                  onPress={closeDeveloper}
                  tone="secondary"
                />
              </View>
            </>
          ) : (
            <>
          <Text style={styles.title}>
            {t(setup ? "Créer le compte Propriétaire" : "Ouvrir une session")}
          </Text>
          <Text style={styles.subtitle}>
            {setup
              ? t("Ce premier compte pourra tout gérer dans la boutique.")
              : t("Choisissez votre nom, puis entrez votre code si nécessaire.")}
          </Text>

          {setup ? (
            <View style={styles.form}>
              <TextField
                autoCapitalize="words"
                label="Nom du propriétaire"
                onChangeText={setName}
                placeholder="Ex. Marie Ilunga"
                value={name}
              />
              <TextField
                autoCapitalize="none"
                autoCorrect={false}
                label="Nom de connexion"
                onChangeText={setUsername}
                placeholder="boss"
                value={username}
              />
              <TextField
                label="Mot de passe Propriétaire"
                onChangeText={setPassword}
                onSubmitEditing={() => void submitSetup()}
                placeholder="4 caractères minimum"
                secureTextEntry
                value={password}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AppButton
                fullWidth
                icon="ShieldCheck"
                label="Créer le compte Propriétaire"
                loading={busy}
                onPress={() => void submitSetup()}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>{t("Compte")}</Text>
              <View style={styles.userGrid}>
                {users.map((user) => {
                  const isSelected = selected === user.id;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      key={user.id}
                      onPress={() => {
                        setSelected(user.id);
                        setPassword("");
                        setError("");
                      }}
                      style={({ pressed }) => [
                        styles.userCard,
                        isSelected && styles.userCardSelected,
                        pressed && styles.userCardPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.avatar,
                          isSelected && styles.avatarSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            isSelected && styles.avatarTextSelected,
                          ]}
                        >
                          {user.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userCopy}>
                        <Text numberOfLines={1} style={styles.userName}>
                          {user.name}
                        </Text>
                        <Text style={styles.userRole}>{roleLabel[user.role]}</Text>
                      </View>
                      {isSelected ? (
                        <Icon
                          name="CircleCheck"
                          size={22}
                          color={colors.accent}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {selectedUser?.has_password ? (
                <TextField
                  error={error || undefined}
                  label="Code secret"
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  onSubmitEditing={() => void submitLogin()}
                  placeholder="Saisissez votre code"
                  secureTextEntry
                  value={password}
                />
              ) : (
                <View style={styles.noCode}>
                  <Icon
                    name="Zap"
                    size={20}
                    color={colors.success}
                  />
                  <View style={styles.noCodeCopy}>
                    <Text style={styles.noCodeTitle}>{t("Accès direct")}</Text>
                    <Text style={styles.noCodeText}>
                      {t("Ce compte n’a pas de code secret.")}
                    </Text>
                  </View>
                </View>
              )}
              {error && !selectedUser?.has_password ? (
                <Text style={styles.error}>{error}</Text>
              ) : null}
              <AppButton
                fullWidth
                icon="LogIn"
                label={selectedUser?.has_password ? "Se connecter" : "Ouvrir la caisse"}
                loading={busy}
                onPress={() => void submitLogin()}
              />
            </View>
          )}
            </>
          )}

          {!setup && !developerOpen ? (
            <Pressable
              accessibilityLabel="Version de l’application"
              delayLongPress={1800}
              onLongPress={() => {
                if (versionTaps >= 7) setDeveloperOpen(true);
              }}
              onPress={() =>
                setVersionTaps((value) => (value >= 7 ? 7 : value + 1))
              }
              style={styles.version}
            >
              <Text style={styles.versionText}>Version 0.1.0</Text>
            </Pressable>
          ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.paper,
    flex: 1,
  },
  scroll: {
    alignItems: "stretch",
    flexDirection: "row",
    flexGrow: 1,
    minHeight: 620,
  },
  scrollStacked: {
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  brandPane: {
    backgroundColor: colors.ink,
    flex: 1,
    padding: space.xxl,
  },
  rightPane: {
    flex: 1.2,
    justifyContent: "center",
  },
  rightPaneStacked: {
    flex: 0,
  },
  brandPaneStacked: {
    flex: 0,
    gap: space.xl,
    minHeight: 250,
    padding: space.lg,
  },
  brandCopy: {
    alignItems: "center",
    flex: 1,
    gap: space.md,
    justifyContent: "center",
  },
  brand: {
    color: colors.accentInk,
    fontFamily: fonts.display,
    fontSize: 38,
    letterSpacing: -1,
  },
  promise: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.body,
    fontSize: 19,
    lineHeight: 29,
    maxWidth: 380,
  },
  offline: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
  },
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
    maxWidth: 580,
    padding: space.xl,
    width: "100%",
  },
  cardStacked: {
    alignSelf: "center",
    margin: space.md,
    width: "92%",
  },
  developerHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  developerMark: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  developerCopy: {
    flex: 1,
    gap: space.xxs,
  },
  version: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingTop: space.sm,
  },
  versionText: {
    color: colors.faint,
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 29,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    gap: space.sm,
    marginTop: space.md,
  },
  noCode: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 64,
    paddingHorizontal: space.md,
  },
  noCodeCopy: {
    flex: 1,
    gap: space.xxs,
  },
  noCodeTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  noCodeText: {
    color: colors.ink2,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  fieldLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  userGrid: {
    gap: space.xs,
  },
  userCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 64,
    padding: space.xs,
  },
  userCardSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  userCardPressed: {
    opacity: 0.78,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarSelected: {
    backgroundColor: colors.accent,
  },
  avatarText: {
    color: colors.ink2,
    fontFamily: fonts.display,
    fontSize: 19,
  },
  avatarTextSelected: {
    color: colors.accentInk,
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  userRole: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    gap: space.md,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});
