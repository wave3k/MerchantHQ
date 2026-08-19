import type { SQLiteDatabase } from "expo-sqlite";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

import Icon from "../components/Icon";
import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page, SearchField } from "../components/Page";
import { TextField } from "../components/TextField";
import {
  createExpenseCategory,
  deleteExpense,
  listExpenseCategories,
  listExpenses,
  saveExpense,
} from "../data/database";
import { formatDateTime, formatMoney } from "../domain/format";
import { userCan } from "../domain/permissions";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { Expense, ExpenseCategory, ExpenseInput, User } from "../types";

interface ExpensesScreenProps {
  db: SQLiteDatabase;
  user: User;
}

export function ExpensesScreen({ db, user }: ExpensesScreenProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [newCategory, setNewCategory] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = userCan(user, "expenses.manage");

  async function load() {
    const [loadedExpenses, loadedCategories] = await Promise.all([
      listExpenses(db),
      listExpenseCategories(db),
    ]);
    setExpenses(loadedExpenses);
    setCategories(loadedCategories);
  }

  useEffect(() => {
    void load();
  }, [db]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return expenses.filter((expense) => {
      if (
        categoryFilter !== null &&
        expense.category_id !== categoryFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [expense.category_name, expense.notes, expense.created_by_name]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(query);
    });
  }, [expenses, search, categoryFilter]);

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);

  function openCreate() {
    setSelectedCategoryId(categories[0]?.id ?? null);
    setAmountText("");
    setNotes("");
    setNewCategory("");
    setFormError("");
    setEditorOpen(true);
  }

  async function submitNewCategory() {
    const name = newCategory.trim();
    if (name.length < 2) {
      setFormError("Le nom de la catégorie doit contenir au moins 2 caractères.");
      return;
    }
    setBusy(true);
    try {
      await createExpenseCategory(db, name, user);
      const loaded = await listExpenseCategories(db);
      setCategories(loaded);
      const created = loaded.find(
        (category) =>
          category.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"),
      );
      setSelectedCategoryId(created?.id ?? null);
      setNewCategory("");
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "La catégorie n’a pas pu être créée.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitExpense() {
    const amount = Number.parseInt(amountText.replace(/\s/g, ""), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Indiquez un montant valide en francs congolais.");
      return;
    }
    setBusy(true);
    try {
      const input: ExpenseInput = {
        categoryId: selectedCategoryId,
        categoryName:
          categories.find((category) => category.id === selectedCategoryId)
            ?.name ?? "Autre",
        amount,
        notes,
      };
      await saveExpense(db, input, user);
      setEditorOpen(false);
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "La dépense n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(expense: Expense) {
    Alert.alert(
      "Retirer la dépense",
      `Retirer la dépense de ${formatMoney(expense.amount)} (${expense.category_name}) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteExpense(db, expense.id, user);
                await load();
              } catch (caught) {
                Alert.alert(
                  "Suppression impossible",
                  caught instanceof Error
                    ? caught.message
                    : "La dépense n’a pas été retirée.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <Page
      action={
        canManage ? (
          <AppButton icon="Plus" label="Ajouter une dépense" onPress={openCreate} />
        ) : undefined
      }
      description="Suivez les sorties d’argent de la boutique : loyers, marchandises, salaires et plus."
      title="Dépenses"
    >
      <SearchField
        onChangeText={setSearch}
        placeholder="Rechercher par catégorie, note ou auteur"
        value={search}
      />
      {categories.length > 0 ? (
        <View style={styles.categoryChips}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: categoryFilter === null }}
            onPress={() => setCategoryFilter(null)}
            style={({ pressed }) => [
              styles.categoryChip,
              categoryFilter === null && styles.categoryChipActive,
              pressed && styles.categoryChipPressed,
            ]}
          >
            <Text style={styles.categoryChipText}>Toutes</Text>
          </Pressable>
          {categories.map((category) => {
            const active = categoryFilter === category.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={category.id}
                onPress={() => setCategoryFilter(active ? null : category.id)}
                style={({ pressed }) => [
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                  pressed && styles.categoryChipPressed,
                ]}
              >
                <Text style={styles.categoryChipText}>{category.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState
          action={
            canManage && expenses.length === 0 ? (
              <AppButton
                icon="Plus"
                label="Ajouter la première dépense"
                onPress={openCreate}
              />
            ) : undefined
          }
          icon="Coins"
          message={
            expenses.length
              ? "Modifiez les mots recherchés."
              : "Enregistrez les sorties d’argent de la boutique pour suivre vos charges."
          }
          title={expenses.length ? "Aucun résultat" : "Aucune dépense"}
        />
      ) : (
        <>
          <View style={styles.expenseSummary}>
            <Text style={styles.expenseCount}>
              {filtered.length} dépense{filtered.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.expenseTotal}>{formatMoney(total)}</Text>
          </View>
          <View style={styles.expenseList}>
            {filtered.map((expense) => (
              <View key={expense.id} style={styles.expenseRow}>
                <View style={styles.expenseIdentity}>
                  <View style={styles.expenseTop}>
                    <Badge label={expense.category_name} tone="neutral" />
                    {canManage ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer la dépense de ${expense.category_name}`}
                        hitSlop={8}
                        onPress={() => confirmDelete(expense)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.deleteButtonPressed,
                        ]}
                      >
                        <Icon color={colors.faint} name="Trash2" size={18} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text numberOfLines={2} style={styles.expenseNotes}>
                    {expense.notes || "Sans note"}
                  </Text>
                  <Text style={styles.expenseMeta}>
                    {formatDateTime(expense.created_at)} · {expense.created_by_name}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>
                  {formatMoney(expense.amount)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      <ModalSheet
        onClose={() => setEditorOpen(false)}
        subtitle="La dépense sera inscrite dans l’historique et l’activité."
        title="Nouvelle dépense"
        visible={editorOpen}
      >
        <View>
          <Text style={styles.categoryLabel}>Catégorie</Text>
          <View style={styles.categoryChoices}>
            {categories.map((category) => {
              const selected = selectedCategoryId === category.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={category.id}
                  onPress={() => setSelectedCategoryId(category.id)}
                  style={({ pressed }) => [
                    styles.categoryChoice,
                    selected && styles.categoryChoiceSelected,
                    pressed && styles.categoryChoicePressed,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.categoryChoiceText,
                      selected && styles.categoryChoiceTextSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.newCategoryRow}>
            <TextField
              containerStyle={styles.flexField}
              label="Nouvelle catégorie"
              onChangeText={setNewCategory}
              onSubmitEditing={() => void submitNewCategory()}
              placeholder="Ex. Réparations"
              value={newCategory}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submitNewCategory()}
              style={({ pressed }) => [
                styles.newCategoryButton,
                pressed && styles.newCategoryButtonPressed,
              ]}
            >
              <Icon color={colors.accentInk} name="Plus" size={18} />
            </Pressable>
          </View>
        </View>
        <TextField
          keyboardType="number-pad"
          label="Montant (FC)"
          onChangeText={setAmountText}
          placeholder="15000"
          value={amountText}
        />
        <TextField
          label="Note (facultatif)"
          onChangeText={setNotes}
          placeholder="Ex. Achat de papeterie"
          value={notes}
        />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <View style={styles.modalActions}>
          <AppButton
            icon="Coins"
            label="Enregistrer la dépense"
            loading={busy}
            onPress={() => void submitExpense()}
          />
        </View>
      </ModalSheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  categoryChip: {
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.round,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryChipPressed: {
    opacity: 0.8,
  },
  categoryChipText: {
    color: colors.muted,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  expenseSummary: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: space.sm,
  },
  expenseCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  expenseTotal: {
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  expenseList: {
    gap: space.sm,
  },
  expenseRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
  },
  expenseIdentity: {
    flex: 1,
    gap: space.xs,
    minWidth: 0,
  },
  expenseTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deleteButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  deleteButtonPressed: {
    backgroundColor: colors.errorSoft,
  },
  expenseNotes: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  expenseMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  expenseAmount: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 18,
  },
  categoryLabel: {
    color: colors.muted,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    marginBottom: space.xs,
  },
  categoryChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  categoryChoice: {
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  categoryChoiceSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  categoryChoicePressed: {
    opacity: 0.8,
  },
  categoryChoiceText: {
    color: colors.muted,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
  },
  categoryChoiceTextSelected: {
    color: colors.accent,
  },
  newCategoryRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
  },
  flexField: {
    flex: 1,
  },
  newCategoryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  newCategoryButtonPressed: {
    opacity: 0.85,
  },
  formError: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  modalActions: {
    gap: space.sm,
  },
});
