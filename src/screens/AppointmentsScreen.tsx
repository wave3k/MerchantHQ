/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5 */
/* Hallmark · macrostructure: Narrative Workflow · tone: utilitaire · anchor hue: cobalt */
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
import { DatePickerField, TimePickerField } from "../components/PickerFields";
import { TextField } from "../components/TextField";
import {
  listAppointments,
  listClients,
  listProducts,
  saveAppointment,
  saveClient,
  setAppointmentNotificationId,
  updateAppointmentStatus,
} from "../data/database";
import {
  cancelLocalNotification,
  scheduleDailySummary,
  scheduleAppointmentReminder,
} from "../data/notifications";
import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatReminderDelay,
  parseAppointmentDate,
} from "../domain/appointments";
import { formatDateTime, locale, normalizePhone } from "../domain/format";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type {
  Appointment,
  AppointmentStatus,
  Client,
  ClientInput,
  Product,
  User,
} from "../types";

type Filter = "upcoming" | "completed" | "all";

interface AppointmentsScreenProps {
  db: SQLiteDatabase;
  user: User;
}

const emptyClient: ClientInput = { name: "", phone: "", address: "" };
const reminderOptions = [0, 15, 30, 60, 120, 1440] as const;

export function AppointmentsScreen({ db, user }: AppointmentsScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [editorOpen, setEditorOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [clientDraft, setClientDraft] = useState<ClientInput>(emptyClient);
  const [clientError, setClientError] = useState("");
  const [busy, setBusy] = useState(false);
  const split = width >= 980;

  async function load() {
    const [nextAppointments, nextClients, nextProducts] = await Promise.all([
      listAppointments(db),
      listClients(db),
      listProducts(db),
    ]);
    setAppointments(nextAppointments);
    setClients(nextClients);
    setProducts(nextProducts);
  }

  useEffect(() => {
    void load().catch((caught) =>
      Alert.alert(
        "Chargement impossible",
        caught instanceof Error
          ? caught.message
          : "Les rendez-vous n’ont pas pu être chargés.",
      ),
    );
  }, [db]);

  const visibleAppointments = useMemo(() => {
    const current = Date.now();
    if (filter === "completed") {
      return appointments.filter((item) => item.status === "completed");
    }
    if (filter === "upcoming") {
      return appointments.filter(
        (item) =>
          item.status === "scheduled" &&
          new Date(item.scheduled_at).getTime() >= current,
      );
    }
    return appointments;
  }, [appointments, filter]);

  const nextAppointment = appointments.find(
    (item) =>
      item.status === "scheduled" &&
      new Date(item.scheduled_at).getTime() >= Date.now(),
  );

  function openCreate() {
    const proposed = new Date();
    proposed.setMinutes(Math.ceil(proposed.getMinutes() / 15) * 15, 0, 0);
    proposed.setHours(proposed.getHours() + 1);
    setEditing(null);
    setClientId(clients[0]?.id ?? null);
    setProductId(null);
    setDateText(formatAppointmentDate(proposed));
    setTimeText(formatAppointmentTime(proposed));
    setReminderMinutes(60);
    setNotes("");
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(appointment: Appointment) {
    const scheduled = new Date(appointment.scheduled_at);
    setEditing(appointment);
    setClientId(appointment.client_id);
    setProductId(appointment.product_id);
    setDateText(formatAppointmentDate(scheduled));
    setTimeText(formatAppointmentTime(scheduled));
    setReminderMinutes(appointment.reminder_minutes ?? 60);
    setNotes(appointment.notes);
    setFormError("");
    setEditorOpen(true);
  }

  async function submitAppointment() {
    const scheduled = parseAppointmentDate(dateText, timeText);
    if (!clientId) {
      setFormError("Choisissez le client concerné ou créez sa fiche.");
      return;
    }
    if (!scheduled) {
      setFormError("La date ou l’heure est invalide. Utilisez JJ/MM/AAAA et HH:MM.");
      return;
    }
    if (scheduled.getTime() <= Date.now()) {
      setFormError("Le rendez-vous doit être prévu dans le futur.");
      return;
    }
    if (
      reminderMinutes > 0 &&
      scheduled.getTime() - reminderMinutes * 60_000 <= Date.now()
    ) {
      setFormError(
        "Ce délai de rappel est déjà dépassé. Choisissez un délai plus court.",
      );
      return;
    }

    setBusy(true);
    setFormError("");
    try {
      await cancelLocalNotification(editing?.notification_id ?? null);
      const appointment = await saveAppointment(
        db,
        {
          clientId,
          productId,
          scheduledAt: scheduled.toISOString(),
          reminderMinutes,
          notes,
        },
        user,
        editing?.id,
      );
      const notificationId = await scheduleAppointmentReminder(appointment);
      await setAppointmentNotificationId(db, appointment.id, notificationId);
      setEditorOpen(false);
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Le rendez-vous n’a pas pu être enregistré.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createClient() {
    const phone = normalizePhone(clientDraft.phone);
    if (clientDraft.name.trim().length < 2 || phone.length < 7) {
      setClientError("Indiquez un nom et un numéro de téléphone valide.");
      return;
    }
    setBusy(true);
    setClientError("");
    try {
      const id = await saveClient(db, { ...clientDraft, phone }, user);
      setClients(await listClients(db));
      void scheduleDailySummary(db).catch(() => undefined);
      setClientId(id);
      setClientDraft(emptyClient);
      setClientOpen(false);
    } catch (caught) {
      setClientError(
        caught instanceof Error
          ? caught.message
          : "La fiche client n’a pas pu être créée.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(
    appointment: Appointment,
    status: AppointmentStatus,
  ) {
    try {
      await cancelLocalNotification(appointment.notification_id);
      await updateAppointmentStatus(db, appointment, status, user);
      await load();
    } catch (caught) {
      Alert.alert(
        "Modification impossible",
        caught instanceof Error
          ? caught.message
          : "Le statut du rendez-vous n’a pas pu être modifié.",
      );
    }
  }

  return (
    <>
      <Page
        action={
          <AppButton
            icon="CalendarPlus"
            label="Nouveau rendez-vous"
            onPress={openCreate}
          />
        }
        description="Planifiez les visites clients et retrouvez les détails utiles au bon moment."
        title="Rendez-vous"
      >
        <View style={[styles.overview, !split && styles.overviewStacked]}>
          <View style={styles.nextBlock}>
            <Text style={styles.nextLabel}>Prochain passage</Text>
            {nextAppointment ? (
              <>
                <Text style={styles.nextTime}>
                  {formatDateTime(nextAppointment.scheduled_at)}
                </Text>
                <Text style={styles.nextClient}>{nextAppointment.client_name}</Text>
                <Text style={styles.nextDetail}>
                  {nextAppointment.product_name ?? "Aucun produit associé"}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.nextTime}>Aucun</Text>
                <Text style={styles.nextDetail}>
                  La journée n’a pas encore de rendez-vous à venir.
                </Text>
              </>
            )}
          </View>
          <View style={styles.guide}>
            <View style={styles.guideStep}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Choisir ou créer le client</Text>
            </View>
            <View style={styles.guideRule} />
            <View style={styles.guideStep}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>Fixer la date et l’heure</Text>
            </View>
            <View style={styles.guideRule} />
            <View style={styles.guideStep}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>Recevoir le rappel local</Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.filters}
          showsHorizontalScrollIndicator={false}
        >
          {(
            [
              ["upcoming", "À venir"],
              ["completed", "Terminés"],
              ["all", "Tous"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === value }}
              key={value}
              onPress={() => setFilter(value)}
              style={[
                styles.filter,
                filter === value && styles.filterActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.filterText,
                  filter === value && styles.filterTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {visibleAppointments.length === 0 ? (
          <EmptyState
            action={
              filter === "upcoming" ? (
                <AppButton label="Planifier un rendez-vous" onPress={openCreate} />
              ) : undefined
            }
            icon="CalendarDays"
            message={
              filter === "upcoming"
                ? "Planifiez le prochain passage d’un client et la tablette rappellera l’équipe une heure avant."
                : "Aucun rendez-vous ne correspond à ce filtre."
            }
            title="Aucun rendez-vous"
          />
        ) : (
          <View style={styles.timeline}>
            {visibleAppointments.map((appointment) => {
              const scheduled = new Date(appointment.scheduled_at);
              const isScheduled = appointment.status === "scheduled";
              return (
                <View key={appointment.id} style={styles.timelineRow}>
                  <View style={styles.dateColumn}>
                    <Text style={styles.day}>
                      {new Intl.DateTimeFormat(locale(), {
                        day: "2-digit",
                      }).format(scheduled)}
                    </Text>
                    <Text style={styles.month}>
                      {new Intl.DateTimeFormat(locale(), {
                        month: "short",
                      }).format(scheduled)}
                    </Text>
                    <Text style={styles.time}>
                      {formatAppointmentTime(scheduled)}
                    </Text>
                  </View>
                  <View style={styles.appointmentBody}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.appointmentTitleGroup}>
                        <Text style={styles.clientName}>
                          {appointment.client_name}
                        </Text>
                        <Text style={styles.phone}>
                          {appointment.client_phone}
                        </Text>
                      </View>
                      <Badge
                        label={
                          appointment.status === "completed"
                            ? "Terminé"
                            : appointment.status === "cancelled"
                              ? "Annulé"
                              : "Planifié"
                        }
                        tone={
                          appointment.status === "completed"
                            ? "success"
                            : appointment.status === "cancelled"
                              ? "danger"
                              : "accent"
                        }
                      />
                    </View>
                    <View style={styles.detailRow}>
                      <Icon
                        name="Package"
                        size={18}
                        color={colors.muted}
                      />
                      <Text style={styles.detailText}>
                        {appointment.product_name ?? "Produit non précisé"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Icon
                        name={
                          (appointment.reminder_minutes ?? 60) > 0
                            ? "Bell"
                            : "BellOff"
                        }
                        size={18}
                        color={colors.muted}
                      />
                      <Text style={styles.detailText}>
                        {formatReminderDelay(appointment.reminder_minutes ?? 60)}
                      </Text>
                    </View>
                    {appointment.notes ? (
                      <Text style={styles.notes}>{appointment.notes}</Text>
                    ) : null}
                    {isScheduled ? (
                      <View style={styles.actions}>
                        <AppButton
                          compact
                          icon="Pencil"
                          label="Modifier"
                          onPress={() => openEdit(appointment)}
                          tone="secondary"
                        />
                        <AppButton
                          compact
                          icon="Check"
                          label="Terminer"
                          onPress={() =>
                            void changeStatus(appointment, "completed")
                          }
                          tone="secondary"
                        />
                        <AppButton
                          compact
                          label="Annuler"
                          onPress={() =>
                            void changeStatus(appointment, "cancelled")
                          }
                          tone="ghost"
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Page>

      <ModalSheet
        onClose={() => setEditorOpen(false)}
        subtitle="Le produit et le rappel restent facultatifs."
        title={editing ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
        visible={editorOpen}
        width={720}
      >
        <View style={styles.formHeader}>
          <Text style={styles.formLabel}>Client requis</Text>
          <AppButton
            compact
            icon="UserPlus"
            label="Créer un client"
            onPress={() => {
              setClientError("");
              setClientOpen(true);
            }}
            tone="secondary"
          />
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={styles.choiceRow}
          showsHorizontalScrollIndicator={false}
        >
          {clients.map((client) => (
            <Pressable
              key={client.id}
              onPress={() => setClientId(client.id)}
              style={[
                styles.choice,
                clientId === client.id && styles.choiceActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.choiceTitle,
                  clientId === client.id && styles.choiceTitleActive,
                ]}
              >
                {client.name}
              </Text>
              <Text numberOfLines={1} style={styles.choiceDetail}>
                {client.phone}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.formLabel}>Produit facultatif</Text>
        <ScrollView
          horizontal
          contentContainerStyle={styles.choiceRow}
          showsHorizontalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setProductId(null)}
            style={[
              styles.choice,
              productId === null && styles.choiceActive,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.choiceTitle,
                productId === null && styles.choiceTitleActive,
              ]}
            >
              Aucun produit
            </Text>
          </Pressable>
          {products.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => setProductId(product.id)}
              style={[
                styles.choice,
                productId === product.id && styles.choiceActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.choiceTitle,
                  productId === product.id && styles.choiceTitleActive,
                ]}
              >
                {product.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.dateFields, !split && styles.dateFieldsStacked]}>
          <View style={styles.field}>
            <DatePickerField
              label="Date"
              onChange={(date) => setDateText(formatAppointmentDate(date))}
              placeholder="31/12/2026"
              value={dateText}
            />
          </View>
          <View style={styles.field}>
            <TimePickerField
              label="Heure"
              onChange={(time) => setTimeText(formatAppointmentTime(time))}
              placeholder="14:30"
              value={timeText}
            />
          </View>
        </View>
        <Text style={styles.formLabel}>Rappel avant le rendez-vous</Text>
        <ScrollView
          horizontal
          contentContainerStyle={styles.choiceRow}
          showsHorizontalScrollIndicator={false}
        >
          {reminderOptions.map((minutes) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: reminderMinutes === minutes }}
              key={minutes}
              onPress={() => setReminderMinutes(minutes)}
              style={[
                styles.reminderChoice,
                reminderMinutes === minutes && styles.choiceActive,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.choiceTitle,
                  reminderMinutes === minutes && styles.choiceTitleActive,
                ]}
              >
                {formatReminderDelay(minutes)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextField
          label="Notes"
          multiline
          onChangeText={setNotes}
          placeholder="Détails utiles pour l’équipe"
          style={styles.notesInput}
          value={notes}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <AppButton
          fullWidth
          icon="Save"
          label={editing ? "Enregistrer les changements" : "Créer le rendez-vous"}
          loading={busy}
          onPress={() => void submitAppointment()}
        />
      </ModalSheet>

      <ModalSheet
        onClose={() => setClientOpen(false)}
        subtitle="La nouvelle fiche sera sélectionnée dans le rendez-vous."
        title="Créer un client"
        visible={clientOpen}
      >
        <TextField
          label="Nom complet"
          onChangeText={(name) => setClientDraft((value) => ({ ...value, name }))}
          placeholder="Nom du client"
          value={clientDraft.name}
        />
        <TextField
          keyboardType="phone-pad"
          label="Téléphone"
          onChangeText={(phone) =>
            setClientDraft((value) => ({ ...value, phone }))
          }
          placeholder="+243..."
          value={clientDraft.phone}
        />
        <TextField
          label="Adresse"
          onChangeText={(address) =>
            setClientDraft((value) => ({ ...value, address }))
          }
          placeholder="Facultatif"
          value={clientDraft.address ?? ""}
        />
        {clientError ? <Text style={styles.error}>{clientError}</Text> : null}
        <AppButton
          fullWidth
          icon="UserPlus"
          label="Créer et sélectionner"
          loading={busy}
          onPress={() => void createClient()}
        />
      </ModalSheet>
    </>
  );
}

function createStyles() {
  return StyleSheet.create({
  overview: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: space.md,
  },
  overviewStacked: {
    flexDirection: "column",
  },
  nextBlock: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    flex: 0.8,
    gap: space.xxs,
    minHeight: 170,
    padding: space.lg,
  },
  nextLabel: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  nextTime: {
    color: colors.surfaceStrong,
    fontFamily: fonts.display,
    fontSize: 30,
    marginTop: space.sm,
  },
  nextClient: {
    color: colors.surfaceStrong,
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
  },
  nextDetail: {
    color: colors.inkSurfaceText,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  guide: {
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1.2,
    justifyContent: "center",
    padding: space.lg,
  },
  guideStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    minHeight: 44,
  },
  stepNumber: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 15,
    width: 24,
  },
  stepText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  guideRule: {
    backgroundColor: colors.rule,
    height: 16,
    marginLeft: 11,
    width: 1,
  },
  filters: {
    gap: space.xs,
  },
  filter: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: space.md,
  },
  filterActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  filterText: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  filterTextActive: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
  },
  timeline: {
    gap: space.sm,
  },
  timelineRow: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  dateColumn: {
    alignItems: "center",
    backgroundColor: colors.paper2,
    justifyContent: "center",
    minWidth: 98,
    padding: space.md,
  },
  day: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 30,
  },
  month: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textTransform: "uppercase",
  },
  time: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 14,
    marginTop: space.xs,
  },
  appointmentBody: {
    flex: 1,
    gap: space.sm,
    minWidth: 0,
    padding: space.md,
  },
  appointmentHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
  },
  appointmentTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  clientName: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 19,
  },
  phone: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
  },
  detailText: {
    color: colors.ink2,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  notes: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  formHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  formLabel: {
    color: colors.ink2,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  choiceRow: {
    gap: space.xs,
    paddingVertical: space.xxs,
  },
  choice: {
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 150,
    paddingHorizontal: space.sm,
  },
  choiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  choiceTitleActive: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
  },
  choiceDetail: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  reminderChoice: {
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  dateFields: {
    flexDirection: "row",
    gap: space.md,
  },
  dateFieldsStacked: {
    flexDirection: "column",
  },
  field: {
    flex: 1,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  error: {
    color: colors.error,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
});
}
