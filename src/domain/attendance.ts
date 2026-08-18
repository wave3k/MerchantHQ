/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import type { AttendanceStatus } from "../types";

export const attendanceStatuses: readonly AttendanceStatus[] = [
  "present",
  "absent_justified",
  "absent_unjustified",
];

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent_justified: "Absence justifiée",
  absent_unjustified: "Absence non justifiée",
};

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(value: string, days: number): string {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function parseArrivalTime(
  workDate: string,
  time: string,
): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const [year = 0, month = 1, day = 1] = workDate.split("-").map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(result.getTime())) return null;
  return result.toISOString();
}

export function formatArrivalTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
