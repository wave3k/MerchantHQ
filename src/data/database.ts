import type { SQLiteDatabase } from "expo-sqlite";

import type {
  ActivityLog,
  AttendanceInput,
  AttendanceRecord,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  CartLine,
  Client,
  ClientInput,
  DashboardStats,
  Employee,
  EmployeeInput,
  Order,
  Product,
  ProductInput,
  PaymentMethod,
  Role,
  StatisticsData,
  StatisticsPeriod,
  User,
  UserInput,
} from "../types";
import { validateAccountPassword } from "../domain/accounts";
import { createPasswordHash, verifyPassword } from "./security";
import { withWriteTransaction } from "./transactions";

const now = () => new Date().toISOString();
const CURRENT_SCHEMA_VERSION = 9;

export interface OwnerAccountRecord {
  name: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  updatedAt: string;
}

const schema = `
CREATE TABLE IF NOT EXISTS schema_meta (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'Employé',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('boss', 'manager', 'cashier', 'employee')),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  password_salt TEXT NOT NULL DEFAULT '',
  permissions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present', 'absent_justified', 'absent_unjustified')),
  arrival_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT COLLATE NOCASE UNIQUE,
  category TEXT NOT NULL DEFAULT 'Général',
  price INTEGER NOT NULL CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(low_stock_threshold >= 0),
  tracks_stock INTEGER NOT NULL DEFAULT 1 CHECK(tracks_stock IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL COLLATE NOCASE UNIQUE,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  scheduled_at TEXT NOT NULL,
  reminder_minutes INTEGER NOT NULL DEFAULT 60 CHECK(reminder_minutes >= 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
  notification_id TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT,
  total INTEGER NOT NULL CHECK(total >= 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'mobile_money', 'card')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status = 'paid'),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  subtotal INTEGER NOT NULL CHECK(subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('sale', 'adjustment', 'restock')),
  quantity INTEGER NOT NULL,
  before_stock INTEGER NOT NULL,
  after_stock INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_work_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
`;

async function tableColumns(
  db: SQLiteDatabase,
  table: string,
): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

async function migrateToVersion2(db: SQLiteDatabase): Promise<void> {
  const userColumns = await tableColumns(db, "users");
  if (!userColumns.has("employee_id")) {
    await db.execAsync(
      "ALTER TABLE users ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;",
    );
  }

  const orderColumns = await tableColumns(db, "orders");
  if (!orderColumns.has("employee_id")) {
    await db.execAsync(
      "ALTER TABLE orders ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;",
    );
  }
  if (!orderColumns.has("employee_name")) {
    await db.execAsync("ALTER TABLE orders ADD COLUMN employee_name TEXT;");
  }

  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id) WHERE employee_id IS NOT NULL;",
  );

  const usersWithoutEmployee = await db.getAllAsync<{
    id: number;
    name: string;
    role: Role;
    created_at: string;
  }>(
    "SELECT id, name, role, created_at FROM users WHERE employee_id IS NULL ORDER BY id",
  );
  for (const account of usersWithoutEmployee) {
    const position =
      account.role === "boss"
        ? "Propriétaire"
        : account.role === "manager"
          ? "Gérant"
          : "Employé";
    const result = await db.runAsync(
      `INSERT INTO employees
        (name, phone, position, is_active, created_at, updated_at)
       VALUES (?, '', ?, 1, ?, ?)`,
      account.name,
      position,
      account.created_at,
      now(),
    );
    await db.runAsync(
      "UPDATE users SET employee_id = ? WHERE id = ?",
      result.lastInsertRowId,
      account.id,
    );
  }

  await db.execAsync(`
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
}

async function migrateToVersion4(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    await withWriteTransaction(db, async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE orders_v4 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT NOT NULL UNIQUE,
          client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
          employee_name TEXT,
          total INTEGER NOT NULL CHECK(total >= 0),
          payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'mobile_money', 'card')),
          status TEXT NOT NULL DEFAULT 'paid' CHECK(status = 'paid'),
          created_at TEXT NOT NULL
        );
        INSERT INTO orders_v4
          (id, order_number, client_id, user_id, employee_id, employee_name, total, payment_method, status, created_at)
        SELECT
          id, order_number, client_id, user_id, employee_id, employee_name, total, payment_method, status, created_at
        FROM orders;
        DROP TABLE orders;
        ALTER TABLE orders_v4 RENAME TO orders;
      `);
    });
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }
}

async function migrateToVersion5(db: SQLiteDatabase): Promise<void> {
  const productColumns = await tableColumns(db, "products");
  if (!productColumns.has("tracks_stock")) {
    await db.execAsync(
      "ALTER TABLE products ADD COLUMN tracks_stock INTEGER NOT NULL DEFAULT 1 CHECK(tracks_stock IN (0, 1));",
    );
  }
}

async function migrateToVersion6(db: SQLiteDatabase): Promise<void> {
  const appointmentColumns = await tableColumns(db, "appointments");
  if (!appointmentColumns.has("reminder_minutes")) {
    await db.execAsync(
      "ALTER TABLE appointments ADD COLUMN reminder_minutes INTEGER NOT NULL DEFAULT 60 CHECK(reminder_minutes >= 0);",
    );
  }
}

