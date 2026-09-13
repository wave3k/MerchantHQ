import type { SQLiteDatabase } from "expo-sqlite";

import { APP_VERSION, BACKUP_FORMAT_VERSION } from "../appInfo";
import {
  createBackupPayload,
  emptyBackupPayload,
  restoreBackupForShop,
  restoreBackupPayload,
  type BackupFile,
} from "./backup";
import {
  dueBusinessDate,
  manualBusinessDate,
  normalizeBackupFrequency,
  shouldOfferRemoteRestore,
} from "../domain/cloudBackup";
import { getDeviceId, getSession, getWorkerUrl, saveSession, type CloudSession, type PlanPermissions } from "./cloudSession";
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
  email: string | null;
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

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function fetchJson(
  url: string,
  init: RequestInit,
  opts: { attempts?: number; timeoutMs?: number } = {},
): Promise<{ status: number; body: unknown }> {
  const attempts = Math.max(1, opts.attempts ?? 2);
  const timeoutMs = Math.max(3_000, opts.timeoutMs ?? 6_000);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (res.status >= 400 && res.status < 500) {
        // 4xx (dont 401/429) : renvoyer la réponse telle quelle, sans réessayer.
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
    if (attempt < attempts) await wait(250 * attempt);
  }
  if (isAbortError(lastError)) {
    throw new Error(
      "Le service met trop de temps à répondre. Vérifiez votre connexion puis réessayez.",
    );
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
  email: string,
  password: string,
  shopName: string,
): Promise<CloudSession> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, shop_name: shopName }),
  }, { attempts: 2, timeoutMs: 20_000 });
  const data = body as { ok?: boolean; account?: { account_id?: string; email?: string; shop_name?: string; email_verified?: boolean; subscription_type?: string; subscription_expires_at?: string; token?: string } };
  if (status >= 400 || !data?.ok || !data.account?.account_id) {
    throw new Error(safeError(body, "Création du compte impossible."));
  }
  const session: CloudSession = {
    accountId: data.account.account_id,
    email: data.account.email ?? email,
    emailVerified: Boolean(data.account.email_verified),
    shopName: data.account.shop_name ?? shopName,
    subscriptionType: data.account.subscription_type ?? undefined,
    subscriptionExpiresAt: data.account.subscription_expires_at ?? undefined,
    token: data.account.token,
  };
  await saveSession(session);
  return session;
}

export async function loginAccount(email: string, password: string): Promise<CloudSession> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, { attempts: 2, timeoutMs: 20_000 });
  const data = body as { ok?: boolean; account?: { account_id?: string; email?: string; shop_name?: string; email_verified?: boolean; subscription_type?: string; subscription_expires_at?: string; token?: string } };
  if (status >= 400 || !data?.ok || !data.account?.account_id) {
    throw new Error(safeError(body, "Connexion impossible."));
  }
  const session: CloudSession = {
    accountId: data.account.account_id,
    email: data.account.email ?? email,
    emailVerified: Boolean(data.account.email_verified),
    shopName: data.account.shop_name ?? "Ma boutique",
    subscriptionType: data.account.subscription_type ?? undefined,
    subscriptionExpiresAt: data.account.subscription_expires_at ?? undefined,
    token: data.account.token,
  };
  await saveSession(session);
  return session;
}

export async function verifyEmail(
  accountId: string,
  code: string,
): Promise<{ emailVerified: boolean }> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId, code: code.trim() }),
  }, { attempts: 2, timeoutMs: 20_000 });
  const data = body as { ok?: boolean; email_verified?: boolean };
  if (status >= 400 || !data?.ok) {
    throw new Error(safeError(body, "Code incorrect ou expiré."));
  }
  const verified = Boolean(data.email_verified);
  if (verified) await saveSession({ ...((await getSession()) ?? ({} as CloudSession)), emailVerified: true });
  return { emailVerified: verified };
}

