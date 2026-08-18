import Icon from "../components/Icon";
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page } from "../components/Page";
import { TextField } from "../components/TextField";
import {
  createUser,
  deactivateEmployee,
  deactivateUser,
  listEmployees,
  listUsers,
  saveEmployee,
} from "../data/database";
import { formatDate, formatMoney } from "../domain/format";
import { validateAccountPassword } from "../domain/accounts";
import { roleLabel } from "../domain/permissions";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type {
  Employee,
  EmployeeInput,
  Role,
  ScreenKey,
  User,
  UserInput,
} from "../types";

interface EmployeesScreenProps {
  db: SQLiteDatabase;
  user: User;
  onNavigate: (
    target: ScreenKey,
    params?: { userId?: number; employeeId?: number },
  ) => void;
}

const emptyEmployee: EmployeeInput = {
  name: "",
  phone: "",
  position: "Vendeur",
};

const emptyAccount: UserInput = {
  employeeId: 0,
  username: "",
  role: "employee",
  password: "",
};

export function EmployeesScreen({
  db,
  user,
  onNavigate,
}: EmployeesScreenProps) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<"employees" | "accounts">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [employeeDraft, setEmployeeDraft] =
    useState<EmployeeInput>(emptyEmployee);
  const [accountDraft, setAccountDraft] = useState<UserInput>(emptyAccount);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const twoColumns = width >= 980;

  async function load() {
    const [nextEmployees, nextUsers] = await Promise.all([
      listEmployees(db, true),
      listUsers(db, true),
    ]);
    setEmployees(nextEmployees);
    setUsers(nextUsers);
  }

  useEffect(() => {
    void load();
  }, [db]);

  const availableForAccount = useMemo(
    () =>
      employees.filter(
        (employee) => employee.is_active && !employee.has_account,
      ),
    [employees],
  );

  function openCreateEmployee() {
    setSelectedEmployee(null);
    setEmployeeDraft(emptyEmployee);
    setError("");
    setEmployeeOpen(true);
  }

  function openEmployee(employee: Employee) {
    setSelectedEmployee(employee);
    setEmployeeDraft({
      name: employee.name,
      phone: employee.phone,
      position: employee.position,
    });
    setError("");
    setEmployeeOpen(true);
  }

  function openCreateAccount() {
    if (availableForAccount.length === 0) {
      Alert.alert(
        "Aucun employé disponible",
        "Ajoutez d’abord un employé sans compte, puis créez son accès.",
      );
      return;
    }
    onNavigate("permissions", {
      employeeId: availableForAccount[0]?.id,
    });
  }

  function openAccount(account: User) {
    setSelectedUser(account);
    setError("");
    setAccountOpen(true);
  }

  async function submitEmployee() {
    if (employeeDraft.name.trim().length < 2) {
      setError("Indiquez le nom de l’employé.");
      return;
    }
    if (employeeDraft.position.trim().length < 2) {
      setError("Indiquez sa fonction dans la boutique.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveEmployee(db, employeeDraft, user, selectedEmployee?.id);
      setEmployeeOpen(false);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La fiche de l’employé n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAccount() {
    if (!accountDraft.employeeId) {
      setError("Choisissez l’employé qui utilisera ce compte.");
      return;
    }
    if (accountDraft.username.trim().length < 3) {
      setError("Le nom de connexion doit contenir au moins 3 caractères.");
      return;
    }
    const passwordError = validateAccountPassword(
      accountDraft.role,
      accountDraft.password,
    );
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createUser(db, accountDraft, user);
      setAccountOpen(false);
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

  function requestDeactivateEmployee() {
    if (!selectedEmployee) return;
    Alert.alert(
      "Désactiver cet employé ?",
      "La fiche et son éventuel compte seront désactivés. Les ventes déjà attribuées resteront visibles.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deactivateEmployee(db, selectedEmployee, user);
                setEmployeeOpen(false);
                await load();
              } catch (caught) {
                Alert.alert(
                  "Désactivation impossible",
                  caught instanceof Error
                    ? caught.message
                    : "La fiche n’a pas été désactivée.",
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

  function requestDeactivateAccount() {
    if (!selectedUser) return;
    Alert.alert(
      "Désactiver ce compte ?",
      "L’employé restera dans le personnel et dans l’historique des ventes.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deactivateUser(db, selectedUser, user);
                setAccountOpen(false);
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

  const action = (
    <View style={styles.actionButtons}>
      <AppButton
        icon="Key"
        label="Créer un compte"
        onPress={openCreateAccount}
        tone="secondary"
      />
      <AppButton
        icon="UserPlus"
        label="Ajouter un employé"
        onPress={openCreateEmployee}
      />
    </View>
  );

  return (
    <Page
      action={action}
      description="Ajoutez les personnes qui travaillent ici et attribuez-leur les ventes."
      title="Employés"
    >
      {mode === "employees" ? (
        employees.length === 0 ? (
          <EmptyState
            action={
              <AppButton
                icon="UserPlus"
                label="Ajouter un employé"
                onPress={openCreateEmployee}
              />
            }
            icon="Users"
            message="Ajoutez les personnes qui travaillent dans la boutique, même si elles n’utilisent jamais l’application."
            title="Aucun employé"
          />
        ) : (
          <View style={styles.grid}>
            {employees.map((employee) => (
              <Pressable
                key={employee.id}
                onPress={() => openEmployee(employee)}
                style={({ pressed }) => [
                  styles.employeeCard,
                  twoColumns && styles.twoColumns,
                  !employee.is_active && styles.inactive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {employee.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.badges}>
                    <Badge
                      label={employee.is_active ? "Actif" : "Désactivé"}
                      tone={employee.is_active ? "success" : "neutral"}
                    />
                    <Badge
                      label={employee.has_account ? "Avec compte" : "Sans compte"}
                      tone={employee.has_account ? "accent" : "neutral"}
                    />
                  </View>
                </View>
                <View style={styles.identity}>
                  <Text numberOfLines={1} style={styles.name}>
                    {employee.name}
                  </Text>
                  <Text style={styles.position}>{employee.position}</Text>
                  {employee.phone ? (
                    <Text style={styles.phone}>{employee.phone}</Text>
                  ) : null}
                </View>
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>
                      {employee.order_count ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>ventes</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text numberOfLines={1} style={styles.salesValue}>
                      {formatMoney(employee.total_sales ?? 0)}
                    </Text>
                    <Text style={styles.statLabel}>chiffre attribué</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )
      ) : users.length === 0 ? (
        <EmptyState
          icon="Key"
          message="Un compte permet à un membre du personnel d’ouvrir l’application."
          title="Aucun compte"
        />
      ) : (
        <View style={styles.grid}>
          {users.map((account) => (
            <Pressable
              key={account.id}
              onPress={() => openAccount(account)}
              style={({ pressed }) => [
                styles.accountCard,
                twoColumns && styles.twoColumns,
                !account.is_active && styles.inactive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.accountMain}>
                <View style={styles.accountIcon}>
                  <Icon
                    name={
                      account.role === "boss"
                        ? "ShieldCheck"
                        : "UserCog"
                    }
                    size={23}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.identity}>
                  <Text numberOfLines={1} style={styles.name}>
                    {account.name}
                  </Text>
                  <Text style={styles.username}>@{account.username}</Text>
                </View>
              </View>
              <View style={styles.accountMeta}>
                <Badge
                  label={roleLabel[account.role]}
                  tone={account.role === "boss" ? "accent" : "neutral"}
                />
                <Badge
                  label={account.has_password ? "Avec code" : "Sans code"}
                  tone={account.has_password ? "success" : "warning"}
                />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <ModalSheet
        onClose={() => setEmployeeOpen(false)}
        subtitle={
          selectedEmployee
            ? `${selectedEmployee.order_count ?? 0} vente(s) · ${formatMoney(selectedEmployee.total_sales ?? 0)}`
            : "Cette personne pourra recevoir des ventes sans avoir de compte."
        }
        title={selectedEmployee ? selectedEmployee.name : "Nouvel employé"}
        visible={employeeOpen}
        width={540}
      >
        <TextField
          label="Nom complet"
          onChangeText={(name) =>
            setEmployeeDraft((value) => ({ ...value, name }))
          }
          placeholder="Ex. Patrick Mbala"
          value={employeeDraft.name}
        />
        <TextField
          label="Fonction"
          onChangeText={(position) =>
            setEmployeeDraft((value) => ({ ...value, position }))
          }
          placeholder="Vendeur, caissier, livreur…"
          value={employeeDraft.position}
        />
        <TextField
          error={error || undefined}
          keyboardType="phone-pad"
          label="Téléphone (facultatif)"
          onChangeText={(phone) =>
            setEmployeeDraft((value) => ({ ...value, phone }))
          }
          placeholder="+243 812 345 678"
          value={employeeDraft.phone ?? ""}
        />
        <View style={styles.modalActions}>
          {selectedEmployee?.is_active ? (
            <AppButton
              label="Désactiver"
              loading={busy}
              onPress={requestDeactivateEmployee}
              tone="danger"
            />
          ) : null}
          <View style={styles.grow} />
          <AppButton
            label="Enregistrer la fiche"
            loading={busy}
            onPress={() => void submitEmployee()}
          />
        </View>
      </ModalSheet>

      <ModalSheet
        onClose={() => setAccountOpen(false)}
        subtitle={
          selectedUser
            ? `Créé le ${formatDate(selectedUser.created_at)}`
            : "Le compte sera lié à une fiche employé existante."
        }
        title={selectedUser ? selectedUser.name : "Nouveau compte"}
        visible={accountOpen}
        width={560}
      >
        {selectedUser ? (
          <>
            <View style={styles.accountDetails}>
              <Text style={styles.detailsTitle}>@{selectedUser.username}</Text>
              <Text style={styles.detailsText}>
                {roleLabel[selectedUser.role]} ·{" "}
                {selectedUser.has_password
                  ? "code secret configuré"
                  : "connexion directe sans code"}
              </Text>
            </View>
            {selectedUser.role !== "boss" ? (
              <AppButton
                fullWidth
                icon="ShieldCheck"
                label="Personnaliser les permissions"
                onPress={() =>
                  onNavigate("permissions", { userId: selectedUser.id })
                }
                tone="secondary"
              />
            ) : null}
            {selectedUser.role !== "boss" && selectedUser.is_active ? (
              <AppButton
                fullWidth
                icon="UserMinus"
                label="Désactiver le compte"
                loading={busy}
                onPress={requestDeactivateAccount}
                tone="danger"
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.formLabel}>Employé</Text>
            <ScrollView
              horizontal
              contentContainerStyle={styles.employeeChoices}
              showsHorizontalScrollIndicator={false}
            >
              {availableForAccount.map((employee) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: accountDraft.employeeId === employee.id,
                  }}
                  key={employee.id}
                  onPress={() =>
                    setAccountDraft((value) => ({
                      ...value,
                      employeeId: employee.id,
                    }))
                  }
                  style={[
                    styles.choice,
                    accountDraft.employeeId === employee.id &&
                      styles.choiceActive,
                  ]}
                >
                  <Icon
                    name="User"
                    size={19}
                    color={
                      accountDraft.employeeId === employee.id
                        ? colors.accent
                        : colors.muted
                    }
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.choiceText,
                      accountDraft.employeeId === employee.id &&
                        styles.choiceTextActive,
                    ]}
                  >
                    {employee.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextField
              autoCapitalize="none"
              autoCorrect={false}
              label="Nom de connexion"
              onChangeText={(username) =>
                setAccountDraft((value) => ({ ...value, username }))
              }
              placeholder="patrick"
              value={accountDraft.username}
            />
            <Text style={styles.formLabel}>Rôle</Text>
            <View style={styles.roles}>
              {(["manager", "cashier", "employee"] as const).map((role) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: accountDraft.role === role }}
                  key={role}
                  onPress={() =>
                    setAccountDraft((value) => ({ ...value, role }))
                  }
                  style={[
                    styles.roleChoice,
                    accountDraft.role === role && styles.roleChoiceActive,
                  ]}
                >
                  <Icon
                    name={
                      role === "manager"
                        ? "UserCog"
                        : role === "cashier"
                          ? "Banknote"
                          : "User"
                    }
                    size={21}
                    color={
                      accountDraft.role === role ? colors.accent : colors.ink2
                    }
                  />
                  <Text style={styles.roleTitle}>
                    {roleLabel[role as Role]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextField
              error={error || undefined}
              label={
                accountDraft.role === "employee"
                  ? "Code secret (facultatif)"
                  : "Code secret"
              }
              onChangeText={(password) =>
                setAccountDraft((value) => ({ ...value, password }))
              }
              placeholder={
                accountDraft.role === "employee"
                  ? "Laisser vide pour un accès direct"
                  : "4 caractères minimum"
              }
              secureTextEntry
              value={accountDraft.password}
            />
            <AppButton
              fullWidth
              icon="Key"
              label="Créer le compte"
              loading={busy}
              onPress={() => void submitAccount()}
            />
          </>
        )}
      </ModalSheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  actionButtons: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    flexWrap: "wrap",
  },
  tabs: {
    alignSelf: "flex-start",
    backgroundColor: colors.paper2,
    borderRadius: radius.sm,
    flexDirection: "row",
    padding: space.xxs,
  },
  tab: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.md,
  },
  tabActive: {
    backgroundColor: colors.surfaceStrong,
  },
  tabText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.ink,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  employeeCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
    minHeight: 244,
    padding: space.md,
    width: "100%",
  },
  accountCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
    minHeight: 132,
    padding: space.md,
    width: "100%",
  },
  twoColumns: {
    width: "49%",
  },
  inactive: {
    opacity: 0.56,
  },
  pressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: fonts.display,
    fontSize: 22,
  },
  badges: {
    alignItems: "flex-end",
    gap: space.xs,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 19,
  },
  position: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    marginTop: space.xxs,
  },
  phone: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: space.xxs,
  },
  stats: {
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingTop: space.md,
  },
  stat: {
    flex: 1,
    gap: space.xxs,
  },
  statValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    fontVariant: ["tabular-nums"],
  },
  salesValue: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  accountMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  accountIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  username: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    marginTop: space.xxs,
  },
  accountMeta: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.xs,
    paddingTop: space.sm,
  },
  modalActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  grow: {
    flex: 1,
  },
  accountDetails: {
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    gap: space.xs,
    padding: space.md,
  },
  detailsTitle: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 16,
  },
  detailsText: {
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
  employeeChoices: {
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
  choiceTextActive: {
    color: colors.accentDark,
  },
  roles: {
    flexDirection: "row",
    gap: space.sm,
  },
  roleChoice: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.md,
  },
  roleChoiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  roleTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
});
