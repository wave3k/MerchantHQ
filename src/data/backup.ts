import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";

import { APP_VERSION, BACKUP_FORMAT_VERSION } from "../appInfo";
import type { User } from "../types";
import { withWriteTransaction } from "./transactions";

const TABLES = [
  "settings",
  "employees",
  "users",
  "attendance_records",
  "products",
  "clients",
  "appointments",
  "orders",
  "order_items",
  "stock_movements",
  "activity_logs",
] as const;

type TableName = (typeof TABLES)[number];

const TABLE_COLUMNS: Record<TableName, readonly string[]> = {
  settings: ["key", "value"],
  employees: [
    "id",
    "name",
    "phone",
    "position",
    "is_active",
    "created_at",
    "updated_at",
  ],
  users: [
    "id",
    "name",
    "username",
    "role",
    "employee_id",
    "password_hash",
    "password_salt",
    "is_active",
    "created_at",
    "updated_at",
  ],
  attendance_records: [
    "id",
    "employee_id",
    "work_date",
    "status",
    "arrival_at",
    "note",
    "recorded_by",
    "created_at",
    "updated_at",
  ],
  products: [
    "id",
    "name",
    "sku",
    "category",
    "price",
    "stock",
    "low_stock_threshold",
    "tracks_stock",
    "is_active",
    "created_at",
    "updated_at",
  ],
  clients: ["id", "name", "phone", "address", "created_at", "updated_at"],
  appointments: [
    "id",
    "client_id",
    "product_id",
    "scheduled_at",
    "reminder_minutes",
    "notes",
    "status",
    "notification_id",
    "created_by",
    "created_at",
    "updated_at",
  ],
  orders: [
    "id",
    "order_number",
    "client_id",
    "user_id",
    "employee_id",
    "employee_name",
    "total",
    "payment_method",
    "status",
    "created_at",
  ],
  order_items: [
    "id",
    "order_id",
    "product_id",
    "product_name",
    "unit_price",
    "quantity",
    "subtotal",
  ],
  stock_movements: [
    "id",
    "product_id",
    "user_id",
    "type",
    "quantity",
    "before_stock",
    "after_stock",
    "reason",
    "created_at",
  ],
  activity_logs: [
    "id",
    "user_id",
    "user_name",
    "user_role",
    "action",
    "entity_type",
    "entity_id",
    "description",
    "old_value",
    "new_value",
    "created_at",
  ],
};

export interface BackupFile {
  format: "commerce-manager-backup";
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  appVersion?: string;
  exportedAt: string;
  exportedBy: string;
  data: Partial<Record<TableName, Record<string, unknown>[]>>;
}

export async function createBackupPayload(
  db: SQLiteDatabase,
  exportedBy: string,
): Promise<BackupFile> {
  const data = {} as BackupFile["data"];
  for (const table of TABLES) {
    data[table] = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${table}`,
    );
  }
  return {
    format: "commerce-manager-backup",
    version: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    data,
  };
}

export async function exportBackup(
  db: SQLiteDatabase,
  actor: User,
): Promise<string> {
  const payload = await createBackupPayload(db, actor.name);
  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `commerce-manager-${date}.json`);
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: "Sauvegarder les données de la boutique",
      mimeType: "application/json",
    });
  }
  return file.uri;
}

function assertBackup(value: unknown): asserts value is BackupFile {
  if (
    !value ||
    typeof value !== "object" ||
    (value as BackupFile).format !== "commerce-manager-backup" ||
    ![1, 2, 3, 4, 5, 6, 7].includes((value as BackupFile).version)
  ) {
    throw new Error("Ce fichier n’est pas une sauvegarde Commerce Manager valide.");
  }
  const version = (value as BackupFile).version;
  for (const table of TABLES) {
    const optionalForOlderBackup =
      (table === "employees" && version === 1) ||
      (table === "appointments" && version < 3) ||
      (table === "attendance_records" && version < 7);
    if (
      !optionalForOlderBackup &&
      !Array.isArray((value as BackupFile).data?.[table])
    ) {
      throw new Error(`La table ${table} est absente de la sauvegarde.`);
    }
  }
}

async function insertRows(
  db: SQLiteDatabase,
  table: TableName,
  rows: Record<string, unknown>[],
): Promise<void> {
  const allowed = TABLE_COLUMNS[table];
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    if (columns.some((column) => !allowed.includes(column))) {
      throw new Error(`La table ${table} contient une colonne non autorisée.`);
    }
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((column) => {
      const value = row[column];
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        value instanceof Uint8Array
      ) {
        return value;
      }
      return JSON.stringify(value);
    });
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      values,
    );
  }
}

export async function importBackup(db: SQLiteDatabase): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return false;
  const asset = result.assets[0];
  if (!asset) {
    throw new Error("Aucun fichier n’a été sélectionné.");
  }
  const source = new File(asset.uri);
  const parsed: unknown = JSON.parse(await source.text());
  await restoreBackupPayload(db, parsed);
  return true;
}

export async function restoreBackupPayload(
  db: SQLiteDatabase,
  parsed: unknown,
): Promise<BackupFile> {
  assertBackup(parsed);

  await withWriteTransaction(db, async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM order_items;
      DELETE FROM stock_movements;
      DELETE FROM orders;
      DELETE FROM appointments;
      DELETE FROM attendance_records;
      DELETE FROM activity_logs;
      DELETE FROM products;
      DELETE FROM clients;
      DELETE FROM users;
      DELETE FROM employees;
      DELETE FROM settings;
    `);
    for (const table of TABLES) {
      await insertRows(transaction, table, parsed.data[table] ?? []);
    }

    const accounts = await transaction.getAllAsync<{
      id: number;
      name: string;
      role: "boss" | "manager" | "employee";
      employee_id: number | null;
      created_at: string;
    }>("SELECT id, name, role, employee_id, created_at FROM users ORDER BY id");
    for (const account of accounts) {
      if (account.employee_id) continue;
      const position =
        account.role === "boss"
          ? "Propriétaire"
          : account.role === "manager"
            ? "Gérant"
            : "Employé";
      const employee = await transaction.runAsync(
        `INSERT INTO employees
          (name, phone, position, is_active, created_at, updated_at)
         VALUES (?, '', ?, 1, ?, ?)`,
        account.name,
        position,
        account.created_at,
        new Date().toISOString(),
      );
      await transaction.runAsync(
        "UPDATE users SET employee_id = ? WHERE id = ?",
        employee.lastInsertRowId,
        account.id,
      );
    }
    await transaction.execAsync(`
      UPDATE appointments SET notification_id = NULL;
      UPDATE orders
         SET employee_id = (
           SELECT employee_id FROM users WHERE users.id = orders.user_id
         )
       WHERE employee_id IS NULL;
      UPDATE orders
         SET employee_name = COALESCE(
           (SELECT name FROM employees WHERE employees.id = orders.employee_id),
           (SELECT name FROM users WHERE users.id = orders.user_id)
         )
       WHERE employee_name IS NULL OR employee_name = '';
    `);
  });
  return parsed;
}
