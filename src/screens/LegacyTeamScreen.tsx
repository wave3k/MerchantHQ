import type { SQLiteDatabase } from "expo-sqlite";
// Ancien écran conservé pour référence pendant la migration Employés / Comptes.
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Icon from "../components/Icon";
import { useEffect, useState } from "react";

import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page } from "../components/Page";
import { TextField } from "../components/TextField";
import {
  createUser,
  deactivateUser,
  listUsers,
} from "../data/database";
import { formatDate } from "../domain/format";
import { roleLabel } from "../domain/permissions";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { Role, User, UserInput } from "../types";

interface TeamScreenProps {
  db: SQLiteDatabase;
  user: User;
}

type LegacyUserInput = UserInput & { name: string };

const emptyDraft: LegacyUserInput = {
  employeeId: 0,
  name: "",
  username: "",
  role: "employee",
  password: "",
};

export function LegacyTeamScreen({ db, user }: TeamScreenProps) {
  const styles = useThemedStyles(createStyles);
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [draft, setDraft] = useState<LegacyUserInput>(emptyDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setUsers(await listUsers(db, true));
  }

  useEffect(() => {
    void load();
  }, [db]);

  function openCreate() {
    setSelected(null);
    setDraft(emptyDraft);
    setError("");
    setOpen(true);
  }

  function openDetails(member: User) {
    setSelected(member);
    setOpen(true);
  }

  async function submit() {
    if (draft.name.trim().length < 2) {
      setError("Indiquez le nom complet de l’utilisateur.");
      return;
    }
    if (draft.username.trim().length < 3) {
      setError("L’identifiant doit contenir au moins 3 caractères.");
      return;
    }
    if (draft.password.length < 4) {
      setError("Le code secret doit contenir au moins 4 caractères.");
      return;
    }
    setBusy(true);
    try {
      await createUser(db, draft, user);
      setOpen(false);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Le compte n’a pas pu être créé.",
      );
    } finally {
      setBusy(false);
    }
  }

  function requestDeactivate() {
    if (!selected) return;
    Alert.alert(
      "Désactiver ce compte ?",
      `${selected.name} ne pourra plus se connecter. Son historique restera dans les commandes et les logs.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deactivateUser(db, selected, user);
                setOpen(false);
                await load();
              } catch (caught) {
                Alert.alert(
                  "Désactivation impossible",
                  caught instanceof Error
                    ? caught.message
                    : "Le compte n’a pas été désactivé.",
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  const activeCount = users.filter((member) => member.is_active).length;

  return (
    <Page
      action={
        <AppButton
          icon="UserPlus"
          label="Créer un compte"
          onPress={openCreate}
        />
      }
      description={`${activeCount} compte(s) actif(s). Le Propriétaire contrôle les accès et les rôles.`}
      title="Équipe"
    >
      {users.length === 0 ? (
        <EmptyState
          icon="Users"
          message="Créez les comptes des personnes autorisées à utiliser la caisse."
          title="Aucun membre"
        />
      ) : (
        <View style={styles.grid}>
          {users.map((member) => (
            <Pressable
              key={member.id}
              onPress={() => openDetails(member)}
              style={({ pressed }) => [
                styles.card,
                !member.is_active && styles.cardInactive,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.top}>
                <View
                  style={[
                    styles.avatar,
                    member.role === "boss" && styles.avatarBoss,
                  ]}
                >
                  <Icon
                    name={
                      member.role === "boss"
                        ? "ShieldCheck"
                        : member.role === "manager"
                          ? "UserCog"
                          : "User"
                    }
                    size={23}
                    color={
                      member.role === "boss" ? colors.accentInk : colors.accent
                    }
                  />
                </View>
                <Badge
                  label={member.is_active ? "Actif" : "Désactivé"}
                  tone={member.is_active ? "success" : "neutral"}
                />
              </View>
              <View>
                <Text numberOfLines={1} style={styles.name}>
                  {member.name}
                </Text>
                <Text style={styles.username}>@{member.username}</Text>
              </View>
              <View style={styles.footer}>
                <Badge
                  label={roleLabel[member.role]}
                  tone={member.role === "boss" ? "accent" : "neutral"}
                />
                <Text style={styles.created}>Depuis le {formatDate(member.created_at)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <ModalSheet
        onClose={() => setOpen(false)}
        subtitle={
          selected
            ? `Identifiant : @${selected.username}`
            : "Le rôle détermine les écrans et les actions disponibles."
        }
        title={selected ? selected.name : "Nouveau compte"}
        visible={open}
        width={520}
      >
        {selected ? (
          <>
            <View style={styles.permissionBlock}>
              <Text style={styles.permissionTitle}>
                Accès {roleLabel[selected.role]}
              </Text>
              <Text style={styles.permissionText}>
                {selected.role === "boss"
                  ? "Accès complet : caisse, stock, clients, équipe, logs, paramètres et sauvegardes."
                  : selected.role === "manager"
                    ? "Caisse, produits, stock, clients, statistiques et logs. Aucun accès aux comptes ni aux sauvegardes."
                    : "Caisse, consultation des produits et création de clients. Aucun changement manuel du stock."}
              </Text>
            </View>
            {selected.role !== "boss" && selected.is_active ? (
              <AppButton
                fullWidth
                icon="UserMinus"
                label="Désactiver le compte"
                loading={busy}
                onPress={requestDeactivate}
                tone="danger"
              />
            ) : null}
          </>
        ) : (
          <>
            <TextField
              label="Nom complet"
              onChangeText={(name) => setDraft((value) => ({ ...value, name }))}
              placeholder="Ex. Patrick Mbala"
              value={draft.name}
            />
            <TextField
              autoCapitalize="none"
              autoCorrect={false}
              label="Identifiant"
              onChangeText={(username) =>
                setDraft((value) => ({ ...value, username }))
              }
              placeholder="patrick"
              value={draft.username}
            />
            <Text style={styles.formLabel}>Rôle</Text>
            <View style={styles.roles}>
              {(["manager", "employee"] as const).map((role) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: draft.role === role }}
                  key={role}
                  onPress={() => setDraft((value) => ({ ...value, role }))}
                  style={[
                    styles.roleChoice,
                    draft.role === role && styles.roleChoiceActive,
                  ]}
                >
                  <Icon
                    name={role === "manager" ? "UserCog" : "User"}
                    size={22}
                    color={draft.role === role ? colors.accent : colors.ink2}
                  />
                  <View>
                    <Text style={styles.roleTitle}>{roleLabel[role as Role]}</Text>
                    <Text style={styles.roleDescription}>
                      {role === "manager"
                        ? "Gère le stock et voit les logs"
                        : "Encaisse et crée des clients"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <TextField
              error={error || undefined}
              label="Code secret"
              onChangeText={(password) =>
                setDraft((value) => ({ ...value, password }))
              }
              placeholder="4 caractères minimum"
              secureTextEntry
              value={draft.password}
            />
            <AppButton
              fullWidth
              icon="UserPlus"
              label="Créer le compte"
              loading={busy}
              onPress={() => void submit()}
            />
          </>
        )}
      </ModalSheet>
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  card: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
    minWidth: 275,
    padding: space.md,
    width: "32%",
  },
  cardInactive: {
    opacity: 0.58,
  },
  cardPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  top: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarBoss: {
    backgroundColor: colors.accent,
  },
  name: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  username: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    marginTop: space.xxs,
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: space.sm,
  },
  created: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  permissionBlock: {
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    gap: space.xs,
    padding: space.md,
  },
  permissionTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 17,
  },
  permissionText: {
    color: colors.ink2,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  formLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  roles: {
    flexDirection: "row",
    gap: space.sm,
  },
  roleChoice: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 70,
    padding: space.sm,
  },
  roleChoiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  roleTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  roleDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: space.xxs,
  },
});
}