async function migrateToVersion7(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      work_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent_justified', 'absent_unjustified')),
      arrival_at TEXT,
      note TEXT NOT NULL DEFAULT '',
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(employee_id, work_date)
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_work_date
      ON attendance_records(work_date);
    CREATE INDEX IF NOT EXISTS idx_attendance_employee_id
      ON attendance_records(employee_id);
  `);
}

async function migrateToVersion8(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    await withWriteTransaction(db, async (transaction) => {
      const userColumns = await tableColumns(transaction, "users");
      if (!userColumns.has("permissions")) {
        await transaction.execAsync(`
          CREATE TABLE users_v8 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            role TEXT NOT NULL CHECK(role IN ('boss', 'manager', 'cashier', 'employee')),
            employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            password_hash TEXT NOT NULL DEFAULT '',
            password_salt TEXT NOT NULL DEFAULT '',
            permissions TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          INSERT INTO users_v8
            (id, name, username, role, employee_id, password_hash, password_salt, is_active, created_at, updated_at)
          SELECT
            id, name, username, role, employee_id, password_hash, password_salt, is_active, created_at, updated_at
          FROM users;
          DROP TABLE users;
          ALTER TABLE users_v8 RENAME TO users;
        `);
      }
    });
} finally {
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }
}

async function migrateToVersion9(db: SQLiteDatabase): Promise<void> {
  const timestamp = now();
  await withWriteTransaction(db, async (transaction) => {
    await transaction.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO categories (name, created_at) VALUES ('Général', '${timestamp}');
      INSERT OR IGNORE INTO categories (name, created_at)
        SELECT DISTINCT category, '${timestamp}'
        FROM products
        WHERE category <> '';
    `);
  });
}

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(schema);
  const defaultSettings: Array<[string, string]> = [
    ["shop_name", "Ma boutique"],
    ["currency_primary", "CDF"],
    ["currency_secondary", "USD"],
    ["currency_rate", "2800"],
    ["language", "fr"],
    ["theme", "cobalt"],
    ["tax_rate", "0"],
    ["opening_hours", "08:00 – 18:00"],
    ["shop_address", ""],
    ["shop_phone", ""],
    ["shop_email", ""],
    ["shop_website", ""],
    ["shop_legal_info", ""],
    ["payment_cash", "1"],
    ["payment_mobile_money", "1"],
    ["payment_card", "1"],
    ["ticket_auto_print", "1"],
    ["ticket_header", ""],
    ["ticket_footer", "Merci pour votre visite."],
    ["ticket_show_address", "1"],
    ["ticket_show_phone", "1"],
  ];
  for (const [key, value] of defaultSettings) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      key,
      value,
    );
  }
  const meta = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM schema_meta LIMIT 1",
  );
  const userColumns = await tableColumns(db, "users");
  const orderColumns = await tableColumns(db, "orders");
  const productColumns = await tableColumns(db, "products");
  const appointmentColumns = await tableColumns(db, "appointments");
  const categoriesColumns = await tableColumns(db, "categories");
  const needsEmployeeMigration =
    !userColumns.has("employee_id") ||
    !orderColumns.has("employee_id") ||
    !orderColumns.has("employee_name");

  if (needsEmployeeMigration || (meta && meta.version < 2)) {
    await migrateToVersion2(db);
  }
  if (meta && meta.version < 4) {
    await migrateToVersion4(db);
  }
  if (!productColumns.has("tracks_stock") || (meta && meta.version < 5)) {
    await migrateToVersion5(db);
  }
  if (
    !appointmentColumns.has("reminder_minutes") ||
    (meta && meta.version < 6)
  ) {
    await migrateToVersion6(db);
  }
  if (meta && meta.version < 7) {
    await migrateToVersion7(db);
  }
  if (meta && meta.version < 8) {
    await migrateToVersion8(db);
  }
  if (categoriesColumns.size === 0 || (meta && meta.version < 9)) {
    await migrateToVersion9(db);
  }

  if (!meta) {
    await db.runAsync(
      "INSERT INTO schema_meta (version) VALUES (?)",
      CURRENT_SCHEMA_VERSION,
    );
  } else if (meta.version < CURRENT_SCHEMA_VERSION) {
    await db.runAsync(
      "UPDATE schema_meta SET version = ?",
      CURRENT_SCHEMA_VERSION,
    );
  }
  await db.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id
       ON users(employee_id) WHERE employee_id IS NOT NULL;
     CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
     CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
     CREATE INDEX IF NOT EXISTS idx_orders_employee_id ON orders(employee_id);`,
  );
}

async function writeLog(
  db: SQLiteDatabase,
  actor: User | null,
  values: {
    action: string;
    entityType: string;
    entityId?: number | null;
    description: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO activity_logs
      (user_id, user_name, user_role, action, entity_type, entity_id, description, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    actor?.id ?? null,
    actor?.name ?? "Système",
    actor?.role ?? "system",
    values.action,
    values.entityType,
    values.entityId ?? null,
    values.description,
    values.oldValue === undefined ? null : JSON.stringify(values.oldValue),
    values.newValue === undefined ? null : JSON.stringify(values.newValue),
    now(),
  );
}

export async function hasUsers(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users WHERE is_active = 1",
  );
  return (row?.count ?? 0) > 0;
}

export async function createBoss(
  db: SQLiteDatabase,
  name: string,
  username: string,
  password: string,
): Promise<User> {
  if ((await hasUsers(db))) {
    throw new Error("Le compte Propriétaire existe déjà.");
  }
  const credentials = await createPasswordHash(password);
  const timestamp = now();
  let user: User | null = null;
  await withWriteTransaction(db, async (transaction) => {
    const employeeResult = await transaction.runAsync(
      `INSERT INTO employees
        (name, phone, position, is_active, created_at, updated_at)
       VALUES (?, '', 'Propriétaire', 1, ?, ?)`,
      name.trim(),
      timestamp,
      timestamp,
    );
    const result = await transaction.runAsync(
      `INSERT INTO users
        (name, username, role, employee_id, password_hash, password_salt, is_active, created_at, updated_at)
       VALUES (?, ?, 'boss', ?, ?, ?, 1, ?, ?)`,
      name.trim(),
      username.trim(),
      employeeResult.lastInsertRowId,
      credentials.hash,
      credentials.salt,
      timestamp,
      timestamp,
    );
    user = await transaction.getFirstAsync<User>(
      `SELECT id, name, username, role, employee_id, permissions,
        CASE WHEN password_hash = '' THEN 0 ELSE 1 END AS has_password,
        is_active, created_at
       FROM users WHERE id = ?`,
      result.lastInsertRowId,
    );
    if (user) {
      await writeLog(transaction, user, {
        action: "create",
        entityType: "user",
        entityId: user.id,
        description: `${user.name} a créé le compte Propriétaire initial.`,
        newValue: { name: user.name, username: user.username, role: user.role },
      });
    }
  });
  if (!user) throw new Error("Impossible de créer le compte Propriétaire.");
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('owner_account_pending', '1')
     ON CONFLICT(key) DO UPDATE SET value = '1'`,
  );
  return user;
}

export async function listUsers(
  db: SQLiteDatabase,
  includeInactive = false,
): Promise<User[]> {
  return db.getAllAsync<User>(
    `SELECT u.id, COALESCE(e.name, u.name) AS name, u.username, u.role,
      u.employee_id, u.permissions,
      CASE WHEN u.password_hash = '' THEN 0 ELSE 1 END AS has_password,
      u.is_active, u.created_at
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     ${includeInactive ? "" : "WHERE u.is_active = 1"}
     ORDER BY CASE u.role WHEN 'boss' THEN 0 WHEN 'manager' THEN 1 WHEN 'cashier' THEN 2 ELSE 3 END,
       COALESCE(e.name, u.name)`,
  );
}

