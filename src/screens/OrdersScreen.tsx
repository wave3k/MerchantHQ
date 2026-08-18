/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5 */
/* Hallmark · macrostructure: Split Studio · tone: utilitaire · anchor hue: cobalt */
import type { SQLiteDatabase } from "expo-sqlite";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "../components/Icon";
import { useEffect, useMemo, useState } from "react";

import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page, SearchField } from "../components/Page";
import { TextField } from "../components/TextField";
import {
  createOrder,
  getSetting,
  listClients,
  listEmployees,
  listOrders,
  listProducts,
  saveClient,
} from "../data/database";
import { refreshOperationalNotifications } from "../data/notifications";
import { isAutoPrintEnabled, printOrderTicket } from "../data/tickets";
import { formatDateTime, formatMoney, normalizePhone } from "../domain/format";
import {
  isLowStock,
  isOutOfStock,
  maximumSaleQuantity,
  tracksStock,
} from "../domain/stock";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type {
  CartLine,
  Client,
  ClientInput,
  Employee,
  Order,
  PaymentMethod,
  Product,
  User,
} from "../types";

interface OrdersScreenProps {
  db: SQLiteDatabase;
  onSaleModeChange: (active: boolean) => void;
  user: User;
}

export function OrdersScreen({
  db,
  onSaleModeChange,
  user,
}: OrdersScreenProps) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<"sale" | "history">("history");
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(
    user.employee_id,
  );
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [clientDraft, setClientDraft] = useState<ClientInput>({
    name: "",
    phone: "",
    address: "",
  });
  const [clientError, setClientError] = useState("");
  const [loading, setLoading] = useState(true);
  const [acceptedPayments, setAcceptedPayments] = useState<PaymentMethod[]>([
    "cash",
    "mobile_money",
    "card",
  ]);

  async function load() {
    const [
      nextProducts,
      nextClients,
      nextEmployees,
      nextOrders,
      cashEnabled,
      mobileEnabled,
      cardEnabled,
    ] =
      await Promise.all([
      listProducts(db),
      listClients(db),
      listEmployees(db),
      listOrders(db, 100),
      getSetting(db, "payment_cash"),
      getSetting(db, "payment_mobile_money"),
      getSetting(db, "payment_card"),
    ]);
    const nextPayments: PaymentMethod[] = [];
    if (cashEnabled !== "0") nextPayments.push("cash");
    if (mobileEnabled !== "0") nextPayments.push("mobile_money");
    if (cardEnabled !== "0") nextPayments.push("card");
    setAcceptedPayments(nextPayments.length ? nextPayments : ["cash"]);
    setPayment((current) =>
      nextPayments.includes(current) ? current : (nextPayments[0] ?? "cash"),
    );
    setProducts(nextProducts);
    setClients(nextClients);
    setEmployees(nextEmployees);
    setSelectedEmployee((current) => {
      if (nextEmployees.some((employee) => employee.id === current)) {
        return current;
      }
      if (
        user.employee_id &&
        nextEmployees.some((employee) => employee.id === user.employee_id)
      ) {
        return user.employee_id;
      }
      return nextEmployees[0]?.id ?? null;
    });
    setOrders(nextOrders);
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => {
      setLoading(false);
      Alert.alert(
        "Chargement impossible",
        error instanceof Error ? error.message : "La caisse n’a pas pu être chargée.",
      );
    });
  }, [db]);

  useEffect(
    () => () => {
      onSaleModeChange(false);
    },
    [onSaleModeChange],
  );

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

  const total = cart.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const unitCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function openSale() {
    setMode("sale");
    onSaleModeChange(true);
  }

  function closeSale() {
    setMode("history");
    onSaleModeChange(false);
  }

  function addToCart(product: Product) {
    if (isOutOfStock(product)) return;
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];
      if (existing.quantity >= maximumSaleQuantity(product)) return current;
      return current.map((line) =>
        line.product.id === product.id
          ? { ...line, quantity: line.quantity + 1 }
          : line,
      );
    });
  }

  function changeQuantity(productId: number, delta: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          return {
            ...line,
            quantity: Math.min(
              maximumSaleQuantity(line.product),
              Math.max(0, line.quantity + delta),
            ),
          };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  async function addClient() {
    const phone = normalizePhone(clientDraft.phone);
    if (clientDraft.name.trim().length < 2 || phone.length < 7) {
      setClientError("Indiquez un nom et un numéro de téléphone valide.");
      return;
    }
    setBusy(true);
    setClientError("");
    try {
      const id = await saveClient(
        db,
        { ...clientDraft, phone },
        user,
      );
      const nextClients = await listClients(db);
      setClients(nextClients);
      setSelectedClient(id);
      setNewClientOpen(false);
      setClientDraft({ name: "", phone: "", address: "" });
    } catch (caught) {
      setClientError(
        caught instanceof Error
          ? caught.message
          : "Le client n’a pas pu être créé.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (cart.length === 0) return;
    if (!selectedEmployee) {
      Alert.alert(
        "Employé requis",
        "Choisissez la personne qui a traité cette vente.",
      );
      return;
    }
    setBusy(true);
    try {
      const order = await createOrder(
        db,
        cart,
        selectedClient,
        payment,
        selectedEmployee,
        user,
      );
      setCart([]);
      setCheckoutOpen(false);
      setSelectedClient(null);
      setPayment("cash");
      await load();
      void refreshOperationalNotifications(db).catch(() => undefined);
      let printWarning = "";
      if (await isAutoPrintEnabled(db)) {
        try {
          await printOrderTicket(db, order.id);
        } catch {
          printWarning =
            "\n\nLa vente est enregistrée, mais Android n’a pas pu ouvrir l’impression.";
        }
      }
      closeSale();
      Alert.alert(
        "Commande encaissée",
        `${order.order_number}\n${formatMoney(order.total)} · ${
          order.payment_method === "cash"
            ? "Espèces"
            : order.payment_method === "card"
              ? "Carte"
              : "Mobile Money"
        }${printWarning}`,
      );
    } catch (caught) {
      Alert.alert(
        "Encaissement impossible",
        caught instanceof Error
          ? caught.message
          : "La commande n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (mode === "history") {
    return (
      <Page
        action={
          <AppButton
            icon="Plus"
            label={cart.length ? "Reprendre la vente" : "Nouvelle vente"}
            onPress={openSale}
          />
        }
        description="Toutes les commandes encaissées sur cette tablette."
        title="Commandes"
      >
        {orders.length === 0 ? (
          <EmptyState
            action={
              <AppButton
                icon="ShoppingCart"
                label="Créer une vente"
                onPress={openSale}
              />
            }
            icon="Receipt"
            message="Les commandes apparaîtront ici avec le client, le caissier et le moyen de paiement."
            title="Aucune commande enregistrée"
          />
        ) : (
          <View style={styles.historyTable}>
            <View style={styles.historyHead}>
              <Text style={[styles.headCell, styles.orderColumn]}>Commande</Text>
              <Text style={[styles.headCell, styles.flexColumn]}>Client</Text>
              <Text style={[styles.headCell, styles.flexColumn]}>Traité par</Text>
              <Text style={[styles.headCell, styles.methodColumn]}>Paiement</Text>
              <Text style={[styles.headCell, styles.totalColumn]}>Total</Text>
            </View>
            {orders.map((order) => (
              <View key={order.id} style={styles.historyRow}>
                <View style={styles.orderColumn}>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                  <Text style={styles.orderDate}>
                    {formatDateTime(order.created_at)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[styles.cell, styles.flexColumn]}>
                  {order.client_name ?? "Client de passage"}
                </Text>
                <View style={styles.flexColumn}>
                  <Text numberOfLines={1} style={styles.cell}>
                    {order.employee_name ?? order.user_name}
                  </Text>
                  <Text numberOfLines={1} style={styles.employeeMeta}>
                    Compte : {order.user_name}
                  </Text>
                </View>
                <View style={styles.methodColumn}>
                  <Badge
                    label={
                      order.payment_method === "cash"
                        ? "Espèces"
                        : order.payment_method === "card"
                          ? "Carte"
                          : "Mobile Money"
                    }
                    tone="success"
                  />
                </View>
                <Text style={[styles.total, styles.totalColumn]}>
                  {formatMoney(order.total)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    );
  }

  const stackedSale = width < 820;
  const columns = width >= 700 ? 2 : 1;

  return (
    <View style={styles.saleScreen}>
      <View style={styles.saleHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retourner à l’historique des ventes"
          onPress={closeSale}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Icon name="ArrowLeft" size={22} color={colors.ink} />
          <Text numberOfLines={1} style={styles.backButtonText}>
            Retour
          </Text>
        </Pressable>
        <View style={styles.saleHeading}>
          <Text style={styles.saleTitle}>Nouvelle vente</Text>
          <Text numberOfLines={1} style={styles.saleSubtitle}>
            Touchez un produit pour l’ajouter au panier.
          </Text>
        </View>
        {!stackedSale ? (
          <View style={styles.saleSummary}>
            <Text style={styles.saleSummaryCount}>{unitCount} article(s)</Text>
            <Text style={styles.saleSummaryTotal}>{formatMoney(total)}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.saleBody, stackedSale && styles.saleBodyStacked]}>
        <View style={styles.catalog}>
          <View style={styles.catalogHeader}>
            <View>
              <Text style={styles.catalogTitle}>Produits</Text>
              <Text style={styles.catalogCount}>
                {filtered.length} disponible(s)
              </Text>
            </View>
            {search ? (
              <Badge label={`${filtered.length} résultat(s)`} tone="accent" />
            ) : null}
          </View>
          <SearchField
            onChangeText={setSearch}
            placeholder="Rechercher un produit, une catégorie ou un code"
            value={search}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon="Package"
              message={
                products.length
                  ? "Modifiez la recherche pour retrouver un produit."
                  : "Le Propriétaire ou le Gérant doit d’abord ajouter des produits."
              }
              title={products.length ? "Aucun résultat" : "Aucun produit"}
            />
          ) : (
            <FlatList
              columnWrapperStyle={
                columns > 1 ? styles.productColumns : undefined
              }
              contentContainerStyle={styles.productList}
              data={filtered}
              key={columns}
              keyExtractor={(item) => String(item.id)}
              numColumns={columns}
              renderItem={({ item }) => {
                const inCart =
                  cart.find((line) => line.product.id === item.id)?.quantity ?? 0;
                const stockIsTracked = tracksStock(item);
                const unavailable = isOutOfStock(item);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${item.name}`}
                    accessibilityState={{ disabled: unavailable }}
                    disabled={unavailable}
                    onPress={() => addToCart(item)}
                    style={({ pressed }) => [
                      styles.productCard,
                      unavailable && styles.productDisabled,
                      pressed && styles.productPressed,
                    ]}
                  >
                    <View style={styles.productTop}>
                      <View style={styles.productVisual}>
                        <Icon
                          name="Package"
                          size={28}
                          color={unavailable ? colors.faint : colors.accent}
                        />
                        {inCart ? (
                          <View style={styles.inCart}>
                            <Text style={styles.inCartText}>{inCart}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Badge
                        label={
                          unavailable
                            ? "Rupture"
                            : !stockIsTracked
                              ? "Stock illimité"
                              : isLowStock(item)
                              ? `Stock bas · ${item.stock}`
                              : `${item.stock} en stock`
                        }
                        tone={
                          unavailable
                            ? "danger"
                            : isLowStock(item)
                              ? "warning"
                              : "neutral"
                        }
                      />
                    </View>
                    <View style={styles.productCopy}>
                      <Text numberOfLines={2} style={styles.productName}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.productCategory}>
                        {item.category}
                        {item.sku ? ` · ${item.sku}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.productPrice}>
                      {formatMoney(item.price)}
                    </Text>
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
              style={styles.productListView}
            />
          )}
        </View>

        <View style={[styles.cart, stackedSale && styles.cartStacked]}>
          <View style={styles.cartHeader}>
            <View>
              <Text style={styles.cartTitle}>Commande en cours</Text>
              <Text style={styles.cartCount}>{unitCount} article(s)</Text>
            </View>
            {cart.length ? (
              <AppButton
                compact
                label="Vider"
                onPress={() => setCart([])}
                tone="ghost"
              />
            ) : null}
          </View>
          <ScrollView
            contentContainerStyle={styles.cartLines}
            showsVerticalScrollIndicator={false}
            style={styles.cartScroll}
          >
            {cart.length === 0 ? (
              <EmptyState
                icon="ShoppingBasket"
                message="Touchez un produit pour commencer."
                title="La commande est vide"
              />
            ) : (
              cart.map((line) => (
                <View key={line.product.id} style={styles.cartLine}>
                  <View style={styles.cartLineCopy}>
                    <Text numberOfLines={1} style={styles.cartLineName}>
                      {line.product.name}
                    </Text>
                    <Text style={styles.cartLinePrice}>
                      {formatMoney(line.product.price)} l’unité
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer un ${line.product.name}`}
                      onPress={() => changeQuantity(line.product.id, -1)}
                      style={styles.stepButton}
                    >
                      <Icon
                        name={line.quantity === 1 ? "Trash2" : "Minus"}
                        size={18}
                        color={
                          line.quantity === 1 ? colors.error : colors.ink2
                        }
                      />
                    </Pressable>
                    <Text style={styles.quantity}>{line.quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ajouter un ${line.product.name}`}
                      disabled={
                        line.quantity >= maximumSaleQuantity(line.product)
                      }
                      onPress={() => changeQuantity(line.product.id, 1)}
                      style={[
                        styles.stepButton,
                        line.quantity >= maximumSaleQuantity(line.product) &&
                          styles.stepButtonDisabled,
                      ]}
                    >
                      <Icon name="Plus" size={18} color={colors.ink2} />
                    </Pressable>
                  </View>
                  <Text style={styles.lineTotal}>
                    {formatMoney(line.product.price * line.quantity)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.cartFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total à payer</Text>
              <Text style={styles.grandTotal}>{formatMoney(total)}</Text>
            </View>
            <AppButton
              disabled={cart.length === 0}
              fullWidth
              icon="CreditCard"
              label="Encaisser"
              onPress={() => setCheckoutOpen(true)}
            />
          </View>
        </View>
      </View>

      <ModalSheet
        onClose={() => setCheckoutOpen(false)}
        subtitle={`${unitCount} article(s) · ${formatMoney(total)}`}
        title="Finaliser l’encaissement"
        visible={checkoutOpen}
      >
        <Text style={styles.modalLabel}>Employé ayant traité la vente</Text>
        {employees.length ? (
          <ScrollView
            horizontal
            contentContainerStyle={styles.clientChoices}
            showsHorizontalScrollIndicator={false}
          >
            {employees.map((employee) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  selected: selectedEmployee === employee.id,
                }}
                key={employee.id}
                onPress={() => setSelectedEmployee(employee.id)}
                style={[
                  styles.choice,
                  selectedEmployee === employee.id && styles.choiceActive,
                ]}
              >
                <Icon
                  name="IdCard"
                  size={20}
                  color={
                    selectedEmployee === employee.id
                      ? colors.accent
                      : colors.muted
                  }
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.choiceText,
                    selectedEmployee === employee.id &&
                      styles.choiceTextActive,
                  ]}
                >
                  {employee.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.employeeWarning}>
            <Icon name="CircleAlert" size={20} color={colors.warning} />
            <Text style={styles.employeeWarningText}>
              Ajoutez d’abord un employé depuis la section Employés.
            </Text>
          </View>
        )}

        <Text style={styles.modalLabel}>Client</Text>
        <ScrollView
          horizontal
          contentContainerStyle={styles.clientChoices}
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setSelectedClient(null)}
            style={[
              styles.choice,
              selectedClient === null && styles.choiceActive,
            ]}
          >
            <Icon
              name="Footprints"
              size={20}
              color={
                selectedClient === null ? colors.accent : colors.muted
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.choiceText,
                selectedClient === null && styles.choiceTextActive,
              ]}
            >
              Client de passage
            </Text>
          </Pressable>
          {clients.map((client) => (
            <Pressable
              key={client.id}
              onPress={() => setSelectedClient(client.id)}
              style={[
                styles.choice,
                selectedClient === client.id && styles.choiceActive,
              ]}
            >
              <Icon
                name="User"
                size={20}
                color={
                  selectedClient === client.id ? colors.accent : colors.muted
                }
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.choiceText,
                  selectedClient === client.id && styles.choiceTextActive,
                ]}
              >
                {client.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <AppButton
          compact
          icon="UserPlus"
          label="Créer un client"
          onPress={() => setNewClientOpen(true)}
          tone="secondary"
        />

        <Text style={styles.modalLabel}>Moyen de paiement</Text>
        <View style={styles.paymentChoices}>
          {(
            [
              ["cash", "Banknote", "Espèces"],
              ["mobile_money", "Smartphone", "Mobile Money"],
              ["card", "CreditCard", "Carte"],
            ] as const
          )
            .filter(([value]) => acceptedPayments.includes(value))
            .map(([value, icon, label]) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: payment === value }}
              key={value}
              onPress={() => setPayment(value)}
              style={[
                styles.paymentChoice,
                payment === value && styles.paymentActive,
              ]}
            >
              <Icon
                name={icon}
                size={24}
                color={payment === value ? colors.accent : colors.ink2}
              />
              <Text
                style={[
                  styles.paymentText,
                  payment === value && styles.paymentTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.checkoutTotal}>
          <Text style={styles.totalLabel}>Montant</Text>
          <Text style={styles.checkoutAmount}>{formatMoney(total)}</Text>
        </View>
        <AppButton
          disabled={!selectedEmployee}
          fullWidth
          icon="CircleCheck"
          label="Confirmer l’encaissement"
          loading={busy}
          onPress={() => void pay()}
        />
      </ModalSheet>

      <ModalSheet
        onClose={() => setNewClientOpen(false)}
        subtitle="Le client sera sélectionné pour la commande en cours."
        title="Nouveau client"
        visible={newClientOpen}
        width={500}
      >
        <TextField
          label="Nom complet"
          onChangeText={(name) => setClientDraft((value) => ({ ...value, name }))}
          placeholder="Ex. Chantal Ilunga"
          value={clientDraft.name}
        />
        <TextField
          keyboardType="phone-pad"
          label="Téléphone"
          onChangeText={(phone) =>
            setClientDraft((value) => ({ ...value, phone }))
          }
          placeholder="+243 812 345 678"
          value={clientDraft.phone}
        />
        <TextField
          error={clientError || undefined}
          label="Adresse (facultatif)"
          onChangeText={(address) =>
            setClientDraft((value) => ({ ...value, address }))
          }
          placeholder="Commune ou quartier"
          value={clientDraft.address}
        />
        <AppButton
          fullWidth
          icon="UserPlus"
          label="Ajouter le client"
          loading={busy}
          onPress={() => void addClient()}
        />
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  saleScreen: {
    backgroundColor: colors.paper,
    flex: 1,
    gap: space.md,
    padding: space.md,
  },
  saleHeader: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.md,
    minHeight: 76,
    paddingHorizontal: space.md,
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  backButtonPressed: {
    backgroundColor: colors.paper2,
  },
  backButtonText: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  saleHeading: {
    flex: 1,
    minWidth: 0,
  },
  saleTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  saleSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: space.xxs,
  },
  saleSummary: {
    alignItems: "flex-end",
    minWidth: 145,
  },
  saleSummaryCount: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  saleSummaryTotal: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    marginTop: space.xxs,
  },
  saleBody: {
    flex: 1,
    flexDirection: "row",
    gap: space.md,
    minHeight: 0,
  },
  saleBodyStacked: {
    flexDirection: "column",
  },
  catalog: {
    flex: 1.55,
    gap: space.sm,
    minWidth: 0,
  },
  catalogHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  catalogTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
  },
  catalogCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: space.xxs,
  },
  productList: {
    gap: space.sm,
    paddingBottom: space.lg,
  },
  productListView: {
    flex: 1,
    minHeight: 0,
  },
  productColumns: {
    gap: space.sm,
  },
  productCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: space.md,
    justifyContent: "space-between",
    minHeight: 200,
    padding: space.md,
  },
  productPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  productDisabled: {
    opacity: 0.52,
  },
  productTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  productVisual: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    height: 56,
    justifyContent: "center",
    position: "relative",
    width: 56,
  },
  inCart: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    height: 24,
    justifyContent: "center",
    minWidth: 24,
    paddingHorizontal: space.xxs,
    position: "absolute",
    right: -8,
    top: -8,
  },
  inCartText: {
    color: colors.accentInk,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    lineHeight: 25,
  },
  productCategory: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: space.xxs,
  },
  productPrice: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 21,
    fontVariant: ["tabular-nums"],
  },
  cart: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 420,
    minWidth: 360,
    overflow: "hidden",
    width: 380,
  },
  cartStacked: {
    maxWidth: "100%",
    minHeight: 330,
    minWidth: 0,
    width: "100%",
  },
  cartHeader: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: space.md,
  },
  cartScroll: {
    flex: 1,
    minHeight: 0,
  },
  cartTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  cartCount: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  cartLines: {
    flexGrow: 1,
    padding: space.sm,
  },
  cartLine: {
    alignItems: "center",
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    paddingVertical: space.sm,
  },
  cartLineCopy: {
    flex: 1,
    minWidth: 130,
  },
  cartLineName: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  cartLinePrice: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  stepper: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
  },
  stepButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stepButtonDisabled: {
    opacity: 0.32,
  },
  quantity: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 13,
    minWidth: 28,
    textAlign: "center",
  },
  lineTotal: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    width: "100%",
  },
  cartFooter: {
    borderTopColor: colors.rule,
    borderTopWidth: 1,
    gap: space.md,
    padding: space.md,
  },
  totalRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  grandTotal: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 25,
    fontVariant: ["tabular-nums"],
  },
  modalLabel: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  clientChoices: {
    gap: space.xs,
    paddingBottom: space.xs,
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    height: 48,
    maxWidth: 190,
    paddingHorizontal: space.sm,
  },
  choiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    maxWidth: 145,
  },
  choiceTextActive: {
    color: colors.accentDark,
  },
  paymentChoices: {
    flexDirection: "row",
    gap: space.sm,
  },
  paymentChoice: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 64,
    padding: space.md,
  },
  paymentActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  paymentText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  paymentTextActive: {
    color: colors.accentDark,
  },
  checkoutTotal: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: space.md,
  },
  checkoutAmount: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 27,
    fontVariant: ["tabular-nums"],
  },
  historyTable: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  historyHead: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
  },
  historyRow: {
    alignItems: "center",
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 66,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  headCell: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: "uppercase",
  },
  cell: {
    color: colors.ink2,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  employeeMeta: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: space.xxs,
  },
  employeeWarning: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    minHeight: 48,
    paddingHorizontal: space.sm,
  },
  employeeWarningText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  orderColumn: {
    width: 190,
  },
  flexColumn: {
    flex: 1,
    minWidth: 100,
  },
  methodColumn: {
    width: 130,
  },
  totalColumn: {
    textAlign: "right",
    width: 120,
  },
  orderNumber: {
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  orderDate: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: space.xxs,
  },
  total: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
});
