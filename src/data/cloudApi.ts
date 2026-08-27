import type { SQLiteDatabase } from "expo-sqlite";

import { APP_VERSION, BACKUP_FORMAT_VERSION } from "../appInfo";
import {
  createBackupPayload,
  emptyBackupPayload,
  restoreBackupForShop,
  restoreBackupPayload,
  type BackupFile,
} from "./backup";
import { dueBusinessDate, manualBusinessDate, shouldOfferRemoteRestore } from "../domain/cloudBackup";
import { getDeviceId, getSession, getWorkerUrl, saveSession, type CloudSession } from "./cloudSession";
import { getCurrentShopId } from "./shopContext";

const LAST_SUCCESS_DATE_KEY = "cloud_backup_last_success_date";
const LAST_SUCCESS_AT_KEY = "cloud_backup_last_success_at";
const PENDING_DATE_KEY = "cloud_backup_pending_date";
const LAST_ERROR_KEY = "cloud_backup_last_error";
const LAST_RESTORED_BACKUP_ID_KEY = "cloud_restore_last_backup_id";
const LAST_RESTORED_AT_KEY = "cloud_restore_last_snapshot_at";

export const CLOUD_ACCOUNT_ID_KEY = "cloud_account_id";
export const APP_SETUP_COMPLETE_KEY = "app_setup_complete";

export interface CloudBackupUpdate {
  backupId: string;
  accountId: string;
  deviceId: string;
  businessDate: string;
  snapshotAt: string;
  appVersion: string;
  schemaVersion: number;
}

export interface CloudBackupStatus {
  configured: boolean;
  username: string | null;
  lastSuccessDate: string | null;
  lastSuccessAt: string | null;
  pendingDate: string | null;
  lastError: string | null;
}

export interface CloudBackupResult extends CloudBackupStatus {
  outcome: "synced" | "not_due" | "not_configured" | "pending" | "remote_newer";
}

interface AccountStatus {
  has_data: boolean;
  last_backup_at: string | null;
  last_backup_business_date: string | null;
}

async function readState(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

async function writeState(
  db: SQLiteDatabase,
  key: string,
  value: string | null,
): Promise<void> {
  if (value === null) {
    await db.runAsync("DELETE FROM settings WHERE key = ?", key);
    return;
  }
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function setAppSetupComplete(db: SQLiteDatabase, done: boolean): Promise<void> {
  await writeState(db, APP_SETUP_COMPLETE_KEY, done ? "1" : "0");
}

export async function isAppSetupComplete(db: SQLiteDatabase): Promise<boolean> {
  return (await readState(db, APP_SETUP_COMPLETE_KEY)) === "1";
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(
  url: string,
  init: RequestInit,
  opts: { attempts?: number; timeoutMs?: number } = {},
): Promise<{ status: number; body: unknown }> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const timeoutMs = Math.max(3_000, opts.timeoutMs ?? 12_000);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { status: res.status, body };
      }
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        return { status: res.status, body };
      }
    } catch (caught) {
      lastError = caught;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < attempts) await wait(450 * attempt);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Connexion au service de sauvegarde impossible.");
}

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    return String((body as { error: unknown }).error);
  }
  return fallback;
}

async function apiBase(): Promise<string> {
  const url = await getWorkerUrl();
  if (!url) throw new Error("Service de sauvegarde non configuré.");
  return url.replace(/\/+$/, "");
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

function safeError(body: unknown, fallback: string): string {
  const raw = messageOf(body, fallback);
  if (!raw) return fallback;
  const trimmed = raw.trim().slice(0, 160);
  if (/sqlite|syntax error|traceback|at \w+ \(/i.test(trimmed)) return fallback;
  return trimmed;
}

// --- Comptes ---
export async function registerAccount(
  username: string,
  password: string,
  shopName: string,
): Promise<CloudSession> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, shop_name: shopName }),
  });
  const data = body as { ok?: boolean; account?: { account_id?: string; username?: string; shop_name?: string; token?: string } };
  if (status >= 400 || !data?.ok || !data.account?.account_id) {
    throw new Error(safeError(body, "Création du compte impossible."));
  }
  const session: CloudSession = {
    accountId: data.account.account_id,
    username: data.account.username ?? username,
    shopName: data.account.shop_name ?? shopName,
    token: data.account.token,
  };
  await saveSession(session);
  return session;
}

export async function loginAccount(username: string, password: string): Promise<CloudSession> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = body as { ok?: boolean; account?: { account_id?: string; username?: string; shop_name?: string; token?: string } };
  if (status >= 400 || !data?.ok || !data.account?.account_id) {
    throw new Error(safeError(body, "Connexion impossible."));
  }
  const session: CloudSession = {
    accountId: data.account.account_id,
    username: data.account.username ?? username,
    shopName: data.account.shop_name ?? "Ma boutique",
    token: data.account.token,
  };
  await saveSession(session);
  return session;
}