export async function login(
  db: SQLiteDatabase,
  userId: number,
  password: string,
): Promise<User | null> {
  const row = await db.getFirstAsync<
    User & { password_hash: string; password_salt: string }
  >(
    `SELECT u.id, COALESCE(e.name, u.name) AS name, u.username, u.role,
      u.employee_id, u.permissions,
      CASE WHEN u.password_hash = '' THEN 0 ELSE 1 END AS has_password,
      u.is_active, u.created_at, u.password_hash, u.password_salt
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = ? AND u.is_active = 1`,
    userId,
  );
  if (!row) {
    return null;
  }
  const verification = await verifyPassword(
    password,
    row.password_salt,
    row.password_hash,
  );
  if (!verification.valid) return null;
  const { password_hash: _hash, password_salt: _salt, ...user } = row;
  if (verification.needsUpgrade) {
    const upgraded = await createPasswordHash(password);
    await db.runAsync(
      "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
      upgraded.hash,
      upgraded.salt,
      now(),
      user.id,
    );
  }
  await writeLog(db, user, {
    action: "login",
    entityType: "session",
    description: `${user.name} s’est connecté à l’application.`,
  });
  return user;
}

export async function getOwnerAccountRecord(
  db: SQLiteDatabase,
): Promise<OwnerAccountRecord | null> {
  const row = await db.getFirstAsync<{
    name: string;
    username: string;
    password_hash: string;
    password_salt: string;
    updated_at: string;
  }>(
    `SELECT COALESCE(e.name, u.name) AS name, u.username, u.password_hash,
      u.password_salt, u.updated_at
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.role = 'boss' AND u.is_active = 1
     ORDER BY u.id LIMIT 1`,
  );
  return row
    ? {
        name: row.name,
        username: row.username,
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
        updatedAt: row.updated_at,
      }
    : null;
}

export async function applyRemoteOwnerAccount(
  db: SQLiteDatabase,
  account: OwnerAccountRecord,
): Promise<void> {
  const timestamp = account.updatedAt || now();
  await withWriteTransaction(db, async (transaction) => {
    const existing = await transaction.getFirstAsync<{
      id: number;
      employee_id: number | null;
    }>(
      "SELECT id, employee_id FROM users WHERE role = 'boss' ORDER BY id LIMIT 1",
    );
    let employeeId = existing?.employee_id ?? null;
    if (!employeeId) {
      const employee = await transaction.runAsync(
        `INSERT INTO employees
          (name, phone, position, is_active, created_at, updated_at)
         VALUES (?, '', 'Propriétaire', 1, ?, ?)`,
        account.name,
        timestamp,
        timestamp,
      );
      employeeId = employee.lastInsertRowId;
    } else {
      await transaction.runAsync(
        "UPDATE employees SET name = ?, is_active = 1, updated_at = ? WHERE id = ?",
        account.name,
        timestamp,
        employeeId,
      );
    }
    if (existing) {
      await transaction.runAsync(
        `UPDATE users SET name = ?, username = ?, employee_id = ?,
          password_hash = ?, password_salt = ?, is_active = 1, updated_at = ?
         WHERE id = ?`,
        account.name,
        account.username,
        employeeId,
        account.passwordHash,
        account.passwordSalt,
        timestamp,
        existing.id,
      );
    } else {
      await transaction.runAsync(
        `INSERT INTO users
          (name, username, role, employee_id, password_hash, password_salt, is_active, created_at, updated_at)
         VALUES (?, ?, 'boss', ?, ?, ?, 1, ?, ?)`,
        account.name,
        account.username,
        employeeId,
        account.passwordHash,
        account.passwordSalt,
        timestamp,
        timestamp,
      );
    }
    await transaction.runAsync(
      "UPDATE users SET is_active = 0, updated_at = ? WHERE role <> 'boss'",
      timestamp,
    );
  });
}

export async function verifyBossPassword(
  db: SQLiteDatabase,
  password: string,
): Promise<boolean> {
  const boss = await db.getFirstAsync<{
    password_hash: string;
    password_salt: string;
  }>(
    "SELECT password_hash, password_salt FROM users WHERE role = 'boss' AND is_active = 1 LIMIT 1",
  );
  if (!boss) return false;
  return (
    await verifyPassword(password, boss.password_salt, boss.password_hash)
  ).valid;
}

export async function changeBossPassword(
  db: SQLiteDatabase,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  if (nextPassword.length < 4) {
    throw new Error("Le nouveau mot de passe doit contenir au moins 4 caractères.");
  }
  if (!(await verifyBossPassword(db, currentPassword))) {
    throw new Error("Le mot de passe actuel est incorrect.");
  }
  const boss = await db.getFirstAsync<User>(
    `SELECT id, name, username, role, employee_id, permissions,
      CASE WHEN password_hash = '' THEN 0 ELSE 1 END AS has_password,
      is_active, created_at
     FROM users WHERE role = 'boss' AND is_active = 1 LIMIT 1`,
  );
  if (!boss) throw new Error("Compte propriétaire introuvable.");
  const credentials = await createPasswordHash(nextPassword);
  await db.runAsync(
    "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    credentials.hash,
    credentials.salt,
    now(),
    boss.id,
  );
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('owner_account_pending', '1')
     ON CONFLICT(key) DO UPDATE SET value = '1'`,
  );
  await writeLog(db, boss, {
    action: "password_change",
    entityType: "user",
    entityId: boss.id,
    description: "Le mot de passe du compte propriétaire a été modifié.",
  });
}

export async function resetBossPassword(
  db: SQLiteDatabase,
  nextPassword: string,
): Promise<void> {
  if (nextPassword.length < 4) {
    throw new Error("Le nouveau mot de passe doit contenir au moins 4 caractères.");
  }
  const boss = await db.getFirstAsync<User>(
    `SELECT id, name, username, role, employee_id, permissions,
      CASE WHEN password_hash = '' THEN 0 ELSE 1 END AS has_password,
      is_active, created_at
     FROM users WHERE role = 'boss' AND is_active = 1 LIMIT 1`,
  );
  if (!boss) throw new Error("Compte propriétaire introuvable.");
  const credentials = await createPasswordHash(nextPassword);
  await db.runAsync(
    "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    credentials.hash,
    credentials.salt,
    now(),
    boss.id,
  );
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('owner_account_pending', '1')
     ON CONFLICT(key) DO UPDATE SET value = '1'`,
  );
  await writeLog(db, boss, {
    action: "password_reset",
    entityType: "user",
    entityId: boss.id,
    description: "Le mot de passe du compte propriétaire a été réinitialisé via l'accès développeur.",
  });
}

export async function recordLogout(
  db: SQLiteDatabase,
  user: User,
  reason: "manual" | "inactivity" = "manual",
): Promise<void> {
  await writeLog(db, user, {
    action: "logout",
    entityType: "session",
    description:
      reason === "inactivity"
        ? `${user.name} a été déconnecté après une période d’inactivité.`
        : `${user.name} a verrouillé sa session.`,
  });
}

