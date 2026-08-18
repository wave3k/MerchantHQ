import type { SQLiteDatabase } from "expo-sqlite";
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Icon from "../components/Icon";
import { useEffect, useMemo, useState } from "react";

import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { EmptyState, Page, SearchField } from "../components/Page";
import { TextField } from "../components/TextField";
import {
  deleteClient,
  listClients,
  saveClient,
} from "../data/database";
import { scheduleDailySummary } from "../data/notifications";
import { formatDate, formatMoney, normalizePhone } from "../domain/format";
import { userCan } from "../domain/permissions";
import { colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { Client, ClientInput, User } from "../types";

interface ClientsScreenProps {
  db: SQLiteDatabase;
  user: User;
}

const emptyClient: ClientInput = { name: "", phone: "", address: "" };

export function ClientsScreen({ db, user }: ClientsScreenProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState<ClientInput>(emptyClient);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = userCan(user, "clients.manage");

  async function load() {
    setClients(await listClients(db));
  }

  useEffect(() => {
    void load();
  }, [db]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return clients;
    return clients.filter((client) =>
      [client.name, client.phone, client.address ?? ""]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(query),
    );
  }, [clients, search]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyClient);
    setError("");
    setOpen(true);
  }

  function openEdit(client: Client) {
    if (!canManage) return;
    setEditing(client);
    setDraft({
      name: client.name,
      phone: client.phone,
      address: client.address ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function submit() {
    const phone = normalizePhone(draft.phone);
    if (draft.name.trim().length < 2 || phone.length < 7) {
      setError("Indiquez un nom et un numéro de téléphone valide.");
      return;
    }
    setBusy(true);
    try {
      await saveClient(db, { ...draft, phone }, user, editing?.id);
      setOpen(false);
      await load();
      if (!editing) {
        void scheduleDailySummary(db).catch(() => undefined);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La fiche client n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  function requestDelete() {
    if (!editing) return;
    Alert.alert(
      "Supprimer ce client ?",
      `La fiche de ${editing.name} sera supprimée. Ses anciennes commandes resteront enregistrées.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deleteClient(db, editing, user);
                setOpen(false);
                await load();
              } catch (caught) {
                Alert.alert(
                  "Suppression impossible",
                  caught instanceof Error
                    ? caught.message
                    : "La fiche client n’a pas été supprimée.",
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

  return (
    <Page
      action={
        <AppButton
          icon="UserPlus"
          label="Ajouter un client"
          onPress={openCreate}
        />
      }
      description="Coordonnées, historique d’achat et valeur totale par client."
      title="Clients"
    >
      <SearchField
        onChangeText={setSearch}
        placeholder="Rechercher un nom, un numéro ou une adresse"
        value={search}
      />
      {filtered.length === 0 ? (
        <EmptyState
          action={
            clients.length === 0 ? (
              <AppButton
                icon="UserPlus"
                label="Ajouter le premier client"
                onPress={openCreate}
              />
            ) : undefined
          }
          icon="Users"
          message={
            clients.length
              ? "Modifiez la recherche pour retrouver un client."
              : "Les employés peuvent créer une fiche lors d’une nouvelle vente."
          }
          title={clients.length ? "Aucun résultat" : "Aucun client"}
        />
      ) : (
        <View style={styles.grid}>
          {filtered.map((client) => (
            <Pressable
              disabled={!canManage}
              key={client.id}
              onPress={() => openEdit(client)}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {client.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                {canManage ? (
                  <Icon
                    name="Pencil"
                    size={19}
                    color={colors.muted}
                  />
                ) : null}
              </View>
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.name}>
                  {client.name}
                </Text>
                <Text style={styles.phone}>{client.phone}</Text>
                {client.address ? (
                  <Text numberOfLines={1} style={styles.address}>
                    {client.address}
                  </Text>
                ) : null}
              </View>
              <View style={styles.summary}>
                <View>
                  <Text style={styles.summaryLabel}>Commandes</Text>
                  <Text style={styles.summaryValue}>
                    {client.order_count ?? 0}
                  </Text>
                </View>
                <View style={styles.summaryRight}>
                  <Text style={styles.summaryLabel}>Total acheté</Text>
                  <Text style={styles.summaryValue}>
                    {formatMoney(client.total_spent ?? 0)}
                  </Text>
                </View>
              </View>
              <Text style={styles.created}>Ajouté le {formatDate(client.created_at)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ModalSheet
        onClose={() => setOpen(false)}
        subtitle={
          editing
            ? "Les modifications seront enregistrées dans le journal d’activité."
            : "Cette fiche pourra être sélectionnée pendant l’encaissement."
        }
        title={editing ? "Modifier le client" : "Nouveau client"}
        visible={open}
        width={520}
      >
        <TextField
          label="Nom complet"
          onChangeText={(name) => setDraft((value) => ({ ...value, name }))}
          placeholder="Ex. Chantal Ilunga"
          value={draft.name}
        />
        <TextField
          keyboardType="phone-pad"
          label="Téléphone"
          onChangeText={(phone) => setDraft((value) => ({ ...value, phone }))}
          placeholder="+243 812 345 678"
          value={draft.phone}
        />
        <TextField
          error={error || undefined}
          label="Adresse (facultatif)"
          onChangeText={(address) =>
            setDraft((value) => ({ ...value, address }))
          }
          placeholder="Commune ou quartier"
          value={draft.address}
        />
        <View style={styles.actions}>
          {editing && canManage ? (
            <AppButton
              label="Supprimer"
              onPress={requestDelete}
              tone="danger"
            />
          ) : null}
          <View style={styles.grow} />
          <AppButton
            label="Annuler"
            onPress={() => setOpen(false)}
            tone="ghost"
          />
          <AppButton
            icon="Save"
            label="Enregistrer"
            loading={busy}
            onPress={() => void submit()}
          />
        </View>
      </ModalSheet>
    </Page>
  );
}

const styles = StyleSheet.create({
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
    minWidth: 270,
    padding: space.md,
    width: "32%",
  },
  cardPressed: {
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
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: {
    color: colors.accentDark,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  identity: {
    gap: space.xxs,
  },
  name: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
  },
  phone: {
    color: colors.ink2,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  address: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  summary: {
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: space.sm,
  },
  summaryRight: {
    alignItems: "flex-end",
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    marginTop: space.xxs,
  },
  created: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
  },
  grow: {
    flex: 1,
  },
});
