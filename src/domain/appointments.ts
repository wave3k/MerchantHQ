import { locale } from "./format";

export function parseAppointmentDate(
  dateValue: string,
  timeValue: string,
): Date | null {
  const dateMatch = dateValue.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = timeValue.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const [, dayText, monthText, yearText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return null;

  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }
  return result;
}

export function formatAppointmentDate(date: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatAppointmentTime(date: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatReminderDelay(minutes: number): string {
  if (minutes <= 0) return "Aucun rappel";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} jour${days > 1 ? "s" : ""} avant`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} heure${hours > 1 ? "s" : ""} avant`;
  }
  return `${minutes} min avant`;
}
