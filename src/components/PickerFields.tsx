import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "./Icon";
import { AppButton } from "./AppButton";
import { ModalSheet } from "./ModalSheet";
import { locale } from "../domain/format";
import {useThemedStyles,  colors, fonts, radius, space } from "../theme";
import { t } from "../i18n";

interface DatePickerFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  onChange: (date: Date) => void;
}

interface TimePickerFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  onChange: (time: Date) => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

function parseDateInput(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const result = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }
  return result;
}

function parseTimeInput(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return new Date(2000, 0, 1, hour, minute, 0, 0);
}

const WEEKDAY_HEADERS = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat(locale(), { weekday: "narrow" }).format(
    new Date(2026, 0, index + 5),
  ),
);

export function DatePickerField({
  label,
  value,
  placeholder,
  error,
  helper,
  onChange,
}: DatePickerFieldProps) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const initial = parseDateInput(value) ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const selected = parseDateInput(value);

  const first = new Date(viewYear, viewMonth, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat(locale(), {
    month: "long",
    year: "numeric",
  }).format(first);

  function shiftMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t(label)}</Text>
      <Pressable
        accessibilityLabel={t(label)}
        accessibilityRole="button"
        onPress={() => {
          setViewYear(selected?.getFullYear() ?? initial.getFullYear());
          setViewMonth(selected?.getMonth() ?? initial.getMonth());
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.inputBox,
          error ? styles.inputBoxError : null,
          pressed && styles.inputBoxPressed,
        ]}
      >
        <Text
          style={[styles.inputText, !value && styles.inputPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder || t(label)}
        </Text>
        <Icon name="CalendarDays" size={18} color={colors.muted} />
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.helper, error ? styles.error : null]}
      >
        {error ? t(error) : helper ? t(helper) : " "}
      </Text>

      <ModalSheet
        onClose={() => setOpen(false)}
        title={t("Choisir une date")}
        visible={open}
        width={360}
      >
        <View style={styles.calendarHeader}>
          <Pressable
            accessibilityLabel="Mois précédent"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => shiftMonth(-1)}
            style={styles.calendarNav}
          >
            <Icon name="ChevronLeft" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.calendarTitle}>{monthLabel}</Text>
          <Pressable
            accessibilityLabel="Mois suivant"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => shiftMonth(1)}
            style={styles.calendarNav}
          >
            <Icon name="ChevronRight" size={20} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.calendarWeek}>
          {WEEKDAY_HEADERS.map((weekday, index) => (
            <Text key={index} style={styles.calendarWeekday}>
              {weekday}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {cells.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.calendarCell} />;
            }
            const date = new Date(viewYear, viewMonth, day, 12);
            const isToday =
              date.toDateString() === today.toDateString();
            const isSelected =
              selected !== null && selected.toDateString() === date.toDateString();
            return (
              <Pressable
                accessibilityRole="button"
                key={index}
                onPress={() => {
                  onChange(date);
                  setOpen(false);
                }}
                style={[
                  styles.calendarCell,
                  isToday && styles.calendarCellToday,
                  isSelected && styles.calendarCellSelected,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDay,
                    isToday && styles.calendarDayToday,
                    isSelected && styles.calendarDaySelected,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <AppButton
          fullWidth
          label="Aujourd’hui"
          onPress={() => {
            onChange(today);
            setOpen(false);
          }}
          tone="secondary"
        />
      </ModalSheet>
    </View>
  );
}

export function TimePickerField({
  label,
  value,
  placeholder,
  error,
  helper,
  onChange,
}: TimePickerFieldProps) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const parsed = parseTimeInput(value);
  const initialHour = parsed?.getHours() ?? new Date().getHours();
  const initialMinute =
    parsed?.getMinutes() ?? Math.ceil(new Date().getMinutes() / 5) * 5;
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 12 }, (_, index) => index * 5);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t(label)}</Text>
      <Pressable
        accessibilityLabel={t(label)}
        accessibilityRole="button"
        onPress={() => {
          const parsedAgain = parseTimeInput(value);
          setHour(parsedAgain?.getHours() ?? new Date().getHours());
          setMinute(
            parsedAgain?.getMinutes() ??
              Math.ceil(new Date().getMinutes() / 5) * 5,
          );
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.inputBox,
          error ? styles.inputBoxError : null,
          pressed && styles.inputBoxPressed,
        ]}
      >
        <Text
          style={[styles.inputText, !value && styles.inputPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder || t(label)}
        </Text>
        <Icon name="Clock" size={18} color={colors.muted} />
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.helper, error ? styles.error : null]}
      >
        {error ? t(error) : helper ? t(helper) : " "}
      </Text>

      <ModalSheet
        onClose={() => setOpen(false)}
        title={t("Choisir une heure")}
        visible={open}
        width={360}
      >
        <View style={styles.timeColumns}>
          <ScrollView
            contentContainerStyle={styles.timeColumn}
            showsVerticalScrollIndicator={false}
          >
            {hours.map((item) => {
              const active = item === hour;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item}
                  onPress={() => setHour(item)}
                  style={[
                    styles.timeOption,
                    active && styles.timeOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      active && styles.timeOptionTextActive,
                    ]}
                  >
                    {pad(item)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView
            contentContainerStyle={styles.timeColumn}
            showsVerticalScrollIndicator={false}
          >
            {minutes.map((item) => {
              const active = item === minute;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item}
                  onPress={() => setMinute(item)}
                  style={[
                    styles.timeOption,
                    active && styles.timeOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      active && styles.timeOptionTextActive,
                    ]}
                  >
                    {pad(item)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.timeActions}>
          <AppButton
            label="Annuler"
            onPress={() => setOpen(false)}
            tone="ghost"
          />
          <AppButton
            icon="Check"
            label="Valider"
            onPress={() => {
              onChange(new Date(2000, 0, 1, hour, minute, 0, 0));
              setOpen(false);
            }}
          />
        </View>
      </ModalSheet>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
  field: {
    alignSelf: "stretch",
    gap: space.xxs,
    minWidth: 0,
  },
  label: {
    color: colors.ink2,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  inputBox: {
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: space.sm,
  },
  inputBoxError: {
    borderColor: colors.error,
  },
  inputBoxPressed: {
    borderColor: colors.accent,
  },
  inputText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputPlaceholder: {
    color: colors.faint,
  },
  helper: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    minHeight: 18,
  },
  error: {
    color: colors.error,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarNav: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  calendarTitle: {
    color: colors.ink,
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    textTransform: "capitalize",
  },
  calendarWeek: {
    flexDirection: "row",
  },
  calendarWeekday: {
    color: colors.muted,
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    paddingVertical: space.xs,
    textAlign: "center",
    width: "14.2857%",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: "14.2857%",
  },
  calendarCellToday: {
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  calendarCellSelected: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  calendarDay: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  calendarDayToday: {
    fontFamily: fonts.bodySemibold,
  },
  calendarDaySelected: {
    color: colors.accentInk,
    fontFamily: fonts.bodySemibold,
  },
  timeColumns: {
    flexDirection: "row",
    gap: space.sm,
    maxHeight: 320,
  },
  timeColumn: {
    gap: space.xxs,
    paddingBottom: space.sm,
  },
  timeOption: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
    height: 42,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: space.sm,
  },
  timeOptionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  timeOptionText: {
    color: colors.ink2,
    fontFamily: fonts.mono,
    fontSize: 15,
  },
  timeOptionTextActive: {
    color: colors.accentDark,
    fontFamily: fonts.bodySemibold,
  },
  timeActions: {
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "flex-end",
  },
});
}