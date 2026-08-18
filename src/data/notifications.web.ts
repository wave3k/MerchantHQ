import type { SQLiteDatabase } from "expo-sqlite";

import type { Appointment, ScreenKey } from "../types";

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export async function cancelLocalNotification(): Promise<void> {}

export async function scheduleAppointmentReminder(
  _appointment: Appointment,
): Promise<string | null> {
  return null;
}

export async function notifyLowStockChanges(
  _db: SQLiteDatabase,
): Promise<void> {}

export async function scheduleDailySummary(
  _db: SQLiteDatabase,
): Promise<void> {}

export async function refreshOperationalNotifications(
  _db: SQLiteDatabase,
): Promise<void> {}

export async function prepareDeviceNotifications(
  _db: SQLiteDatabase,
): Promise<boolean> {
  return false;
}

export async function sendTestNotification(): Promise<boolean> {
  return false;
}

export function subscribeToNotificationNavigation(
  _onNavigate: (screen: ScreenKey) => void,
): { remove: () => void } {
  return { remove: () => undefined };
}
