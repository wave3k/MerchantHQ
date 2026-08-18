/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
/* Hallmark · macrostructure: Catalogue · tone: utilitaire · anchor hue: cobalt */
import type { SQLiteDatabase } from "expo-sqlite";
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";
import { useEffect, useMemo, useState } from "react";

import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page, SearchField } from "../components/Page";
import { TextField } from "../components/TextField";
import {
  adjustStock,
  archiveProduct,
  listProducts,
  saveProduct,
} from "../data/database";
import { notifyLowStockChanges } from "../data/notifications";
import { formatMoney } from "../domain/format";
import { userCan } from "../domain/permissions";
import { isLowStock, tracksStock as productTracksStock } from "../domain/stock";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { Product, ProductInput, User } from "../types";

interface ProductsScreenProps {
  db: SQLiteDatabase;
  user: User;
}

const emptyDraft: ProductInput = {
  name: "",
  sku: "",
  category: "Général",
  price: 0,
  stock: 0,
  lowStockThreshold: 5,
  tracksStock: true,
};

export function ProductsScreen({ db, user }: ProductsScreenProps) {
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductInput>(emptyDraft);
  const [priceText, setPriceText] = useState("");
  const [stockText, setStockText] = useState("0");
  const [thresholdText, setThresholdText] = useState("5");
  const [stockReason, setStockReason] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = userCan(user, "products.manage");
  const canAdjust = userCan(user, "stock.adjust");
  const twoColumns = width >= 960;

  async function load() {
    setProducts(await listProducts(db));
  }

  useEffect(() => {
    void load();
  }, [db]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.category, product.sku ?? ""]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(query),
    );
  }, [products, search]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setPriceText("");
    setStockText("0");
    setThresholdText("5");
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setDraft({
      name: product.name,
      sku: product.sku ?? "",
      category: product.category,
      price: product.price,
      stock: product.stock,
      lowStockThreshold: product.low_stock_threshold,
      tracksStock: Boolean(product.tracks_stock),
    });
    setPriceText(String(product.price));
    setStockText(String(product.stock));
    setThresholdText(String(product.low_stock_threshold));
    setFormError("");
    setEditorOpen(true);
  }

  function openStock(product: Product) {
    setEditing(product);
    setStockText(String(product.stock));
    setStockReason("");
    setFormError("");
    setStockOpen(true);
  }

  async function submitProduct() {
    const price = Number.parseInt(priceText.replace(/\s/g, ""), 10);
    const initialStock = Number.parseInt(stockText, 10);
    const threshold = Number.parseInt(thresholdText, 10);
    if (draft.name.trim().length < 2) {
      setFormError("Le nom du produit doit contenir au moins 2 caractères.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Indiquez un prix valide en francs congolais.");
      return;
    }
    if (
      draft.tracksStock &&
      (!Number.isFinite(initialStock) ||
        initialStock < 0 ||
        !Number.isFinite(threshold) ||
        threshold < 0)
    ) {
      setFormError("Le stock et le seuil doivent être des nombres positifs.");
      return;
    }
    setBusy(true);
    try {
      await saveProduct(
        db,
        {
          ...draft,
          price,
          stock: draft.tracksStock ? initialStock : 0,
          lowStockThreshold: draft.tracksStock ? threshold : 0,
        },
        user,
        editing?.id,
      );
      setEditorOpen(false);
      await load();
      void notifyLowStockChanges(db).catch(() => undefined);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Le produit n’a pas pu être enregistré.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitStock() {
    if (!editing) return;
    const nextStock = Number.parseInt(stockText, 10);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      setFormError("Indiquez une quantité de stock valide.");
      return;
    }
    setBusy(true);
    try {
      await adjustStock(db, editing, nextStock, stockReason, user);
      setStockOpen(false);
      await load();
      void notifyLowStockChanges(db).catch(() => undefined);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Le stock n’a pas pu être ajusté.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!editing) return;
    setBusy(true);
    try {
      await archiveProduct(db, editing, user);
      setEditorOpen(false);
      await load();
      void notifyLowStockChanges(db).catch(() => undefined);
    } catch (caught) {
      Alert.alert(
        "Archivage impossible",
        caught instanceof Error ? caught.message : "Le produit n’a pas été archivé.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      action={
        canManage ? (
          <AppButton
            icon="Plus"
            label="Ajouter un produit"
            onPress={openCreate}
          />
        ) : undefined
      }
      description={
        canManage
          ? "Ajoutez les produits, leurs prix et les quantités disponibles."
          : "Consultez les prix et les quantités disponibles."
      }
      title="Produits"
    >
      <SearchField
        onChangeText={setSearch}
        placeholder="Rechercher par nom, catégorie ou code"
        value={search}
      />
      {filtered.length === 0 ? (
        <EmptyState
          action={
            canManage && products.length === 0 ? (
              <AppButton
                icon="Plus"
                label="Ajouter le premier produit"
                onPress={openCreate}
              />
            ) : undefined
          }
          icon="Package"
          message={
            products.length
              ? "Modifiez les mots recherchés."
              : "Ajoutez les articles vendus dans la boutique avec leur prix et leur stock."
          }
          title={products.length ? "Aucun résultat" : "Aucun produit"}
        />
      ) : (
        <>
          <View style={styles.catalogSummary}>
            <Text style={styles.catalogCount}>
              {filtered.length} produit{filtered.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.catalogHint}>
              {canManage
                ? "Touchez une fiche pour modifier le produit."
                : "Consultation uniquement."}
            </Text>
          </View>
          <View style={styles.productGrid}>
          {filtered.map((product) => {
            const tracksStock = productTracksStock(product);
            const low = isLowStock(product);
            return (
              <Pressable
                disabled={!canManage}
                key={product.id}
                onPress={() => openEdit(product)}
                style={({ pressed }) => [
                  styles.productCard,
                  twoColumns && styles.productCardTwoColumns,
                  low && styles.productCardLow,
                  pressed && styles.productCardPressed,
                ]}
              >
                <View style={styles.productTop}>
                  <Badge label={product.category} tone="neutral" />
                  <Badge
                    label={
                      !tracksStock
                        ? "Stock illimité"
                        : product.stock === 0
                        ? "Rupture"
                        : low
                          ? "Stock bas"
                          : "Disponible"
                    }
                    tone={
                      !tracksStock
                        ? "neutral"
                        : product.stock === 0
                          ? "danger"
                          : low
                            ? "warning"
                            : "success"
                    }
                  />
                </View>

                <View style={styles.productIdentity}>
                  <Text numberOfLines={2} style={styles.productName}>
                    {product.name}
                  </Text>
                  <Text style={styles.sku}>{product.sku || "Sans code produit"}</Text>
                </View>

                <View style={styles.productMetrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Prix de vente</Text>
                    <Text style={styles.price}>{formatMoney(product.price)}</Text>
                  </View>
                  <View style={[styles.metric, styles.stockMetric]}>
                    <Text style={styles.metricLabel}>
                      {tracksStock ? "En stock" : "Disponibilité"}
                    </Text>
                    <Text style={styles.stockValue}>
                      {tracksStock ? product.stock : "Illimité"}
                    </Text>
                    {tracksStock ? (
                      <Text style={styles.threshold}>
                        Alerte à {product.low_stock_threshold}
                      </Text>
                    ) : (
                      <Text style={styles.threshold}>Aucun suivi nécessaire</Text>
                    )}
                  </View>
                </View>

                <View style={styles.productFooter}>
                  <Text style={styles.editHint}>
                    {canManage ? "Modifier la fiche" : "Consultation"}
                  </Text>
                  {canAdjust && tracksStock ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ajuster le stock de ${product.name}`}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        openStock(product);
                      }}
                      style={({ pressed }) => [
                        styles.stockButton,
                        pressed && styles.stockButtonPressed,
                      ]}
                    >
                      <Icon
                        name="Layers"
                        size={20}
                        color={colors.accent}
                      />
                      <Text style={styles.stockButtonText}>Ajuster le stock</Text>
                    </Pressable>
                  ) : tracksStock ? (
                    <View style={styles.lockedStock}>
                      <Icon
                        name="Lock"
                        size={17}
                        color={colors.faint}
                      />
                      <Text style={styles.lockedStockText}>Stock verrouillé</Text>
                    </View>
                  ) : (
                    <View style={styles.lockedStock}>
                      <Icon
                        name="Infinity"
                        size={18}
                        color={colors.muted}
                      />
                      <Text style={styles.lockedStockText}>Stock illimité</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
          </View>
        </>
      )}

      <ModalSheet
        onClose={() => setEditorOpen(false)}
        subtitle={
          !draft.tracksStock
            ? "Aucune quantité ne sera décomptée lors des ventes."
            : editing
            ? "Le stock se modifie avec l’action d’ajustement dédiée."
            : "La première quantité sera ajoutée à l’historique."
        }
        title={editing ? "Modifier le produit" : "Nouveau produit"}
        visible={editorOpen}
      >
        <TextField
          label="Nom du produit"
          onChangeText={(name) => setDraft((value) => ({ ...value, name }))}
          placeholder="Ex. Riz 5 kg"
          value={draft.name}
        />
        <View style={styles.formRow}>
          <TextField
            autoCapitalize="characters"
            containerStyle={styles.flexField}
            label="Code produit (facultatif)"
            onChangeText={(sku) => setDraft((value) => ({ ...value, sku }))}
            placeholder="RIZ-5KG"
            value={draft.sku}
          />
          <TextField
            containerStyle={styles.flexField}
            label="Catégorie"
            onChangeText={(category) =>
              setDraft((value) => ({ ...value, category }))
            }
            placeholder="Alimentation"
            value={draft.category}
          />
        </View>
        <TextField
          keyboardType="number-pad"
          label="Prix de vente (FC)"
          onChangeText={setPriceText}
          placeholder="18000"
          value={priceText}
        />
        <View style={styles.stockMode}>
          <View style={styles.stockModeCopy}>
            <Text style={styles.stockModeTitle}>Gestion du stock</Text>
            <Text style={styles.stockModeHint}>
              Choisissez « illimité » pour un service ou un produit sans quantité.
            </Text>
          </View>
          <View style={styles.stockModeChoices}>
            {[
              { value: true, label: "Stock suivi", icon: "Layers" },
              { value: false, label: "Stock illimité", icon: "Infinity" },
            ].map((option) => {
              const selected = draft.tracksStock === option.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.label}
                  onPress={() =>
                    setDraft((value) => ({
                      ...value,
                      tracksStock: option.value,
                    }))
                  }
                  style={({ pressed }) => [
                    styles.stockModeChoice,
                    selected && styles.stockModeChoiceSelected,
                    pressed && styles.stockModeChoicePressed,
                  ]}
                >
                  <Icon
                    color={selected ? colors.accent : colors.muted}
                    name={option.icon as IconName}
                    size={19}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.stockModeChoiceText,
                      selected && styles.stockModeChoiceTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {draft.tracksStock ? (
          <View style={styles.formRow}>
            {!editing ? (
              <TextField
                containerStyle={styles.flexField}
                keyboardType="number-pad"
                label="Stock initial"
                onChangeText={setStockText}
                placeholder="0"
                value={stockText}
              />
            ) : null}
            <TextField
              containerStyle={styles.flexField}
              keyboardType="number-pad"
              label="Seuil d’alerte"
              onChangeText={setThresholdText}
              placeholder="5"
              value={thresholdText}
            />
          </View>
        ) : null}
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <View style={styles.modalActions}>
          {editing ? (
            <AppButton
              label="Archiver"
              loading={busy}
              onPress={() => void archive()}
              tone="danger"
            />
          ) : null}
          <View style={styles.grow} />
          <AppButton
            label="Annuler"
            onPress={() => setEditorOpen(false)}
            tone="ghost"
          />
          <AppButton
            icon="Save"
            label="Enregistrer"
            loading={busy}
            onPress={() => void submitProduct()}
          />
        </View>
      </ModalSheet>

      <ModalSheet
        onClose={() => setStockOpen(false)}
        subtitle={
          editing
            ? `Stock actuel : ${editing.stock} unité(s). Chaque ajustement sera journalisé.`
            : undefined
        }
        title="Ajuster le stock"
        visible={stockOpen}
        width={480}
      >
        <TextField
          keyboardType="number-pad"
          label="Nouvelle quantité totale"
          onChangeText={setStockText}
          placeholder="0"
          value={stockText}
        />
        <TextField
          error={formError || undefined}
          label="Motif"
          onChangeText={setStockReason}
          placeholder="Ex. Réception fournisseur ou inventaire"
          value={stockReason}
        />
        <AppButton
          fullWidth
          icon="Layers"
          label="Appliquer l’ajustement"
          loading={busy}
          onPress={() => void submitStock()}
        />
      </ModalSheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  catalogSummary: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  catalogCount: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
  },
  catalogHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  productCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
    minHeight: 252,
    padding: space.md,
    width: "100%",
  },
  productCardTwoColumns: {
    width: "49%",
  },
  productCardLow: {
    backgroundColor: colors.surface,
  },
  productCardPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  productTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  productIdentity: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    lineHeight: 25,
  },
  sku: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 12,
    marginTop: space.xs,
  },
  productMetrics: {
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingVertical: space.sm,
  },
  metric: {
    flex: 1.4,
    gap: space.xxs,
  },
  stockMetric: {
    borderLeftColor: colors.rule,
    borderLeftWidth: StyleSheet.hairlineWidth,
    flex: 0.8,
    paddingLeft: space.md,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  price: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 21,
    fontVariant: ["tabular-nums"],
  },
  stockValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    fontVariant: ["tabular-nums"],
  },
  threshold: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  productFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  editHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  stockButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: space.xs,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  stockButtonPressed: {
    backgroundColor: colors.paper2,
  },
  stockButtonText: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  lockedStock: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    minHeight: 44,
  },
  lockedStockText: {
    color: colors.faint,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  formRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  flexField: {
    flexBasis: 210,
    flexGrow: 1,
    minWidth: 0,
  },
  stockMode: {
    backgroundColor: colors.paper2,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    padding: space.sm,
  },
  stockModeCopy: {
    gap: space.xxs,
  },
  stockModeTitle: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  stockModeHint: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  stockModeChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  stockModeChoice: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    flexGrow: 1,
    gap: space.xs,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 150,
    paddingHorizontal: space.sm,
  },
  stockModeChoiceSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  stockModeChoicePressed: {
    opacity: 0.72,
    transform: [{ translateY: 1 }],
  },
  stockModeChoiceText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  stockModeChoiceTextSelected: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  modalActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  grow: {
    flex: 1,
  },
});