export async function createUser(
  db: SQLiteDatabase,
  input: UserInput,
  actor: User,
): Promise<void> {
  const employee = await db.getFirstAsync<Employee>(
    `SELECT e.* FROM employees e
     LEFT JOIN users u ON u.employee_id = e.id
     WHERE e.id = ? AND e.is_active = 1 AND u.id IS NULL`,
    input.employeeId,
  );
  if (!employee) {
    throw new Error("Cet employé est introuvable ou possède déjà un compte.");
  }
  const passwordError = validateAccountPassword(input.role, input.password);
  if (passwordError) throw new Error(passwordError);
  const credentials = await createPasswordHash(input.password);
  const timestamp = now();
  const result = await db.runAsync(
    `INSERT INTO users
      (name, username, role, employee_id, password_hash, password_salt, permissions, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    employee.name,
    input.username.trim(),
    input.role,
    employee.id,
    credentials.hash,
    credentials.salt,
    input.permissions ?? null,
    timestamp,
    timestamp,
  );
  await writeLog(db, actor, {
    action: "create",
    entityType: "user",
    entityId: result.lastInsertRowId,
    description: `${actor.name} a créé le compte ${input.role === "manager" ? "gérant" : "employé"} de ${employee.name}.`,
    newValue: {
      name: employee.name,
      employeeId: employee.id,
      username: input.username.trim(),
      role: input.role,
      passwordRequired: Boolean(input.password),
    },
  });
}

export async function updateUserPermissions(
  db: SQLiteDatabase,
  userId: number,
  permissions: string | null,
  actor: User,
): Promise<void> {
  const target = await db.getFirstAsync<{ name: string; role: Role }>(
    "SELECT name, role FROM users WHERE id = ?",
    userId,
  );
  if (!target) throw new Error("Ce compte n’existe plus.");
  if (target.role === "boss") {
    throw new Error("Les permissions du compte Propriétaire ne peuvent pas être modifiées.");
  }
  await db.runAsync(
    "UPDATE users SET permissions = ?, updated_at = ? WHERE id = ?",
    permissions,
    now(),
    userId,
  );
  await writeLog(db, actor, {
    action: "update",
    entityType: "user",
    entityId: userId,
    description: `${actor.name} a modifié les permissions de ${target.name}.`,
    oldValue: { permissions },
    newValue: { permissions },
  });
}

export async function deactivateUser(
  db: SQLiteDatabase,
  user: User,
  actor: User,
): Promise<void> {
  if (user.role === "boss") throw new Error("Le compte Propriétaire ne peut pas être supprimé.");
  await db.runAsync(
    "UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?",
    now(),
    user.id,
  );
  await writeLog(db, actor, {
    action: "deactivate",
    entityType: "user",
    entityId: user.id,
    description: `${actor.name} a désactivé le compte de ${user.name}.`,
    oldValue: { is_active: 1 },
    newValue: { is_active: 0 },
  });
}

export async function listEmployees(
  db: SQLiteDatabase,
  includeInactive = false,
): Promise<Employee[]> {
  return db.getAllAsync<Employee>(
    `SELECT e.*,
      COUNT(o.id) AS order_count,
      COALESCE(SUM(o.total), 0) AS total_sales,
      CASE WHEN u.id IS NULL THEN 0 ELSE 1 END AS has_account,
      u.role AS account_role,
      u.is_active AS account_active
     FROM employees e
     LEFT JOIN orders o ON o.employee_id = e.id
     LEFT JOIN users u ON u.employee_id = e.id
     ${includeInactive ? "" : "WHERE e.is_active = 1"}
     GROUP BY e.id
     ORDER BY e.is_active DESC, e.name`,
  );
}

export async function saveEmployee(
  db: SQLiteDatabase,
  input: EmployeeInput,
  actor: User,
  employeeId?: number,
): Promise<number> {
  const timestamp = now();
  if (employeeId) {
    const previous = await db.getFirstAsync<Employee>(
      "SELECT * FROM employees WHERE id = ?",
      employeeId,
    );
    if (!previous) throw new Error("Employé introuvable.");
    await withWriteTransaction(db, async (transaction) => {
      await transaction.runAsync(
        `UPDATE employees
         SET name = ?, phone = ?, position = ?, updated_at = ?
         WHERE id = ?`,
        input.name.trim(),
        input.phone?.trim() ?? "",
        input.position.trim() || "Employé",
        timestamp,
        employeeId,
      );
      await transaction.runAsync(
        "UPDATE users SET name = ?, updated_at = ? WHERE employee_id = ?",
        input.name.trim(),
        timestamp,
        employeeId,
      );
      await writeLog(transaction, actor, {
        action: "update",
        entityType: "employee",
        entityId: employeeId,
        description: `${actor.name} a modifié la fiche de ${input.name.trim()}.`,
        oldValue: previous,
        newValue: input,
      });
    });
    return employeeId;
  }

  const result = await db.runAsync(
    `INSERT INTO employees
      (name, phone, position, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    input.name.trim(),
    input.phone?.trim() ?? "",
    input.position.trim() || "Employé",
    timestamp,
    timestamp,
  );
  await writeLog(db, actor, {
    action: "create",
    entityType: "employee",
    entityId: result.lastInsertRowId,
    description: `${actor.name} a ajouté ${input.name.trim()} au personnel.`,
    newValue: input,
  });
  return result.lastInsertRowId;
}

export async function deactivateEmployee(
  db: SQLiteDatabase,
  employee: Employee,
  actor: User,
): Promise<void> {
  const linkedBoss = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM users WHERE employee_id = ? AND role = 'boss'",
    employee.id,
  );
  if (linkedBoss) {
    throw new Error("La fiche du propriétaire ne peut pas être désactivée.");
  }
  await withWriteTransaction(db, async (transaction) => {
    await transaction.runAsync(
      "UPDATE employees SET is_active = 0, updated_at = ? WHERE id = ?",
      now(),
      employee.id,
    );
    await transaction.runAsync(
      "UPDATE users SET is_active = 0, updated_at = ? WHERE employee_id = ?",
      now(),
      employee.id,
    );
    await writeLog(transaction, actor, {
      action: "deactivate",
      entityType: "employee",
      entityId: employee.id,
      description: `${actor.name} a désactivé la fiche de ${employee.name}.`,
      oldValue: { is_active: 1 },
      newValue: { is_active: 0 },
    });
  });
}

