import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import {
  APP_NAME,
  APP_VERSION,
  BACKUP_FORMAT_VERSION,
} from "../appInfo";
import { BUNDLED_TURSO_TOKEN } from "../bundledCloudToken";
import {
  dueBusinessDate,
  manualBusinessDate,
  shouldOfferRemoteRestore,
  tursoPipelineUrl,
} from "../domain/cloudBackup";
import {
  createBackupPayload,
  restoreBackupPayload,
  type BackupFile,
} from "./backup";
import * as SecureStore from "./secureStore";

const TURSO_URL_KEY = "commerce-manager.turso-url";
const TURSO_TOKEN_KEY = "commerce-manager.turso-token";
const DEVICE_ID_KEY = "commerce-manager.device-id";
const LAST_SUCCESS_DATE_KEY = "cloud_backup_last_success_date";
const LAST_SUCCESS_AT_KEY = "cloud_backup_last_success_at";
const PENDING_DATE_KEY = "cloud_backup_pending_date";
const LAST_ERROR_KEY = "cloud_backup_last_error";
const LAST_RESTORED_BACKUP_ID_KEY = "cloud_restore_last_backup_id";
const LAST_RESTORED_AT_KEY = "cloud_restore_last_snapshot_at";
const DEFAULT_TURSO_URL =
  "libsql://commerce-manager-teroryx.aws-us-west-2.turso.io";
export interface CloudBackupConfig {
  url: string;
  hasToken: boolean;
}

export interface CloudBackupStatus {
  configured: boolean;
  lastSuccessDate: string | null;
  lastSuccessAt: string | null;
  pendingDate: string | null;
  lastError: string | null;
}

export interface CloudBackupResult extends CloudBackupStatus {
  outcome:
    | "synced"
    | "not_due"
    | "not_configured"
    | "pending"
    | "remote_newer";
}

export interface CloudBackupUpdate {
  backupId: string;
  deviceId: string;
  businessDate: string;
  snapshotAt: string;
  appVersion: string;
  schemaVersion: number;
}

interface PipelineResult {
  type: "ok" | "error";
  error?: { message?: string };
  response?: {
    type?: string;
    result?: {
      cols?: Array<{ name?: string }>;
      rows?: Array<Array<{ type?: string; value?: string | null }>>;
    };
  };
}

export interface TursoPipelineResponse {
  results?: PipelineResult[];
}

type TursoRequest = {
  type: string;
  stmt?: {
    sql: string;
    args?: Array<{ type: string; value?: string }>;
  };
};

const CREATE_BACKUP_TABLE = `CREATE TABLE IF NOT EXISTS commerce_manager_backups (
  backup_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  app_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE(device_id, business_date)
)`;

const CREATE_LATEST_BACKUP_TABLE = `CREATE TABLE IF NOT EXISTS commerce_latest_backup (
  singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
  backup_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  snapshot_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL
)`;

async function readState(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
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

export async function getCloudBackupConfig(): Promise<CloudBackupConfig> {
  if (Platform.OS === "web") {
    return { url: DEFAULT_TURSO_URL, hasToken: false };
  }
  const [url, token] = await Promise.all([
    SecureStore.getItemAsync(TURSO_URL_KEY),
    SecureStore.getItemAsync(TURSO_TOKEN_KEY),
  ]);
  return {
    url: url ?? DEFAULT_TURSO_URL,
    hasToken: Boolean(token),
  };
}

export async function saveCloudBackupConfig(
  url: string,
  token?: string,
): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error(
      "La sauvegarde Turso est désactivée dans le navigateur pour protéger la clé privée.",
    );
  }
  tursoPipelineUrl(url);
  await SecureStore.setItemAsync(TURSO_URL_KEY, url.trim(), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (token?.trim()) {
    await SecureStore.setItemAsync(TURSO_TOKEN_KEY, token.trim(), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }
}

export async function ensureBundledCloudBackupConfig(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!BUNDLED_TURSO_TOKEN) return false;
  const current = await SecureStore.getItemAsync(TURSO_TOKEN_KEY);
  if (current) return false;
  await saveCloudBackupConfig(DEFAULT_TURSO_URL, BUNDLED_TURSO_TOKEN);
  return true;
}

