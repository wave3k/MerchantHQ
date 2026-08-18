import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import { formatReminderDelay } from "../domain/appointments";
import { formatMoney } from "../domain/format";
import { isLowStock } from "../domain/stock";
import type { Appointment, ScreenKey } from "../types";
import {
  getDashboardStats,
  listAppointments,
  listProducts,
  setAppointmentNotificationId,
} from "./database";

const CHANNEL_ID = "default";
const DAILY_SUMMARY_KEY = "daily_summary_notification_id";
const LOW_STOCK_SIGNATURE_KEY = "low_stock_signature";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Alertes boutique",
    description: "Rendez-vous, stock à surveiller et résumé de la journée.",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
  });
}

export async function ensureNotificationPermission(
  requestIfNeeded = false,
): Promise<boolean> {
  await ensureChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted" && requestIfNeeded) {
    permission = await Notifications.requestPermissionsAsync();
  }
  return permission.status === "granted";
}

async function getInternalSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

async function setInternalSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function cancelLocalNotification(
  notificationId: string | null,
): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Une notification déjà affichée ou retirée n’a plus besoin d’être annulée.
  }
}

export async function scheduleAppointmentReminder(
  appointment: Appointment,
): Promise<string | null> {
  const reminderMinutes = appointment.reminder_minutes ?? 60;
  if (reminderMinutes <= 0) return null;
  if (!(await ensureNotificationPermission(false))) return null;
  const reminderAt = new Date(
    new Date(appointment.scheduled_at).getTime() - reminderMinutes * 60_000,
  );
  if (reminderAt.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Rendez-vous dans ${formatReminderDelay(reminderMinutes).replace(" avant", "")}`,
      body: appointment.product_name
        ? `${appointment.client_name} · ${appointment.product_name}`
        : appointment.client_name,
      data: { screen: "appointments", appointmentId: appointment.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderAt,
      channelId: CHANNEL_ID,
    },
  });
}

export async function notifyLowStockChanges(
  db: SQLiteDatabase,
): Promise<void> {
  if (!(await ensureNotificationPermission(false))) return;
  const products = (await listProducts(db)).filter(isLowStock);
  const signature = products
    .map((product) => `${product.id}:${product.stock}`)
    .sort()
    .join(",");
  const previous = await getInternalSetting(db, LOW_STOCK_SIGNATURE_KEY);
  if (signature === previous) return;
  await setInternalSetting(db, LOW_STOCK_SIGNATURE_KEY, signature);
  if (products.length === 0) return;

  const visible = products
    .slice(0, 3)
    .map((product) => `${product.name}: ${product.stock}`)
    .join(" · ");
  const remaining =
    products.length > 3
      ? ` · +${products.length - 3} autre${products.length - 3 > 1 ? "s" : ""}`
      : "";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Stock à surveiller",
      body: `${visible}${remaining}`,
      data: { screen: "products" },
    },
    trigger: null,
  });
}

export async function scheduleDailySummary(
  db: SQLiteDatabase,
): Promise<void> {
  if (!(await ensureNotificationPermission(false))) return;
  await cancelLocalNotification(await getInternalSetting(db, DAILY_SUMMARY_KEY));

  const current = new Date();
  const target = new Date(current);
  target.setHours(19, 0, 0, 0);
  const isToday = target.getTime() > current.getTime();
  if (!isToday) target.setDate(target.getDate() + 1);

  const stats = await getDashboardStats(db);
  const body = isToday
    ? `${stats.ordersToday} vente${stats.ordersToday > 1 ? "s" : ""} · ${formatMoney(
        stats.revenueToday,
      )} · ${stats.newClientsToday} nouveau${
        stats.newClientsToday > 1 ? "x" : ""
      } client${stats.newClientsToday > 1 ? "s" : ""}.`
    : "Ouvrez Statistiques pour consulter les ventes et les performances du jour.";
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Résumé de la journée",
      body,
      data: { screen: "home_dashboard" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
      channelId: CHANNEL_ID,
    },
  });
  await setInternalSetting(db, DAILY_SUMMARY_KEY, notificationId);
}

export async function refreshOperationalNotifications(
  db: SQLiteDatabase,
): Promise<void> {
  await Promise.all([
    notifyLowStockChanges(db),
    scheduleDailySummary(db),
  ]);
}

async function refreshAppointmentReminders(
  db: SQLiteDatabase,
): Promise<void> {
  const appointments = await listAppointments(db);
  const missingReminders = appointments.filter(
    (appointment) =>
      appointment.status === "scheduled" &&
      (appointment.reminder_minutes ?? 60) > 0 &&
      !appointment.notification_id &&
      new Date(appointment.scheduled_at).getTime() > Date.now(),
  );
  for (const appointment of missingReminders) {
    const notificationId = await scheduleAppointmentReminder(appointment);
    await setAppointmentNotificationId(db, appointment.id, notificationId);
  }
}

export async function prepareDeviceNotifications(
  db: SQLiteDatabase,
): Promise<boolean> {
  const granted = await ensureNotificationPermission(true);
  if (!granted) return false;
  await Promise.all([
    refreshOperationalNotifications(db),
    refreshAppointmentReminders(db),
  ]);
  return true;
}

export async function sendTestNotification(): Promise<boolean> {
  const granted = await ensureNotificationPermission(true);
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Notifications activées",
      body: "Cette tablette recevra les rappels de rendez-vous et les alertes boutique.",
      data: { screen: "appointments" },
    },
    trigger: null,
  });
  return true;
}

export function subscribeToNotificationNavigation(
  onNavigate: (screen: ScreenKey) => void,
): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = response.notification.request.content.data?.screen;
    if (
      screen === "home_dashboard" ||
      screen === "home_caisse" ||
      screen === "home_boutique" ||
      screen === "statistics" ||
      screen === "orders" ||
      screen === "products" ||
      screen === "clients" ||
      screen === "appointments" ||
      screen === "team" ||
      screen === "logs" ||
      screen === "settings"
    ) {
      onNavigate(screen);
    }
  });
}