export async function listAttendanceForDate(
  db: SQLiteDatabase,
  workDate: string,
): Promise<AttendanceRecord[]> {
  return db.getAllAsync<AttendanceRecord>(
    `SELECT
       a.id,
       e.id AS employee_id,
       e.name AS employee_name,
       e.position AS employee_position,
       ? AS work_date,
       a.status,
       a.arrival_at,
       COALESCE(a.note, '') AS note,
       a.recorded_by,
       u.name AS recorded_by_name,
       a.created_at,
       a.updated_at
     FROM employees e
     LEFT JOIN attendance_records a
       ON a.employee_id = e.id AND a.work_date = ?
     LEFT JOIN users u ON u.id = a.recorded_by
     WHERE e.is_active = 1
     ORDER BY e.name`,
    workDate,
    workDate,
  );
}

export async function saveAttendance(
  db: SQLiteDatabase,
  input: AttendanceInput,
  actor: User,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) {
    throw new Error("La date de présence est invalide.");
  }
  const employee = await db.getFirstAsync<Employee>(
    "SELECT * FROM employees WHERE id = ? AND is_active = 1",
    input.employeeId,
  );
  if (!employee) throw new Error("Employé introuvable.");
  const previous = await db.getFirstAsync<AttendanceRecord>(
    "SELECT * FROM attendance_records WHERE employee_id = ? AND work_date = ?",
    input.employeeId,
    input.workDate,
  );
  const timestamp = now();
  const arrivalAt = input.status === "present" ? input.arrivalAt : null;
  if (input.status === "present" && !arrivalAt) {
    throw new Error("Indiquez l’heure d’arrivée.");
  }
  if (
    input.status === "absent_justified" &&
    (input.note?.trim().length ?? 0) < 2
  ) {
    throw new Error("Indiquez la raison de l’absence justifiée.");
  }
  await withWriteTransaction(db, async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO attendance_records
        (employee_id, work_date, status, arrival_at, note, recorded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(employee_id, work_date) DO UPDATE SET
         status = excluded.status,
         arrival_at = excluded.arrival_at,
         note = excluded.note,
         recorded_by = excluded.recorded_by,
         updated_at = excluded.updated_at`,
      input.employeeId,
      input.workDate,
      input.status,
      arrivalAt,
      input.note?.trim() ?? "",
      actor.id,
      timestamp,
      timestamp,
    );
    const current = await transaction.getFirstAsync<AttendanceRecord>(
      "SELECT * FROM attendance_records WHERE employee_id = ? AND work_date = ?",
      input.employeeId,
      input.workDate,
    );
    const statusDescription =
      input.status === "present"
        ? "présent"
        : input.status === "absent_justified"
          ? "absent avec justification"
          : "absent sans justification";
    await writeLog(transaction, actor, {
      action: previous ? "update" : "create",
      entityType: "attendance",
      entityId: current?.id ?? null,
      description: `${actor.name} a marqué ${employee.name} ${statusDescription} le ${input.workDate}.`,
      oldValue: previous ?? undefined,
      newValue: current ?? input,
    });
  });
}

async function ensureCategory(
  db: SQLiteDatabase,
  name: string,
  timestamp: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.runAsync(
    "INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)",
    trimmed,
    timestamp,
  );
}

export async function listCategories(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM (
       SELECT name FROM categories
       UNION
       SELECT DISTINCT category AS name FROM products WHERE category <> ''
     )
     ORDER BY CASE WHEN name = 'Général' THEN 0 ELSE 1 END, name COLLATE NOCASE`,
  );
  return rows.map((row) => row.name);
}

export async function createCategory(
  db: SQLiteDatabase,
  name: string,
  actor: User,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error(
      "Le nom de la catégorie doit contenir au moins 2 caractères.",
    );
  }
  const timestamp = now();
  await ensureCategory(db, trimmed, timestamp);
  await writeLog(db, actor, {
    action: "create",
    entityType: "category",
    description: `${actor.name} a créé la catégorie ${trimmed}.`,
    newValue: { name: trimmed },
  });
}

export async function listProducts(db: SQLiteDatabase): Promise<Product[]> {
  return db.getAllAsync<Product>(
    `SELECT * FROM products WHERE is_active = 1
     ORDER BY CASE
       WHEN tracks_stock = 1 AND stock <= low_stock_threshold THEN 0
       ELSE 1
     END, name`,
  );
}

export async function saveProduct(
  db: SQLiteDatabase,
  input: ProductInput,
  actor: User,
  productId?: number,
): Promise<void> {
  const timestamp = now();
  await ensureCategory(db, input.category.trim() || "Général", timestamp);
  if (productId) {
    const previous = await db.getFirstAsync<Product>(
      "SELECT * FROM products WHERE id = ?",
      productId,
    );
    if (!previous) throw new Error("Produit introuvable.");
    await db.runAsync(
      `UPDATE products SET name = ?, sku = ?, category = ?, price = ?,
       low_stock_threshold = ?, tracks_stock = ?, updated_at = ? WHERE id = ?`,
      input.name.trim(),
      input.sku?.trim() || null,
      input.category.trim() || "Général",
      input.price,
      input.lowStockThreshold,
      input.tracksStock ? 1 : 0,
      timestamp,
      productId,
    );
    await writeLog(db, actor, {
      action: "update",
      entityType: "product",
      entityId: productId,
      description: `${actor.name} a modifié le produit ${input.name.trim()}.`,
      oldValue: previous,
      newValue: input,
    });
    return;
  }

  const result = await db.runAsync(
    `INSERT INTO products
      (name, sku, category, price, stock, low_stock_threshold, tracks_stock, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    input.name.trim(),
    input.sku?.trim() || null,
    input.category.trim() || "Général",
    input.price,
    input.stock,
    input.lowStockThreshold,
    input.tracksStock ? 1 : 0,
    timestamp,
    timestamp,
  );
  if (input.tracksStock && input.stock > 0) {
    await db.runAsync(
      `INSERT INTO stock_movements
        (product_id, user_id, type, quantity, before_stock, after_stock, reason, created_at)
       VALUES (?, ?, 'restock', ?, 0, ?, 'Stock initial', ?)`,
      result.lastInsertRowId,
      actor.id,
      input.stock,
      input.stock,
      timestamp,
    );
  }
  await writeLog(db, actor, {
    action: "create",
    entityType: "product",
    entityId: result.lastInsertRowId,
    description: input.tracksStock
      ? `${actor.name} a ajouté le produit ${input.name.trim()} avec ${input.stock} unité(s).`
      : `${actor.name} a ajouté le produit ${input.name.trim()} avec un stock illimité.`,
    newValue: input,
  });
}

export async function adjustStock(
  db: SQLiteDatabase,
  product: Product,
  newStock: number,
  reason: string,
  actor: User,
): Promise<void> {
  if (!product.tracks_stock) {
    throw new Error("Ce produit a un stock illimité.");
  }
  if (newStock < 0) throw new Error("Le stock ne peut pas être négatif.");
  const delta = newStock - product.stock;
  await withWriteTransaction(db, async (transaction) => {
    await transaction.runAsync(
      "UPDATE products SET stock = ?, updated_at = ? WHERE id = ?",
      newStock,
      now(),
      product.id,
    );
    await transaction.runAsync(
      `INSERT INTO stock_movements
        (product_id, user_id, type, quantity, before_stock, after_stock, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      product.id,
      actor.id,
      delta >= 0 ? "restock" : "adjustment",
      delta,
      product.stock,
      newStock,
      reason.trim() || "Ajustement manuel",
      now(),
    );
    await writeLog(transaction, actor, {
      action: "stock_adjust",
      entityType: "product",
      entityId: product.id,
      description: `${actor.name} a ajusté le stock de ${product.name} : ${product.stock} → ${newStock}.`,
      oldValue: { stock: product.stock },
      newValue: { stock: newStock, reason: reason.trim() },
    });
  });
}