export async function getCloudBackupStatus(
  db: SQLiteDatabase,
): Promise<CloudBackupStatus> {
  const [config, lastSuccessDate, lastSuccessAt, pendingDate, lastError] =
    await Promise.all([
      getCloudBackupConfig(),
      readState(db, LAST_SUCCESS_DATE_KEY),
      readState(db, LAST_SUCCESS_AT_KEY),
      readState(db, PENDING_DATE_KEY),
      readState(db, LAST_ERROR_KEY),
    ]);
  return {
    configured: config.hasToken,
    lastSuccessDate,
    lastSuccessAt,
    pendingDate,
    lastError,
  };
}

async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return created;
}

export async function getCloudCredentials(): Promise<{
  url: string;
  token: string;
} | null> {
  if (Platform.OS === "web") return null;
  const config = await getCloudBackupConfig();
  const token = await SecureStore.getItemAsync(TURSO_TOKEN_KEY);
  return config.hasToken && token ? { url: config.url, token } : null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runTursoPipeline(
  url: string,
  token: string,
  requests: TursoRequest[],
  options: { attempts?: number; timeoutMs?: number } = {},
): Promise<TursoPipelineResponse> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const timeoutMs = Math.max(3_000, options.timeoutMs ?? 10_000);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(tursoPipelineUrl(url), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("Le jeton Turso est refusé. Enregistrez un nouveau jeton.");
      }
      if (!response.ok) {
        const error = new Error(
          `Turso a refusé la requête (HTTP ${response.status}).`,
        );
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else {
        const body = (await response.json()) as TursoPipelineResponse;
        const failed = body.results?.find((result) => result.type === "error");
        if (failed) {
          throw new Error(
            failed.error?.message
              ? `Turso n’a pas enregistré les données : ${failed.error.message}`
              : "Turso n’a pas enregistré les données.",
          );
        }
        return body;
      }
    } catch (caught) {
      lastError = caught;
      const message = caught instanceof Error ? caught.message : "";
      if (
        message.includes("jeton Turso") ||
        message.includes("n’a pas enregistré les données") ||
        (message.includes("HTTP 4") && !message.includes("HTTP 429"))
      ) {
        throw caught;
      }
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < attempts) await wait(450 * attempt);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Turso est momentanément indisponible.");
}

function readFirstRow(
  body: TursoPipelineResponse,
  resultIndex: number,
): Record<string, string> | null {
  const result = body.results?.[resultIndex]?.response?.result;
  const row = result?.rows?.[0];
  if (!row) return null;
  const output: Record<string, string> = {};
  result?.cols?.forEach((column, index) => {
    if (column.name) output[column.name] = row[index]?.value ?? "";
  });
  return output;
}

async function getLocalDataAt(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(`
    SELECT MAX(value) AS value
    FROM (
      SELECT MAX(updated_at) AS value FROM employees
      UNION ALL SELECT MAX(updated_at) FROM attendance_records
      UNION ALL SELECT MAX(updated_at) FROM products
      UNION ALL SELECT MAX(updated_at) FROM clients
      UNION ALL SELECT MAX(updated_at) FROM appointments
      UNION ALL SELECT MAX(created_at) FROM orders
      UNION ALL SELECT MAX(created_at) FROM activity_logs
    )
  `);
  return row?.value ?? null;
}