export async function getAccountStatus(accountId: string): Promise<AccountStatus | null> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/accounts/status?account_id=${encodeURIComponent(accountId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 2, timeoutMs: 8_000 },
  );
  if (status !== 200) return null;
  const data = body as { status?: AccountStatus };
  return data.status ?? null;
}

// --- Boutiques ---
export async function getCloudShops(session: CloudSession): Promise<Array<{ shop_id: string; name: string }>> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/shops?account_id=${encodeURIComponent(session.accountId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 2, timeoutMs: 8_000 },
  );
  if (status !== 200) return [];
  const data = body as { shops?: Array<{ shop_id: string; name: string }> };
  return data.shops ?? [];
}

export async function createCloudShop(
  session: CloudSession,
  name: string,
): Promise<{ shop_id: string; name: string }> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/shops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ account_id: session.accountId, name }),
  });
  const data = body as { ok?: boolean; shop?: { shop_id: string; name: string } };
  if (status >= 400 || !data?.ok || !data.shop) {
    throw new Error(safeError(body, "Création de la boutique impossible."));
  }
  return data.shop;
}

export async function renameCloudShop(
  session: CloudSession,
  shopId: string,
  name: string,
): Promise<void> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/shops/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ account_id: session.accountId, shop_id: shopId, name }),
  });
  if (status >= 400) {
    throw new Error(safeError(body, "Renommage de la boutique impossible."));
  }
}

// --- Sauvegardes ---
async function getLatestRemoteBackup(accountId: string, shopId: string): Promise<CloudBackupUpdate | null> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/backups/latest?account_id=${encodeURIComponent(accountId)}&shop_id=${encodeURIComponent(shopId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 2, timeoutMs: 8_000 },
  );
  if (status !== 200) return null;
  const data = body as { backup?: Omit<CloudBackupUpdate, "accountId"> };
  const b = data.backup;
  if (!b?.backupId) return null;
  return {
    backupId: b.backupId,
    accountId,
    deviceId: b.deviceId,
    businessDate: b.businessDate,
    snapshotAt: b.snapshotAt,
    appVersion: b.appVersion,
    schemaVersion: b.schemaVersion,
  };
}

async function getBackupPayload(accountId: string, shopId: string, backupId: string): Promise<string> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/backups/${encodeURIComponent(backupId)}?account_id=${encodeURIComponent(accountId)}&shop_id=${encodeURIComponent(shopId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 3, timeoutMs: 15_000 },
  );
  const data = body as { payload?: string };
  if (status !== 200 || !data.payload) {
    throw new Error(safeError(body, "La sauvegarde sélectionnée n’existe plus."));
  }
  return data.payload;
}

export async function getRemoteBackupMetadata(
  session: CloudSession,
): Promise<CloudBackupUpdate | null> {
  const shopId = getCurrentShopId() ?? "";
  return getLatestRemoteBackup(session.accountId, shopId).catch(() => null);
}

export async function getLocalDataAt(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(`
    SELECT MAX(value) AS value FROM (
      SELECT MAX(updated_at) AS value FROM employees
      UNION ALL SELECT MAX(updated_at) FROM attendance_records
      UNION ALL SELECT MAX(updated_at) FROM products
      UNION ALL SELECT MAX(updated_at) FROM clients
      UNION ALL SELECT MAX(updated_at) FROM appointments
      UNION ALL SELECT MAX(created_at) FROM orders
      UNION ALL SELECT MAX(created_at) FROM activity_logs
      UNION ALL SELECT MAX(created_at) FROM expenses
    )
  `);
  return row?.value ?? null;
}

export async function getCloudBackupUpdate(
  db: SQLiteDatabase,
  session: CloudSession,
): Promise<CloudBackupUpdate | null> {
  const shopId = getCurrentShopId() ?? "";
  const [remote, deviceId, lastRestoredBackupId, localDataAt] = await Promise.all([
    getLatestRemoteBackup(session.accountId, shopId).catch(() => null),
    getDeviceId(),
    readState(db, LAST_RESTORED_BACKUP_ID_KEY),
    getLocalDataAt(db),
  ]);
  if (
    !remote ||
    !shouldOfferRemoteRestore({
      remoteBackupId: remote.backupId,
      remoteDeviceId: remote.deviceId,
      remoteSnapshotAt: remote.snapshotAt,
      currentDeviceId: deviceId,
      lastRestoredBackupId,
      localDataAt,
    })
  ) {
    return null;
  }
  return remote;
}

