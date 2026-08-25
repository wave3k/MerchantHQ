/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/* Hallmark · macrostructure: Workbench · tone: utilitaire doux · anchor hue: framboise */
import Icon from "../components/Icon";
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { AppButton } from "../components/AppButton";
import { ModalSheet } from "../components/ModalSheet";
import { Badge, EmptyState, Page } from "../components/Page";
import { TimePickerField } from "../components/PickerFields";
import { TextField } from "../components/TextField";
import { listAttendanceForDate, saveAttendance } from "../data/database";
import {
  attendanceStatusLabels,
  formatArrivalTime,
  localDateKey,
  parseArrivalTime,
  shiftDateKey,
} from "../domain/attendance";
import { activeLanguage, t } from "../i18n";
import { locale } from "../domain/format";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { TranslatedText as Text } from "../components/TranslatedText";
import type { AttendanceRecord, AttendanceStatus, User } from "../types";

interface AttendanceScreenProps {
  db: SQLiteDatabase;
  user: User;
}

const todayKey = () => localDateKey(new Date());

function workDateLabel(value: string): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function statusTone(status: AttendanceStatus | null) {
  if (status === "present") return "success" as const;
  if (status === "absent_justified") return "warning" as const;
  if (status === "absent_unjustified") return "danger" as const;
  return "neutral" as const;
}