async function readLatestRemoteBackup(
  credentials: { url: string; token: string },
): Promise<CloudBackupUpdate | null> {
  const body = await runTursoPipeline(
    credentials.url,
    credentials.token,
    [
      { type: "execute", stmt: { sql: CREATE_BACKUP_TABLE } },
      { type: "execute", stmt: { sql: CREATE_LATEST_BACKUP_TABLE } },
      {
        type: "execute",
        stmt: {
          sql: `INSERT OR IGNORE INTO commerce_latest_backup
            (singleton_id, backup_id, device_id, business_date, snapshot_at, app_version, schema_version)
            SELECT 1, backup_id, device_id, business_date, snapshot_at, 'inconnue', schema_version
            FROM commerce_manager_backups
            ORDER BY snapshot_at DESC
            LIMIT 1`,
        },
      },
      {
        type: "execute",
        stmt: {
          sql: `SELECT backup_id, device_id, business_date, snapshot_at,
                       app_version, schema_version
                FROM commerce_latest_backup
                WHERE singleton_id = 1`,
        },
      },
      { type: "close" },
    ],
    { attempts: 2, timeoutMs: 6_000 },
  );
  const row = readFirstRow(body, 3);
  if (!row?.backup_id || !row.device_id || !row.snapshot_at) return null;
  return {
    backupId: row.backup_id,
    deviceId: row.device_id,
    businessDate: row.business_date ?? "",
    snapshotAt: row.snapshot_at,
    appVersion: row.app_version || "inconnue",
    schemaVersion: Number(row.schema_version) || 0,
  };
}