export async function archiveProduct(
  db: SQLiteDatabase,
  product: Product,
  actor: User,
): Promise<void> {
  await db.runAsync(
    "UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?",
    now(),
    product.id,
  );
  await writeLog(db, actor, {
    action: "archive",
    entityType: "product",
    entityId: product.id,
    description: `${actor.name} a archivé le produit ${product.name}.`,
    oldValue: { is_active: 1 },
    newValue: { is_active: 0 },
  });
}

export async function listClients(db: SQLiteDatabase): Promise<Client[]> {
  return db.getAllAsync<Client>(
    `SELECT c.*,
      COUNT(o.id) AS order_count,
      COALESCE(SUM(o.total), 0) AS total_spent
     FROM clients c
     LEFT JOIN orders o ON o.client_id = c.id
     GROUP BY c.id
     ORDER BY c.name`,
  );
}

export async function saveClient(
  db: SQLiteDatabase,
  input: ClientInput,
  actor: User,
  clientId?: number,
): Promise<number> {
  const timestamp = now();
  if (clientId) {
    const previous = await db.getFirstAsync<Client>(
      "SELECT * FROM clients WHERE id = ?",
      clientId,
    );
    if (!previous) throw new Error("Client introuvable.");
    await db.runAsync(
      "UPDATE clients SET name = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?",
      input.name.trim(),
      input.phone.trim(),
      input.address?.trim() || null,
      timestamp,
      clientId,
    );
    await writeLog(db, actor, {
      action: "update",
      entityType: "client",
      entityId: clientId,
      description: `${actor.name} a modifié la fiche client de ${input.name.trim()}.`,
      oldValue: previous,
      newValue: input,
    });
    return clientId;
  }

  const result = await db.runAsync(
    `INSERT INTO clients (name, phone, address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.name.trim(),
    input.phone.trim(),
    input.address?.trim() || null,
    timestamp,
    timestamp,
  );
  await writeLog(db, actor, {
    action: "create",
    entityType: "client",
    entityId: result.lastInsertRowId,
    description: `${actor.name} a ajouté le client ${input.name.trim()} (${input.phone.trim()}).`,
    newValue: input,
  });
  return result.lastInsertRowId;
}

export async function deleteClient(
  db: SQLiteDatabase,
  client: Client,
  actor: User,
): Promise<void> {
  const appointments = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM appointments WHERE client_id = ?",
    client.id,
  );
  if ((appointments?.count ?? 0) > 0) {
    throw new Error(
      "Ce client est lié à l’historique des rendez-vous. Sa fiche doit être conservée.",
    );
  }
  await db.runAsync("DELETE FROM clients WHERE id = ?", client.id);
  await writeLog(db, actor, {
    action: "delete",
    entityType: "client",
    entityId: client.id,
    description: `${actor.name} a supprimé la fiche client de ${client.name}.`,
    oldValue: client,
  });
}

const appointmentSelect = `
  SELECT a.*, c.name AS client_name, c.phone AS client_phone,
    p.name AS product_name, u.name AS created_by_name
  FROM appointments a
  JOIN clients c ON c.id = a.client_id
  LEFT JOIN products p ON p.id = a.product_id
  JOIN users u ON u.id = a.created_by
`;

export async function listAppointments(
  db: SQLiteDatabase,
): Promise<Appointment[]> {
  return db.getAllAsync<Appointment>(
    `${appointmentSelect}
     ORDER BY
       CASE WHEN a.status = 'scheduled' AND a.scheduled_at >= ? THEN 0
            WHEN a.status = 'scheduled' THEN 1 ELSE 2 END,
       CASE WHEN a.status = 'scheduled' AND a.scheduled_at >= ? THEN a.scheduled_at END ASC,
       a.scheduled_at DESC`,
    now(),
    now(),
  );
}

export async function saveAppointment(
  db: SQLiteDatabase,
  input: AppointmentInput,
  actor: User,
  appointmentId?: number,
): Promise<Appointment> {
  const timestamp = now();
  const client = await db.getFirstAsync<Client>(
    "SELECT * FROM clients WHERE id = ?",
    input.clientId,
  );
  if (!client) throw new Error("Le client choisi n’existe plus.");
  if (input.productId) {
    const product = await db.getFirstAsync<Product>(
      "SELECT * FROM products WHERE id = ? AND is_active = 1",
      input.productId,
    );
    if (!product) throw new Error("Le produit choisi n’est plus disponible.");
  }

  let id = appointmentId ?? 0;
  if (appointmentId) {
    const previous = await db.getFirstAsync<Appointment>(
      `${appointmentSelect} WHERE a.id = ?`,
      appointmentId,
    );
    if (!previous) throw new Error("Rendez-vous introuvable.");
    await db.runAsync(
      `UPDATE appointments
       SET client_id = ?, product_id = ?, scheduled_at = ?, reminder_minutes = ?, notes = ?,
           status = 'scheduled', updated_at = ?
       WHERE id = ?`,
      input.clientId,
      input.productId,
      input.scheduledAt,
      input.reminderMinutes,
      input.notes?.trim() ?? "",
      timestamp,
      appointmentId,
    );
    await writeLog(db, actor, {
      action: "update",
      entityType: "appointment",
      entityId: appointmentId,
      description: `${actor.name} a modifié le rendez-vous de ${client.name}.`,
      oldValue: previous,
      newValue: input,
    });
  } else {
    const result = await db.runAsync(
      `INSERT INTO appointments
        (client_id, product_id, scheduled_at, reminder_minutes, notes, status, notification_id,
         created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'scheduled', NULL, ?, ?, ?)`,
      input.clientId,
      input.productId,
      input.scheduledAt,
      input.reminderMinutes,
      input.notes?.trim() ?? "",
      actor.id,
      timestamp,
      timestamp,
    );
    id = result.lastInsertRowId;
    await writeLog(db, actor, {
      action: "create",
      entityType: "appointment",
      entityId: id,
      description: `${actor.name} a créé un rendez-vous pour ${client.name}.`,
      newValue: input,
    });
  }

  const appointment = await db.getFirstAsync<Appointment>(
    `${appointmentSelect} WHERE a.id = ?`,
    id,
  );
  if (!appointment) {
    throw new Error("Le rendez-vous a été enregistré mais ne peut pas être relu.");
  }
  return appointment;
}

export async function setAppointmentNotificationId(
  db: SQLiteDatabase,
  appointmentId: number,
  notificationId: string | null,
): Promise<void> {
  await db.runAsync(
    "UPDATE appointments SET notification_id = ? WHERE id = ?",
    notificationId,
    appointmentId,
  );
}

export async function updateAppointmentStatus(
  db: SQLiteDatabase,
  appointment: Appointment,
  status: AppointmentStatus,
  actor: User,
): Promise<void> {
  await db.runAsync(
    "UPDATE appointments SET status = ?, notification_id = NULL, updated_at = ? WHERE id = ?",
    status,
    now(),
    appointment.id,
  );
  const label =
    status === "completed" ? "terminé" : status === "cancelled" ? "annulé" : "planifié";
  await writeLog(db, actor, {
    action: "status_change",
    entityType: "appointment",
    entityId: appointment.id,
    description: `${actor.name} a marqué le rendez-vous de ${appointment.client_name} comme ${label}.`,
    oldValue: { status: appointment.status },
    newValue: { status },
  });
}

export async function listOrders(
  db: SQLiteDatabase,
  limit = 100,
): Promise<Order[]> {
  return db.getAllAsync<Order>(
    `SELECT o.*, c.name AS client_name, u.name AS user_name,
      COALESCE(o.employee_name, e.name) AS employee_name,
      COALESCE(SUM(oi.quantity), 0) AS item_count
     FROM orders o
     LEFT JOIN clients c ON c.id = o.client_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN employees e ON e.id = o.employee_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT ?`,
    limit,
  );
}

export async function createOrder(
  db: SQLiteDatabase,
  cart: CartLine[],
  clientId: number | null,
  paymentMethod: PaymentMethod,
  employeeId: number,
  actor: User,
): Promise<Order> {
  if (cart.length === 0) throw new Error("Ajoutez au moins un produit.");
  const timestamp = now();
  const orderNumber = `CMD-${timestamp
    .replace(/\D/g, "")
    .slice(2, 14)}-${Math.floor(Math.random() * 90 + 10)}`;

  let createdOrderId = 0;
  await withWriteTransaction(db, async (transaction) => {
    const employee = await transaction.getFirstAsync<Employee>(
      "SELECT * FROM employees WHERE id = ? AND is_active = 1",
      employeeId,
    );
    if (!employee) {
      throw new Error("Choisissez un employé actif pour attribuer la vente.");
    }
    let total = 0;
    const checked: Array<{ line: CartLine; current: Product }> = [];
    for (const line of cart) {
      const current = await transaction.getFirstAsync<Product>(
        "SELECT * FROM products WHERE id = ? AND is_active = 1",
        line.product.id,
      );
      if (!current) throw new Error(`${line.product.name} n’est plus disponible.`);
      if (current.tracks_stock && line.quantity > current.stock) {
        throw new Error(
          `Stock insuffisant pour ${current.name} : ${current.stock} disponible(s).`,
        );
      }
      total += current.price * line.quantity;
      checked.push({ line, current });
    }

    const orderResult = await transaction.runAsync(
      `INSERT INTO orders
        (order_number, client_id, user_id, employee_id, employee_name, total, payment_method, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
      orderNumber,
      clientId,
      actor.id,
      employee.id,
      employee.name,
      total,
      paymentMethod,
      timestamp,
    );
    createdOrderId = orderResult.lastInsertRowId;

    for (const { line, current } of checked) {
      await transaction.runAsync(
        `INSERT INTO order_items
          (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        createdOrderId,
        current.id,
        current.name,
        current.price,
        line.quantity,
        current.price * line.quantity,
      );
      if (current.tracks_stock) {
        const afterStock = current.stock - line.quantity;
        await transaction.runAsync(
          "UPDATE products SET stock = ?, updated_at = ? WHERE id = ?",
          afterStock,
          timestamp,
          current.id,
        );
        await transaction.runAsync(
          `INSERT INTO stock_movements
            (product_id, user_id, type, quantity, before_stock, after_stock, reason, created_at)
           VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
          current.id,
          actor.id,
          -line.quantity,
          current.stock,
          afterStock,
          `Vente ${orderNumber}`,
          timestamp,
        );
      }
    }

    await writeLog(transaction, actor, {
      action: "sale",
      entityType: "order",
      entityId: createdOrderId,
      description: `${actor.name} a encaissé la commande ${orderNumber} pour ${employee.name} — ${total} FC — ${paymentMethod === "cash" ? "Espèces" : paymentMethod === "card" ? "Carte" : "Mobile Money"}.`,
      newValue: {
        orderNumber,
        clientId,
        employeeId: employee.id,
        employeeName: employee.name,
        total,
        paymentMethod,
        items: checked.map(({ line, current }) => ({
          productId: current.id,
          name: current.name,
          quantity: line.quantity,
          unitPrice: current.price,
        })),
      },
    });
  });

  const order = await db.getFirstAsync<Order>(
    `SELECT o.*, c.name AS client_name, u.name AS user_name,
      COALESCE(o.employee_name, e.name) AS employee_name,
      (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o
     LEFT JOIN clients c ON c.id = o.client_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN employees e ON e.id = o.employee_id
     WHERE o.id = ?`,
    createdOrderId,
  );
  if (!order) throw new Error("La commande a été créée mais ne peut pas être relue.");
  return order;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startForPeriod(period: StatisticsPeriod, date: Date): Date {
  if (period === "today") return startOfDay(date);
  if (period === "week") return startOfWeek(date);
  return startOfMonth(date);
}