export function AttendanceScreen({ db, user }: AttendanceScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [workDate, setWorkDate] = useState(todayKey);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [arrivalTime, setArrivalTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const twoColumns = width >= 980;

  async function load(date = workDate) {
    setRecords(await listAttendanceForDate(db, date));
  }

  useEffect(() => {
    void load().catch((caught) =>
      Alert.alert(
        "Chargement impossible",
        caught instanceof Error
          ? caught.message
          : "Les présences n’ont pas pu être chargées.",
      ),
    );
  }, [db, workDate]);

  const summary = useMemo(
    () => ({
      present: records.filter((item) => item.status === "present").length,
      justified: records.filter((item) => item.status === "absent_justified").length,
      unjustified: records.filter((item) => item.status === "absent_unjustified").length,
      pending: records.filter((item) => item.status === null).length,
    }),
    [records],
  );

  function openEditor(record: AttendanceRecord, nextStatus?: AttendanceStatus) {
    const chosenStatus = nextStatus ?? record.status ?? "present";
    const current = new Date();
    const defaultTime =
      record.arrival_at
        ? formatArrivalTime(record.arrival_at)
        : workDate === todayKey()
          ? `${String(current.getHours()).padStart(2, "0")}:${String(
              current.getMinutes(),
            ).padStart(2, "0")}`
          : "08:00";
    setSelected(record);
    setStatus(chosenStatus);
    setArrivalTime(defaultTime);
    setNote(record.note ?? "");
    setError("");
  }

  async function submit() {
    if (!selected) return;
    const arrivalAt =
      status === "present" ? parseArrivalTime(workDate, arrivalTime) : null;
    if (status === "present" && !arrivalAt) {
      setError("Utilisez une heure valide au format HH:MM.");
      return;
    }
    if (status === "absent_justified" && note.trim().length < 2) {
      setError("Indiquez la raison de l’absence justifiée.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveAttendance(
        db,
        {
          employeeId: selected.employee_id,
          workDate,
          status,
          arrivalAt,
          note,
        },
        user,
      );
      setSelected(null);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "La présence n’a pas pu être enregistrée.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Page
        description="Pointez les arrivées et gardez un historique clair des absences."
        title="Présences"
      >
        <View style={styles.dateBar}>
          <Pressable
            accessibilityLabel="Jour précédent"
            accessibilityRole="button"
            onPress={() => setWorkDate((value) => shiftDateKey(value, -1))}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Icon name="ChevronLeft" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.dateCopy}>
            <Text style={styles.dateLabel}>{workDateLabel(workDate)}</Text>
            <Text style={styles.dateHint}>
              {workDate === todayKey() ? "Aujourd’hui" : "Historique de la journée"}
            </Text>
          </View>
          <AppButton
            compact
            disabled={workDate === todayKey()}
            label="Aujourd’hui"
            onPress={() => setWorkDate(todayKey())}
            tone="secondary"
          />
          <Pressable
            accessibilityLabel="Jour suivant"
            accessibilityRole="button"
            accessibilityState={{ disabled: workDate === todayKey() }}
            disabled={workDate === todayKey()}
            onPress={() => setWorkDate((value) => shiftDateKey(value, 1))}
            style={({ pressed }) => [
              styles.dateButton,
              workDate === todayKey() && styles.dateButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="ChevronRight" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.summary}>
          {[
            ["Présents", summary.present, colors.success],
            ["Absences justifiées", summary.justified, colors.warning],
            ["Non justifiées", summary.unjustified, colors.error],
            ["À renseigner", summary.pending, colors.muted],
          ].map(([label, value, color]) => (
            <View key={String(label)} style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: String(color) }]}>
                {String(value)}
              </Text>
              <Text style={styles.summaryLabel}>{String(label)}</Text>
            </View>
          ))}
        </View>

        {records.length === 0 ? (
          <EmptyState
            icon="Users"
            message="Ajoutez d’abord les membres du personnel dans la section Employés."
            title="Aucun employé actif"
          />
        ) : (
          <View style={[styles.grid, twoColumns && styles.gridWide]}>
            {records.map((record) => (
              <View
                key={record.employee_id}
                style={[
                  styles.employeeCard,
                  twoColumns && styles.employeeCardWide,
                ]}
              >
                <View style={styles.employeeTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {record.employee_name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.employeeCopy}>
                    <Text numberOfLines={1} style={styles.employeeName}>
                      {record.employee_name}
                    </Text>
                    <Text numberOfLines={1} style={styles.employeePosition}>
                      {record.employee_position}
                    </Text>
                  </View>
                  <Badge
                    label={record.status ? attendanceStatusLabels[record.status] : "À renseigner"}
                    tone={statusTone(record.status)}
                  />
                </View>
                <View style={styles.arrivalRow}>
                  <Icon name="Clock" size={18} color={colors.muted} />
                  <Text style={styles.arrivalText}>
                    {record.status === "present" && record.arrival_at
                      ? `Arrivée à ${formatArrivalTime(record.arrival_at)}`
                      : record.status
                        ? record.note || "Aucun commentaire"
                        : "Touchez pour renseigner la journée"}
                  </Text>
                </View>
                <View style={styles.quickActions}>
                  <AppButton
                    compact
                    label={record.status ? "Modifier" : "Présent"}
                    onPress={() =>
                      openEditor(record, record.status ?? "present")
                    }
                    tone="secondary"
                  />
                  <AppButton
                    compact
                    label="Absent"
                    onPress={() => openEditor(record, "absent_unjustified")}
                    tone="ghost"
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Page>

      <ModalSheet
        onClose={() => !busy && setSelected(null)}
        subtitle={selected ? `${selected.employee_position} · ${workDateLabel(workDate)}` : undefined}
        title={selected?.employee_name ?? "Présence"}
        visible={selected !== null}
        width={620}
      >
        <View style={styles.statusChoices}>
          {(
            [
              ["present", "Présent", "CircleCheck"],
              ["absent_justified", "Absence justifiée", "FileText"],
              ["absent_unjustified", "Absence non justifiée", "CircleAlert"],
            ] as const
          ).map(([value, label, icon]) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: status === value }}
              key={value}
              onPress={() => setStatus(value)}
              style={[styles.statusChoice, status === value && styles.statusChoiceActive]}
            >
              <Icon
                name={icon}
                size={22}
                color={status === value ? colors.accent : colors.muted}
              />
              <Text style={[styles.statusText, status === value && styles.statusTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {status === "present" ? (
          <TimePickerField
            error={error || undefined}
            helper="Format 24 heures, par exemple 08:30."
            label="Heure d’arrivée"
            onChange={(time) => {
              setArrivalTime(formatArrivalTime(time.toISOString()));
              if (error) setError("");
            }}
            placeholder="08:00"
            value={arrivalTime}
          />
        ) : null}
        <TextField
          error={status !== "present" ? error || undefined : undefined}
          helper={
            status === "absent_justified"
              ? "Indiquez la raison ou le justificatif présenté."
              : "Facultatif."
          }
          label="Commentaire"
          multiline
          onChangeText={setNote}
          placeholder="Ajouter une précision"
          style={styles.noteInput}
          value={note}
        />
        <View style={styles.modalActions}>
          <AppButton label="Annuler" onPress={() => setSelected(null)} tone="ghost" />
          <AppButton
            icon="Save"
            label="Enregistrer"
            loading={busy}
            onPress={() => void submit()}
          />
        </View>
      </ModalSheet>
    </>
  );
}

function createStyles() {
  return StyleSheet.create({
  dateBar: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 76,
    padding: space.sm,
  },
  dateButton: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  dateButtonDisabled: { opacity: 0.35 },
  pressed: { backgroundColor: colors.accentSoft },
  dateCopy: { flex: 1, gap: space.xxs, minWidth: 0 },
  dateLabel: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    textTransform: "capitalize",
  },
  dateHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  summary: {
    backgroundColor: colors.paper2,
    borderRadius: radius.md,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  summaryItem: {
    borderRightColor: colors.rule,
    borderRightWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: space.xxs,
    minWidth: 150,
    padding: space.md,
  },
  summaryValue: { fontFamily: fonts.display, fontSize: 30 },
  summaryLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  grid: { gap: space.sm },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  employeeCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.rule,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    padding: space.md,
  },
  employeeCardWide: { flexBasis: "48%", flexGrow: 1, minWidth: 390 },
  employeeTop: { alignItems: "center", flexDirection: "row", gap: space.sm },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.round,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: { color: colors.accent, fontFamily: fonts.display, fontSize: 17 },
  employeeCopy: { flex: 1, minWidth: 0 },
  employeeName: { color: colors.ink, fontFamily: fonts.bodySemibold, fontSize: 16 },
  employeePosition: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  arrivalRow: { alignItems: "center", flexDirection: "row", gap: space.xs },
  arrivalText: { color: colors.ink2, flex: 1, fontFamily: fonts.body, fontSize: 14 },
  quickActions: { flexDirection: "row", gap: space.xs, justifyContent: "flex-end" },
  statusChoices: { gap: space.xs },
  statusChoice: {
    alignItems: "center",
    borderColor: colors.rule,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.sm,
  },
  statusChoiceActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  statusText: { color: colors.ink2, fontFamily: fonts.bodyMedium, fontSize: 14 },
  statusTextActive: { color: colors.accentDark },
  noteInput: { minHeight: 88, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: space.sm, justifyContent: "flex-end" },
});
}