export async function resendVerification(accountId: string): Promise<void> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId }),
  });
  if (status >= 400) {
    throw new Error(safeError(body, "Renvoi du code impossible."));
  }
}

export interface SubscriptionStatus {
  type: string;
  expiresAt: string;
  active: boolean;
  permissions?: PlanPermissions;
  devices?: number;
  devicesLimit?: number;
  deviceIds?: string[];
}

export async function getSubscription(accountId: string): Promise<SubscriptionStatus> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/auth/subscription?account_id=${encodeURIComponent(accountId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 2, timeoutMs: 6_000 },
  );
  const data = body as { subscription?: { type?: string; expires_at?: string; active?: boolean; permissions?: PlanPermissions; devices?: number; devices_limit?: number; device_ids?: string[] } };
  if (status !== 200 || !data.subscription) {
    return { type: "", expiresAt: "", active: false };
  }
  const result: SubscriptionStatus = {
    type: data.subscription.type ?? "",
    expiresAt: data.subscription.expires_at ?? "",
    active: Boolean(data.subscription.active),
    permissions: data.subscription.permissions,
    devices: data.subscription.devices,
    devicesLimit: data.subscription.devices_limit,
    deviceIds: data.subscription.device_ids,
  };
  // Stockage local (hors-ligne) des permissions
  const session = await getSession();
  if (session && result.type) {
    await saveSession({ ...session, subscriptionType: result.type, subscriptionExpiresAt: result.expiresAt, subscriptionPermissions: result.permissions, subscriptionDevices: result.devices, subscriptionDevicesLimit: result.devicesLimit });
  }
  return result;
}

export async function applySubscriptionCode(
  accountId: string,
  code: string,
): Promise<SubscriptionStatus> {
  const { status, body } = await fetchJson(`${await apiBase()}/api/auth/apply-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ account_id: accountId, code: code.trim().toUpperCase() }),
  });
  const data = body as { ok?: boolean; subscription?: { type?: string; expires_at?: string; active?: boolean } };
  if (status >= 400 || !data?.ok) {
    throw new Error(safeError(body, "Code d’abonnement invalide."));
  }
  const result: SubscriptionStatus = {
    type: data.subscription?.type ?? "",
    expiresAt: data.subscription?.expires_at ?? "",
    active: Boolean(data.subscription?.active),
  };
  // Stockage local pour l'accès hors-ligne
  const session = await getSession();
  if (session) {
    await saveSession({ ...session, subscriptionType: result.type, subscriptionExpiresAt: result.expiresAt });
  }
  // Rafraîchit les permissions du plan (tablettes, rapports, tickets…).
  await getSubscription(accountId).catch(() => null);
  return result;
}

export interface MerchantProfile {
  shop_name?: string;
  shop_phone?: string;
  shop_whatsapp?: string;
  shop_city?: string;
  shop_sector?: string;
  shop_email?: string;
  shop_website?: string;
  shop_address?: string;
  partner_share_accepted?: boolean;
  updated_at?: string;
}

const PROFILE_KEYS = [
  "shop_name",
  "shop_phone",
  "shop_whatsapp",
  "shop_city",
  "shop_sector",
  "shop_email",
  "shop_website",
  "shop_address",
  "partner_share_accepted",
] as const;

function readProfileSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const placeholders = PROFILE_KEYS.map(() => "?").join(", ");
  return db
    .getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
      ...PROFILE_KEYS,
    )
    .then((rows) => {
      const map: Record<string, string> = {};
      for (const row of rows) map[row.key] = row.value;
      return map;
    });
}

// Pousse le profil établissement vers le cloud (si connecté). Ne bloque jamais.
export async function pushMerchantProfile(db: SQLiteDatabase): Promise<void> {
  const session = await getSession().catch(() => null);
  if (!session?.accountId) return;
  const values = await readProfileSettings(db);
  const profile: MerchantProfile = {
    shop_name: values.shop_name ?? "",
    shop_phone: values.shop_phone ?? "",
    shop_whatsapp: values.shop_whatsapp ?? "",
    shop_city: values.shop_city ?? "",
    shop_sector: values.shop_sector ?? "",
    shop_email: values.shop_email ?? "",
    shop_website: values.shop_website ?? "",
    shop_address: values.shop_address ?? "",
    partner_share_accepted: values.partner_share_accepted === "1",
    updated_at: new Date().toISOString(),
  };
  await fetchJson(`${await apiBase()}/api/account/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ account_id: session.accountId, profile }),
  }, { attempts: 2, timeoutMs: 6_000 });
}

