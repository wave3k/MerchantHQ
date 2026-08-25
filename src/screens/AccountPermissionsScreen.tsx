import Icon from "../components/Icon";
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppButton } from "../components/AppButton";
import { Page } from "../components/Page";
import { TextField } from "../components/TextField";
import { createUser, listEmployees, listUsers, updateUserPermissions } from "../data/database";
import { validateAccountPassword } from "../domain/accounts";
import {
  accountRoleDescriptions,
  parsePermissions,
  permissionGroups,
  permissionsForRole,
  roleLabel,
} from "../domain/permissions";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type {
  Employee,
  Role,
  User,
  UserInput,
} from "../types";

interface AccountPermissionsScreenProps {
  db: SQLiteDatabase;
  user: User;
  initialUserId?: number;
  initialEmployeeId?: number;
  onDone: () => void;
}

const accountRoles: Exclude<Role, "boss">[] = [
  "manager",
  "cashier",
  "employee",
];

export function AccountPermissionsScreen({
  db,
  user,
  initialUserId,
  initialEmployeeId,
  onDone,
}: AccountPermissionsScreenProps) {
  const styles = useThemedStyles(createStyles);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [employeeId, setEmployeeId] = useState<number>(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Exclude<Role, "boss">>("employee");
  const [customPermissions, setCustomPermissions] = useState<Set<string> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [nextEmployees, nextUsers] = await Promise.all([
        listEmployees(db, true),
        listUsers(db, true),
      ]);
      setEmployees(nextEmployees);
      setUsers(nextUsers);
      if (initialUserId) {
        const target = nextUsers.find((entry) => entry.id === initialUserId);
        if (target) {
          setEditingUser(target);
          setEmployeeId(target.employee_id ?? 0);
          setRole(target.role === "boss" ? "employee" : target.role);
          const custom = parsePermissions(target.permissions);
          setCustomPermissions(custom ? new Set(custom) : null);
        }
      } else {
        const first = nextEmployees.find(
          (employee) => employee.is_active === 1 && !employee.has_account,
        );
        setEmployeeId(initialEmployeeId ?? first?.id ?? 0);
      }
    })();
  }, [db, initialUserId, initialEmployeeId]);

  const availableForAccount = useMemo(
    () =>
      employees.filter(
        (employee) => employee.is_active === 1 && !employee.has_account,
      ),
    [employees],
  );

  const selectedPermissions = useMemo(() => {
    if (customPermissions) return customPermissions;
    return new Set(permissionsForRole(role));
  }, [customPermissions, role]);

  function pickRole(nextRole: Exclude<Role, "boss">) {
    setRole(nextRole);
    setCustomPermissions(null);
  }

  function togglePermission(key: string) {
    setCustomPermissions((current) => {
      const base = current ?? new Set(permissionsForRole(role));
      const next = new Set(base);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function submit() {
    if (editingUser) {
      setBusy(true);
      setError("");
      try {
        await updateUserPermissions(
          db,
          editingUser.id,
          JSON.stringify([...selectedPermissions]),
          user,
        );
        onDone();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Les permissions n’ont pas pu être enregistrées.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!employeeId) {
      setError("Choisissez l’employé qui utilisera ce compte.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Le nom de connexion doit contenir au moins 3 caractères.");
      return;
    }
    const passwordError = validateAccountPassword(role, password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    const input: UserInput = {
      employeeId,
      username,
      role,
      password,
      permissions: JSON.stringify([...selectedPermissions]),
    };
    setBusy(true);
    setError("");
    try {
      await createUser(db, input, user);
      onDone();
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

  const defaults = permissionsForRole(role);
  const customDirty =
    customPermissions !== null &&
    !(
      [...defaults].every((key) => customPermissions.has(key)) &&
      defaults.size === customPermissions.size
    );

  return (
    <Page
      action={
        <AppButton
          icon="ArrowLeft"
          label="Retour"
          onPress={onDone}
          tone="secondary"
        />
      }
      description={
        editingUser
          ? `Compte @${editingUser.username} · ${roleLabel[editingUser.role]}`
          : "Choisissez le type de compte, puis ajustez les permissions si besoin."
      }
      title={editingUser ? editingUser.name : "Créer un compte"}
    >
      {!editingUser ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employé</Text>
            <Text style={styles.sectionDescription}>
              Le compte sera lié à une fiche employé existante sans compte.
            </Text>
            {availableForAccount.length === 0 ? (
              <View style={styles.emptyNote}>
                <Icon
                  name="UserPlus"
                  size={20}
                  color={colors.muted}
                />
                <Text style={styles.emptyNoteText}>
                  Ajoutez d’abord un employé sans compte depuis la page Employés.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={styles.choices}
                showsHorizontalScrollIndicator={false}
              >
                {availableForAccount.map((employee) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: employeeId === employee.id }}
                    key={employee.id}
                    onPress={() => setEmployeeId(employee.id)}
                    style={[
                      styles.choice,
                      employeeId === employee.id && styles.choiceActive,
                    ]}
                  >
                    <Icon
                      name="User"
                      size={19}
                      color={
                        employeeId === employee.id ? colors.accent : colors.muted
                      }
                    />
                    <Text numberOfLines={1} style={styles.choiceText}>
                      {employee.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={styles.fields}>
              <TextField
                autoCapitalize="none"
                autoCorrect={false}
                label="Nom de connexion"
                onChangeText={setUsername}
                placeholder="patrick"
                value={username}
              />
              <TextField
                error={error || undefined}
                label={
                  role === "manager"
                    ? "Code secret"
                    : "Code secret (facultatif)"
                }
                onChangeText={setPassword}
                placeholder={
                  role === "manager"
                    ? "4 caractères minimum"
                    : "Laisser vide pour un accès direct"
                }
                secureTextEntry
                value={password}
              />
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type de compte</Text>
        <Text style={styles.sectionDescription}>
          Chaque type possède des permissions par défaut, que vous pouvez
          ensuite personnaliser ci-dessous.
        </Text>
        <View style={styles.roleGrid}>
          {accountRoles.map((nextRole) => {
            const active = role === nextRole;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                key={nextRole}
                onPress={() => pickRole(nextRole)}
                style={[
                  styles.roleCard,
                  active && styles.roleCardActive,
                ]}
              >
                <View style={styles.roleHeading}>
                  <Icon
                    name={
                      nextRole === "manager"
                        ? "UserCog"
                        : nextRole === "cashier"
                          ? "Banknote"
                          : "User"
                    }
                    size={22}
                    color={active ? colors.accent : colors.ink2}
                  />
                  <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>
                    {roleLabel[nextRole]}
                  </Text>
                  {active ? (
                    <Icon
                      name="CircleCheck"
                      size={20}
                      color={colors.accent}
                    />
                  ) : null}
                </View>
                <Text style={styles.roleDescription}>
                  {accountRoleDescriptions[nextRole]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.permissionsHeading}>
          <View style={styles.permissionsCopy}>
            <Text style={styles.sectionTitle}>Permissions personnalisées</Text>
            <Text style={styles.sectionDescription}>
              Cochez ou décochez les accès pour ce compte.
            </Text>
          </View>
          {customDirty ? (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>Personnalisé</Text>
            </View>
          ) : null}
        </View>
        {permissionGroups.map((group) => {
          const checkedCount = group.permissions.filter((item) =>
            selectedPermissions.has(item.key),
          ).length;
          const allChecked = checkedCount === group.permissions.length;
          return (
            <View key={group.title} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allChecked }}
                  onPress={() => {
                    setCustomPermissions((current) => {
                      const base =
                        current ?? new Set(permissionsForRole(role));
                      const next = new Set(base);
                      for (const item of group.permissions) {
                        if (allChecked) {
                          next.delete(item.key);
                        } else {
                          next.add(item.key);
                        }
                      }
                      return next;
                    });
                  }}
                  style={styles.groupToggle}
                >
                  <Text style={styles.groupToggleText}>
                    {allChecked ? "Tout décocher" : "Tout cocher"}
                  </Text>
                  <Icon
                    name={allChecked ? "SquareCheck" : "Square"}
                    size={18}
                    color={allChecked ? colors.accent : colors.muted}
                  />
                </Pressable>
              </View>
              {group.permissions.map((item) => {
                const checked = selectedPermissions.has(item.key);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    key={item.key}
                    onPress={() => togglePermission(item.key)}
                    style={[
                      styles.permissionRow,
                      checked && styles.permissionRowChecked,
                    ]}
                  >
                    <Icon
                      name={checked ? "SquareCheck" : "Square"}
                      size={20}
                      color={checked ? colors.accent : colors.muted}
                    />
                    <Text
                      style={[
                        styles.permissionLabel,
                        checked && styles.permissionLabelChecked,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          fullWidth
          icon={editingUser ? "Save" : "Key"}
          label={editingUser ? "Enregistrer les permissions" : "Créer le compte"}
          loading={busy}
          onPress={() => void submit()}
        />
      </View>
    </Page>
  );
}

function createStyles() {
  return StyleSheet.create({
  section: {
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.md,
    paddingBottom: space.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 19,
  },
  sectionDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  choices: {
    gap: space.xs,
    paddingBottom: space.xxs,
  },
  choice: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: space.sm,
  },
  choiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  emptyNote: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
  },
  emptyNoteText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  fields: {
    gap: space.md,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  roleCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 250,
    flexDirection: "column",
    flexGrow: 1,
    gap: space.xs,
    minHeight: 108,
    padding: space.md,
  },
  roleCardActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  roleHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  roleTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
  },
  roleTitleActive: {
    color: colors.accentDark,
  },
  roleDescription: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionsHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  permissionsCopy: {
    flex: 1,
    gap: space.xxs,
    minWidth: 0,
  },
  customBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.round,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  customBadgeText: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    textTransform: "uppercase",
  },
  group: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  groupHeader: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: space.md,
  },
  groupTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  groupToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.xs,
  },
  groupToggleText: {
    color: colors.accentDark,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  permissionRow: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  permissionRowChecked: {
    backgroundColor: colors.accentSoft,
  },
  permissionLabel: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  permissionLabelChecked: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  footer: {
    gap: space.md,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
}