export async function getStatistics(
  db: SQLiteDatabase,
  period: StatisticsPeriod,
): Promise<StatisticsData> {
  const startAt = startForPeriod(period, new Date()).toISOString();
  const [summary, clients, topProducts, topEmployees, revenueByDay, recentOrders] =
    await Promise.all([
      db.getFirstAsync<{
        revenue: number;
        orderCount: number;
        itemsSold: number;
      }>(
        `SELECT
          COALESCE(SUM(total), 0) AS revenue,
          COUNT(*) AS orderCount,
          COALESCE((
            SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders item_order ON item_order.id = oi.order_id
            WHERE item_order.created_at >= ?
          ), 0) AS itemsSold
         FROM orders
         WHERE created_at >= ?`,
        startAt,
        startAt,
      ),
      db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM clients WHERE created_at >= ?",
        startAt,
      ),
      db.getAllAsync<StatisticsData["topProducts"][number]>(
        `SELECT oi.product_id AS id, oi.product_name AS name,
          SUM(oi.quantity) AS quantity, SUM(oi.subtotal) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= ?
         GROUP BY oi.product_id, oi.product_name
         ORDER BY quantity DESC, revenue DESC
         LIMIT 8`,
        startAt,
      ),
      db.getAllAsync<StatisticsData["topEmployees"][number]>(
        `SELECT o.employee_id AS id,
          COALESCE(o.employee_name, e.name, 'Non attribuée') AS name,
          COUNT(*) AS orderCount, SUM(o.total) AS revenue
         FROM orders o
         LEFT JOIN employees e ON e.id = o.employee_id
         WHERE o.created_at >= ?
         GROUP BY o.employee_id, COALESCE(o.employee_name, e.name, 'Non attribuée')
         ORDER BY revenue DESC, orderCount DESC
         LIMIT 8`,
        startAt,
      ),
      db.getAllAsync<StatisticsData["revenueByDay"][number]>(
        `SELECT date(created_at, 'localtime') AS day,
          SUM(total) AS revenue, COUNT(*) AS orderCount
         FROM orders
         WHERE created_at >= ?
         GROUP BY date(created_at, 'localtime')
         ORDER BY day ASC`,
        startAt,
      ),
      listOrders(db, 8),
    ]);

  const revenue = summary?.revenue ?? 0;
  const orderCount = summary?.orderCount ?? 0;
  return {
    period,
    startAt,
    revenue,
    orderCount,
    itemsSold: summary?.itemsSold ?? 0,
    averageBasket: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
    newClients: clients?.count ?? 0,
    topProducts,
    topEmployees,
    revenueByDay,
    recentOrders,
  };
}