export async function restoreCloudBackup(
  db: SQLiteDatabase,
  update: CloudBackupUpdate,
): Promise<BackupFile> {
  if (update.schemaVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Cette copie vient d’une version plus récente (${update.appVersion}). Mettez MerchantHQ à jour.`,
    );
  }
  const payload = await getBackupPayload(update.accountId, getCurrentShopId() ?? "", update.backupId);
  const restored = await restoreBackupForShop(db, JSON.parse(payload));
  await writeState(db, LAST_RESTORED_BACKUP_ID_KEY, update.backupId);
  await writeState(db, LAST_RESTORED_AT_KEY, update.snapshotAt);
  await writeState(db, PENDING_DATE_KEY, null);
  await writeState(db, LAST_ERROR_KEY, null);
  return restored;
}

export async function resetLocalData(db: SQLiteDatabase): Promise<void> {
  await restoreBackupPayload(db, emptyBackupPayload());
}

export async function hasLocalBusinessData(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(`
    SELECT
      (SELECT COUNT(*) FROM users) +
      (SELECT COUNT(*) FROM products) +
      (SELECT COUNT(*) FROM orders) +
      (SELECT COUNT(*) FROM clients) +
      (SELECT COUNT(*) FROM expenses) AS count
  `);
  return (row?.count ?? 0) > 0;
}

// --- Statut local ---
export async function getCloudBackupStatus(
  db: SQLiteDatabase,
  session: CloudSession | null,
): Promise<CloudBackupStatus> {
  const [workerUrl, lastSuccessDate, lastSuccessAt, pendingDate, lastError] =
    await Promise.all([
      getWorkerUrl(),
      readState(db, LAST_SUCCESS_DATE_KEY),
      readState(db, LAST_SUCCESS_AT_KEY),
      readState(db, PENDING_DATE_KEY),
      readState(db, LAST_ERROR_KEY),
    ]);
  return {
    configured: Boolean(workerUrl && session),
    username: session?.username ?? null,
    lastSuccessDate,
    lastSuccessAt,
    pendingDate,
    lastError,
  };
}

// --- Envoi quotidien ---
export async function syncCloudBackup(
  db: SQLiteDatabase,
  options: { force?: boolean; forceOverwrite?: boolean } = {},
): Promise<CloudBackupResult> {
  const now = new Date();
  const session = await getSession();
  const status = await getCloudBackupStatus(db, session);
  const businessDate = options.force
    ? manualBusinessDate(now)
    : dueBusinessDate(now, status.lastSuccessDate, status.pendingDate);

  if (!businessDate) return { ...status, outcome: "not_due" };

  await writeState(db, PENDING_DATE_KEY, businessDate);
  if (!status.configured || !session) {
    return { ...status, configured: false, pendingDate: businessDate, outcome: "not_configured" };
  }

  try {
    if (!options.forceOverwrite) {
      const remoteUpdate = await getCloudBackupUpdate(db, session).catch(() => null);
      if (remoteUpdate) {
        await writeState(
          db,
          LAST_ERROR_KEY,
          "Une sauvegarde plus récente doit être examinée avant le prochain envoi.",
        );
        return {
          ...status,
          pendingDate: businessDate,
          lastError: "Une sauvegarde plus récente est disponible sur un autre appareil.",
          outcome: "remote_newer",
        };
      }
    }

    const [deviceId, backup, shopRow, shopId] = await Promise.all([
      getDeviceId(),
      createBackupPayload(db, "Sauvegarde automatique"),
      db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'shop_name'"),
      (async () => getCurrentShopId() ?? "")(),
    ]);
    const snapshotAt = new Date().toISOString();

    const { status: resStatus, body } = await fetchJson(`${await apiBase()}/api/backups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        account_id: session.accountId,
        shop_id: shopId,
        device_id: deviceId,
        business_date: businessDate,
        snapshot_at: snapshotAt,
        app_version: APP_VERSION,
        schema_version: BACKUP_FORMAT_VERSION,
        payload: JSON.stringify(backup),
        shop_name: shopRow?.value ?? "Ma boutique",
      }),
    }, { attempts: 3, timeoutMs: 20_000 });

    if (resStatus >= 400) {
      throw new Error(safeError(body, "Le service de sauvegarde a refusé l’envoi."));
    }

    await writeState(db, LAST_SUCCESS_DATE_KEY, businessDate);
    await writeState(db, LAST_SUCCESS_AT_KEY, snapshotAt);
    await writeState(db, PENDING_DATE_KEY, null);
    await writeState(db, LAST_ERROR_KEY, null);
    return {
      configured: true,
      username: session.username,
      lastSuccessDate: businessDate,
      lastSuccessAt: snapshotAt,
      pendingDate: null,
      lastError: null,
      outcome: "synced",
    };
  } catch (caught) {
    const message =
      caught instanceof Error && caught.name === "AbortError"
        ? "La connexion au service a expiré. La sauvegarde sera retentée."
        : caught instanceof TypeError
          ? "Internet indisponible. La sauvegarde sera retentée à la prochaine connexion."
          : caught instanceof Error
            ? caught.message
            : "La sauvegarde a échoué et sera retentée.";
    await writeState(db, LAST_ERROR_KEY, message);
    return {
      ...status,
      pendingDate: businessDate,
      lastError: message,
      outcome: "pending",
    };
  }
}