// Vérifie les changements côté cloud et rafraîchit les champs manquants.
export async function syncMerchantProfile(db: SQLiteDatabase): Promise<void> {
  const session = await getSession().catch(() => null);
  if (!session?.accountId) return;
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/account/profile?account_id=${encodeURIComponent(session.accountId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 2, timeoutMs: 6_000 },
  );
  const data = body as { ok?: boolean; profile?: MerchantProfile };
  if (status !== 200 || !data?.profile) return;
  const local = await readProfileSettings(db);
  const updates: Array<[string, string]> = [];
  if (!local.shop_city && data.profile.shop_city) updates.push(["shop_city", data.profile.shop_city]);
  if (!local.shop_sector && data.profile.shop_sector) updates.push(["shop_sector", data.profile.shop_sector]);
  if (!local.shop_whatsapp && data.profile.shop_whatsapp) updates.push(["shop_whatsapp", data.profile.shop_whatsapp]);
  if (!local.shop_phone && data.profile.shop_phone) updates.push(["shop_phone", data.profile.shop_phone]);
  if (updates.length > 0) {
    await withSettingsWrites(db, updates);
  }
}

async function withSettingsWrites(
  db: SQLiteDatabase,
  updates: Array<[string, string]>,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of updates) {
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key,
        value,
      );
    }
  });
}

export async function getAccountStatus(accountId: string): Promise<AccountStatus | null> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/accounts/status?account_id=${encodeURIComponent(accountId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: 2, timeoutMs: 6_000 },
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
    { attempts: 2, timeoutMs: 6_000 },
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
async function getLatestRemoteBackup(
  accountId: string,
  shopId: string,
  opts: { attempts?: number; timeoutMs?: number } = {},
): Promise<CloudBackupUpdate | null> {
  const { status, body } = await fetchJson(
    `${await apiBase()}/api/backups/latest?account_id=${encodeURIComponent(accountId)}&shop_id=${encodeURIComponent(shopId)}`,
    { method: "GET", headers: { ...(await authHeaders()) } },
    { attempts: opts.attempts ?? 2, timeoutMs: opts.timeoutMs ?? 8_000 },
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
    { attempts: 2, timeoutMs: 6_000 },
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
  return getLatestRemoteBackup(session.accountId, shopId, { attempts: 1, timeoutMs: 4_000 }).catch(
    () => null,
  );
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
    email: session?.email ?? null,
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
  const frequency = normalizeBackupFrequency(
    session?.subscriptionPermissions?.backup,
  );
  const businessDate = options.force
    ? manualBusinessDate(now)
    : dueBusinessDate(
        now,
        status.lastSuccessDate,
        status.pendingDate,
        frequency,
        status.lastSuccessAt,
      );

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
    }, { attempts: 2, timeoutMs: 6_000 });

    if (resStatus >= 400) {
      throw new Error(safeError(body, "Le service de sauvegarde a refusé l’envoi."));
    }

    await writeState(db, LAST_SUCCESS_DATE_KEY, businessDate);
    await writeState(db, LAST_SUCCESS_AT_KEY, snapshotAt);
    await writeState(db, PENDING_DATE_KEY, null);
    await writeState(db, LAST_ERROR_KEY, null);
    return {
      configured: true,
      email: session.email,
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