export async function getDashboardStats(
  db: SQLiteDatabase,
): Promise<DashboardStats> {
  const current = new Date();
  const day = startOfDay(current).toISOString();
  const week = startOfWeek(current).toISOString();
  const month = startOfMonth(current).toISOString();

  const [revenue, clients, employees, lowStock, topProducts, recentOrders] =
    await Promise.all([
      db.getFirstAsync<{
        revenueToday: number;
        revenueWeek: number;
        revenueMonth: number;
        ordersToday: number;
      }>(
        `SELECT
          COALESCE(SUM(CASE WHEN created_at >= ? THEN total ELSE 0 END), 0) AS revenueToday,
          COALESCE(SUM(CASE WHEN created_at >= ? THEN total ELSE 0 END), 0) AS revenueWeek,
          COALESCE(SUM(CASE WHEN created_at >= ? THEN total ELSE 0 END), 0) AS revenueMonth,
          COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS ordersToday
         FROM orders`,
        day,
        week,
        month,
        day,
      ),
      db.getFirstAsync<{
        newClientsToday: number;
        newClientsWeek: number;
        newClientsMonth: number;
      }>(
        `SELECT
          COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS newClientsToday,
          COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS newClientsWeek,
          COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS newClientsMonth
         FROM clients`,
        day,
        week,
        month,
      ),
      db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM employees WHERE is_active = 1",
      ),
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM products
         WHERE is_active = 1 AND tracks_stock = 1 AND stock <= low_stock_threshold`,
      ),
      db.getAllAsync<{ name: string; quantity: number; revenue: number }>(
        `SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity,
          SUM(oi.subtotal) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= ?
         GROUP BY oi.product_id, oi.product_name
         ORDER BY quantity DESC
         LIMIT 5`,
        month,
      ),
      listOrders(db, 5),
    ]);

  return {
    revenueToday: revenue?.revenueToday ?? 0,
    revenueWeek: revenue?.revenueWeek ?? 0,
    revenueMonth: revenue?.revenueMonth ?? 0,
    ordersToday: revenue?.ordersToday ?? 0,
    newClientsToday: clients?.newClientsToday ?? 0,
    newClientsWeek: clients?.newClientsWeek ?? 0,
    newClientsMonth: clients?.newClientsMonth ?? 0,
    activeEmployees: employees?.count ?? 0,
    lowStockCount: lowStock?.count ?? 0,
    topProducts,
    recentOrders,
  };
}

export async function listLogs(
  db: SQLiteDatabase,
  limit = 250,
): Promise<ActivityLog[]> {
  return db.getAllAsync<ActivityLog>(
    "SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?",
    limit,
  );
}

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
  actor: User,
): Promise<void> {
  const previous = await getSetting(db, key);
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
  await writeLog(db, actor, {
    action: "update",
    entityType: "setting",
    description: `${actor.name} a modifié le paramètre ${key}.`,
    oldValue: { value: previous },
    newValue: { value },
  });
}

export async function seedDemoData(
  db: SQLiteDatabase,
  actor: User,
): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM products
     WHERE sku IN ('RIZ-5KG', 'HUILE-1L', 'SAVON-MEN', 'SUCRE-1KG')`,
  );
  if ((existing?.count ?? 0) > 0) {
    throw new Error("Les données de démonstration ont déjà été ajoutées.");
  }
  const products: ProductInput[] = [
    {
      name: "Riz 5 kg",
      sku: "RIZ-5KG",
      category: "Alimentation",
      price: 18000,
      stock: 24,
      lowStockThreshold: 5,
      tracksStock: true,
    },
    {
      name: "Huile 1 L",
      sku: "HUILE-1L",
      category: "Alimentation",
      price: 6500,
      stock: 18,
      lowStockThreshold: 4,
      tracksStock: true,
    },
    {
      name: "Savon de ménage",
      sku: "SAVON-MEN",
      category: "Maison",
      price: 2500,
      stock: 32,
      lowStockThreshold: 8,
      tracksStock: true,
    },
    {
      name: "Sucre 1 kg",
      sku: "SUCRE-1KG",
      category: "Alimentation",
      price: 4200,
      stock: 3,
      lowStockThreshold: 5,
      tracksStock: true,
    },
  ];
  for (const product of products) {
    await saveProduct(db, product, actor);
  }
  await saveClient(
    db,
    { name: "Chantal Ilunga", phone: "+243 812 345 678", address: "Kinshasa" },
    actor,
  );
  await writeLog(db, actor, {
    action: "seed",
    entityType: "database",
    description: `${actor.name} a chargé les données de démonstration.`,
  });
}