export async function getCloudBackupUpdate(
  db: SQLiteDatabase,
): Promise<CloudBackupUpdate | null> {
  const credentials = await getCloudCredentials();
  if (!credentials) return null;
  const [remote, currentDeviceId, lastRestoredBackupId, localDataAt] =
    await Promise.all([
      readLatestRemoteBackup(credentials),
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
      currentDeviceId,
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
  const credentials = await getCloudCredentials();
  if (!credentials) {
    throw new Error("La connexion Turso n’est pas configurée.");
  }
  if (update.schemaVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Cette copie vient d’une version plus récente (${update.appVersion}). Mettez d’abord Commerce Manager à jour.`,
    );
  }
  const body = await runTursoPipeline(
    credentials.url,
    credentials.token,
    [
      {
        type: "execute",
        stmt: {
          sql: "SELECT payload FROM commerce_manager_backups WHERE backup_id = ?",
          args: [{ type: "text", value: update.backupId }],
        },
      },
      { type: "close" },
    ],
    { attempts: 3, timeoutMs: 12_000 },
  );
  const row = readFirstRow(body, 0);
  if (!row?.payload) {
    throw new Error("La sauvegarde sélectionnée n’existe plus sur Turso.");
  }
  const restored = await restoreBackupPayload(db, JSON.parse(row.payload));
  await writeState(db, LAST_RESTORED_BACKUP_ID_KEY, update.backupId);
  await writeState(db, LAST_RESTORED_AT_KEY, update.snapshotAt);
  await writeState(db, PENDING_DATE_KEY, null);
  await writeState(db, LAST_ERROR_KEY, null);
  return restored;
}

function safeError(caught: unknown): string {
  if (caught instanceof Error && caught.name === "AbortError") {
    return "La connexion Turso a expiré. La sauvegarde sera retentée.";
  }
  if (caught instanceof TypeError) {
    return "Internet ou Turso est indisponible. La sauvegarde sera retentée.";
  }
  return caught instanceof Error
    ? caught.message
    : "La sauvegarde cloud a échoué et sera retentée.";
}

async function uploadSnapshot(
  url: string,
  token: string,
  deviceId: string,
  businessDate: string,
  payload: string,
): Promise<void> {
  const snapshotAt = new Date().toISOString();
  await runTursoPipeline(
    url,
    token,
    [
          { type: "execute", stmt: { sql: CREATE_BACKUP_TABLE } },
          { type: "execute", stmt: { sql: CREATE_LATEST_BACKUP_TABLE } },
          {
            type: "execute",
            stmt: {
              sql: `INSERT INTO commerce_manager_backups
                (backup_id, device_id, business_date, app_name, schema_version, snapshot_at, payload)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(device_id, business_date) DO UPDATE SET
                  app_name = excluded.app_name,
                  schema_version = excluded.schema_version,
                  snapshot_at = excluded.snapshot_at,
                  payload = excluded.payload`,
              args: [
                { type: "text", value: `${deviceId}:${businessDate}` },
                { type: "text", value: deviceId },
                { type: "text", value: businessDate },
                { type: "text", value: APP_NAME },
                { type: "integer", value: String(BACKUP_FORMAT_VERSION) },
                { type: "text", value: snapshotAt },
                { type: "text", value: payload },
              ],
            },
          },
          {
            type: "execute",
            stmt: {
              sql: `INSERT INTO commerce_latest_backup
                (singleton_id, backup_id, device_id, business_date, snapshot_at, app_version, schema_version)
                VALUES (1, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(singleton_id) DO UPDATE SET
                  backup_id = excluded.backup_id,
                  device_id = excluded.device_id,
                  business_date = excluded.business_date,
                  snapshot_at = excluded.snapshot_at,
                  app_version = excluded.app_version,
                  schema_version = excluded.schema_version
                WHERE excluded.snapshot_at >= commerce_latest_backup.snapshot_at`,
              args: [
                { type: "text", value: `${deviceId}:${businessDate}` },
                { type: "text", value: deviceId },
                { type: "text", value: businessDate },
                { type: "text", value: snapshotAt },
                { type: "text", value: APP_VERSION },
                { type: "integer", value: String(BACKUP_FORMAT_VERSION) },
              ],
            },
          },
          { type: "close" },
    ],
  );
}

export async function syncCloudBackup(
  db: SQLiteDatabase,
  options: { force?: boolean } = {},
): Promise<CloudBackupResult> {
  const now = new Date();
  const status = await getCloudBackupStatus(db);
  const businessDate = options.force
    ? manualBusinessDate(now)
    : dueBusinessDate(now, status.lastSuccessDate, status.pendingDate);

  if (!businessDate) return { ...status, outcome: "not_due" };

  await writeState(db, PENDING_DATE_KEY, businessDate);
  const credentials = await getCloudCredentials();
  if (!credentials) {
    return {
      ...status,
      configured: false,
      pendingDate: businessDate,
      outcome: "not_configured",
    };
  }

  try {
    const remoteUpdate = await getCloudBackupUpdate(db);
    if (remoteUpdate) {
      await writeState(
        db,
        LAST_ERROR_KEY,
        "Une sauvegarde plus récente doit être examinée avant le prochain envoi.",
      );
      return {
        ...status,
        configured: true,
        pendingDate: businessDate,
        lastError:
          "Une sauvegarde plus récente est disponible sur une autre tablette.",
        outcome: "remote_newer",
      };
    }
    const [deviceId, backup] = await Promise.all([
      getDeviceId(),
      createBackupPayload(db, "Sauvegarde automatique"),
    ]);
    await uploadSnapshot(
      credentials.url,
      credentials.token,
      deviceId,
      businessDate,
      JSON.stringify(backup),
    );
    const successAt = new Date().toISOString();
    await writeState(db, LAST_SUCCESS_DATE_KEY, businessDate);
    await writeState(db, LAST_SUCCESS_AT_KEY, successAt);
    await writeState(db, PENDING_DATE_KEY, null);
    await writeState(db, LAST_ERROR_KEY, null);
    return {
      configured: true,
      lastSuccessDate: businessDate,
      lastSuccessAt: successAt,
      pendingDate: null,
      lastError: null,
      outcome: "synced",
    };
  } catch (caught) {
    const message = safeError(caught);
    await writeState(db, LAST_ERROR_KEY, message);
    return {
      ...status,
      configured: true,
      pendingDate: businessDate,
      lastError: message,
      outcome: "pending",
    };
  }
}
