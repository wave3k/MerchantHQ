import { Hono } from "hono";
import { cors } from "hono/cors";
import { sendVerificationEmail, addContactToAudience, sendWelcomeEmail } from "./emails";

type Env = {
  TURSO_URL: string;
  TURSO_TOKEN: string;
  ENVIRONMENT?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_AUDIENCE_ID?: string;
  ADMIN_PASSWORD?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_ACCOUNTS_RESET?: string;
};

type SqlValue = { type: string; value?: string | null };
type Stmt = { sql: string; args?: SqlValue[] };
type Request = { type: string; stmt?: Stmt };

type Row = { cols?: Array<{ name?: string }>; rows?: Array<Array<{ type?: string; value?: string | null }>> };
type PipelineResponse = { results?: Array<{ type: string; error?: { message?: string }; response?: { result?: Row } }> };

const app = new Hono<{ Bindings: Env }>();
app.use("/*", cors({
  origin: (origin, c) => {
    const configured = (c.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value: string) => value.trim())
      .filter(Boolean);
    const allowed = new Set([
      "https://hqmerchant.xyz",
      "https://www.hqmerchant.xyz",
      "https://admin.hqmerchant.xyz",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8081",
      "http://localhost:19006",
      ...configured,
    ]);
    return allowed.has(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.notFound((c) => c.json({ error: "Ressource introuvable." }, 404));

app.onError((error, c) => {
  // Journalisation structurée : aucune donnée sensible, aucune stack exposée.
  console.error(
    JSON.stringify({
      level: "error",
      message: "Erreur non gérée du worker",
      path: new URL(c.req.url).pathname,
      method: c.req.method,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return c.json(
    { error: "Une erreur interne est survenue. Réessayez plus tard." },
    500,
  );
});

function pipelineUrl(url: string): string {
  return url.trim().replace(/^libsql:\/\//i, "https://").replace(/\/+$/, "") + "/v2/pipeline";
}

function text(value: string): SqlValue {
  return { type: "text", value };
}
function integer(value: number): SqlValue {
  return { type: "integer", value: String(value) };
}

class TursoQueryError extends Error {}

const TURSO_TIMEOUT_MS = 8_000;
const TURSO_MAX_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pipeline(c: { env: Env }, requests: Request[]): Promise<PipelineResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TURSO_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TURSO_TIMEOUT_MS);
    try {
      const res = await fetch(pipelineUrl(c.env.TURSO_URL), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.TURSO_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        if (!retryable) {
          throw new TursoQueryError(`Turso HTTP ${res.status}`);
        }
        lastError = new Error(`Turso HTTP ${res.status}`);
        if (attempt >= TURSO_MAX_ATTEMPTS) throw lastError;
        await delay(150 * attempt);
        continue;
      }
      const body = (await res.json()) as PipelineResponse;
      const failed = body.results?.find((r) => r.type === "error");
      if (failed) {
        // Erreur SQL : réessayer ne changerait rien.
        throw new TursoQueryError(
          failed.error?.message ?? "Turso n’a pas exécuté la requête.",
        );
      }
      return body;
    } catch (caught) {
      if (caught instanceof TursoQueryError) throw caught;
      // Timeout, réseau ou réponse illisible : on retente avec un backoff.
      lastError = caught;
      if (attempt >= TURSO_MAX_ATTEMPTS) throw caught;
      await delay(150 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Turso est momentanément indisponible.");
}

function rowOf(body: PipelineResponse, index: number): Record<string, string> | null {
  const result = body.results?.[index]?.response?.result;
  const row = result?.rows?.[0];
  if (!row) return null;
  const output: Record<string, string> = {};
  result?.cols?.forEach((column, i) => {
    if (column.name) output[column.name] = row[i]?.value ?? "";
  });
  return output;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    subscription_type TEXT NOT NULL DEFAULT '',
    subscription_expires_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS email_verifications (
    account_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS merchant_profiles (
    account_id TEXT PRIMARY KEY,
    has_data INTEGER NOT NULL DEFAULT 0,
    last_backup_at TEXT,
    last_backup_business_date TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS shops (
    shop_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shops_account ON shops(account_id)`,
  `CREATE TABLE IF NOT EXISTS commerce_manager_backups (
    backup_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    shop_id TEXT NOT NULL DEFAULT '',
    device_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    snapshot_at TEXT NOT NULL,
    app_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    UNIQUE(account_id, shop_id, business_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_backups_account ON commerce_manager_backups(account_id)`,
  `CREATE TABLE IF NOT EXISTS commerce_latest_backup (
    singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
    account_id TEXT NOT NULL,
    shop_id TEXT NOT NULL DEFAULT '',
    backup_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    snapshot_at TEXT NOT NULL,
    app_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_tokens_account ON auth_tokens(account_id)`,
  `CREATE TABLE IF NOT EXISTS subscription_codes (
    code TEXT PRIMARY KEY,
    account_id TEXT NOT NULL DEFAULT '',
    subscription_type TEXT NOT NULL,
    days INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    activated_at TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL DEFAULT '',
    used INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT '{}',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    last_at TEXT NOT NULL,
    blocked_until TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reg_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reg_log_ip ON reg_log(ip, created_at)`,
  `CREATE TABLE IF NOT EXISTS resend_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_resend_log_ip ON resend_log(ip, created_at)`,
];

async function tableHasColumn(c: { env: Env }, table: string, column: string): Promise<boolean> {
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: `PRAGMA table_info(${table})` } },
    { type: "close" },
  ]);
  const columns = result.results?.[0]?.response?.result?.rows ?? [];
  return columns.some((row) => row[1]?.value === column);
}

async function migrateBackupsSchema(c: { env: Env }): Promise<void> {
  const hasShop = await tableHasColumn(c, "commerce_manager_backups", "shop_id");
  if (hasShop) return;
  await pipeline(c, [
    { type: "execute", stmt: { sql: `ALTER TABLE commerce_manager_backups RENAME TO commerce_manager_backups_old` } },
    {
      type: "execute",
      stmt: {
        sql: `CREATE TABLE commerce_manager_backups (
          backup_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          shop_id TEXT NOT NULL DEFAULT '',
          device_id TEXT NOT NULL,
          business_date TEXT NOT NULL,
          snapshot_at TEXT NOT NULL,
          app_version TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          payload TEXT NOT NULL,
          UNIQUE(account_id, shop_id, business_date)
        )`,
      },
    },
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO commerce_manager_backups (backup_id, account_id, shop_id, device_id, business_date, snapshot_at, app_version, schema_version, payload)
              SELECT backup_id, account_id, '', device_id, business_date, snapshot_at, app_version, schema_version, payload FROM commerce_manager_backups_old`,
      },
    },
    { type: "execute", stmt: { sql: `DROP TABLE commerce_manager_backups_old` } },
    { type: "execute", stmt: { sql: `CREATE INDEX IF NOT EXISTS idx_backups_account ON commerce_manager_backups(account_id)` } },
    { type: "close" },
  ]);
  const latestHasShop = await tableHasColumn(c, "commerce_latest_backup", "shop_id");
  if (!latestHasShop) {
    await pipeline(c, [
      { type: "execute", stmt: { sql: `ALTER TABLE commerce_latest_backup ADD COLUMN shop_id TEXT NOT NULL DEFAULT ''` } },
      { type: "close" },
    ]);
  }
}

// Les comptes passent du "username" à l'adresse e-mail. Les anciens comptes
// "username" sont incompatibles avec le nouveau login par e-mail : la table
// accounts est reconstruite (vidée) au premier déploiement.
async function migrateAccountsEmail(c: { env: Env }): Promise<void> {
  const hasEmail = await tableHasColumn(c, "accounts", "email");
  if (hasEmail) return;
  // Migration destructive : elle ne s'exécute que si elle est explicitement
  // autorisée. L'ancienne table est conservée (accounts_legacy) pour permettre
  // une récupération manuelle des données.
  if (c.env.ALLOW_ACCOUNTS_RESET !== "1") {
    throw new Error(
      "La réinitialisation de la table accounts nécessite ALLOW_ACCOUNTS_RESET=1.",
    );
  }
  await pipeline(c, [
    { type: "execute", stmt: { sql: `ALTER TABLE accounts RENAME TO accounts_legacy` } },
    {
      type: "execute",
      stmt: {
        sql: `CREATE TABLE accounts (
          account_id TEXT PRIMARY KEY,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          shop_name TEXT NOT NULL,
          email_verified INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )`,
      },
    },
    { type: "execute", stmt: { sql: `DELETE FROM auth_tokens` } },
    { type: "close" },
  ]);
}

async function ensureEmailVerifiedColumn(c: { env: Env }): Promise<void> {
  const hasVerified = await tableHasColumn(c, "accounts", "email_verified");
  if (hasVerified) return;
  await pipeline(c, [
    { type: "execute", stmt: { sql: `ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0` } },
    { type: "close" },
  ]);
}

async function ensureSubscriptionColumns(c: { env: Env }): Promise<void> {
  const hasSub = await tableHasColumn(c, "accounts", "subscription_type");
  if (hasSub) return;
  await pipeline(c, [
    { type: "execute", stmt: { sql: `ALTER TABLE accounts ADD COLUMN subscription_type TEXT NOT NULL DEFAULT ''` } },
    { type: "execute", stmt: { sql: `ALTER TABLE accounts ADD COLUMN subscription_expires_at TEXT NOT NULL DEFAULT ''` } },
    { type: "close" },
  ]);
}

async function ensureProfileColumn(c: { env: Env }): Promise<void> {
  const hasProfile = await tableHasColumn(c, "accounts", "merchant_profile");
  if (hasProfile) return;
  await pipeline(c, [
    { type: "execute", stmt: { sql: `ALTER TABLE accounts ADD COLUMN merchant_profile TEXT NOT NULL DEFAULT ''` } },
    { type: "close" },
  ]);
}

const DEFAULT_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 15,
    permissions: {
      tablets: 1,
      cashiers: 2,
      backup: "2x_week",
      reports: "basic",
      export_excel: false,
      tickets: false,
      support: "whatsapp",
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: 25,
    permissions: {
      tablets: 1,
      cashiers: 0,
      backup: "nightly",
      reports: "advanced",
      export_excel: false,
      tickets: false,
      support: "whatsapp",
    },
  },
  {
    id: "big",
    name: "Big",
    price: 45,
    permissions: {
      tablets: 3,
      cashiers: 0,
      backup: "realtime",
      reports: "advanced",
      export_excel: true,
      tickets: true,
      support: "vip",
    },
  },
];

async function seedPlans(c: { env: Env }): Promise<void> {
  const now = new Date().toISOString();
  for (const plan of DEFAULT_PLANS) {
    await pipeline(c, [
      {
        type: "execute",
        stmt: {
          sql: `INSERT INTO plans (id, name, price_monthly, permissions, is_default, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  price_monthly = excluded.price_monthly,
                  permissions = excluded.permissions,
                  updated_at = excluded.updated_at`,
          args: [text(plan.id), text(plan.name), integer(plan.price), text(JSON.stringify(plan.permissions)), text(now), text(now)],
        },
      },
      { type: "close" },
    ]);
  }
}

// Le schéma complet (tables + migrations + seed des plans) est vérifié une
// seule fois par instance Worker puis mis en cache : cela évite plusieurs
// PRAGMA et migrations coûteuses à chaque requête.
let schemaReadyAt = 0;
const SCHEMA_TTL_MS = 60 * 60 * 1000;

async function ensureSchema(c: { env: Env }): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - schemaReadyAt < SCHEMA_TTL_MS) return;

  const requests: Request[] = SCHEMA_STATEMENTS.map((sql) => ({ type: "execute", stmt: { sql } }));
  requests.push({ type: "close" });
  await pipeline(c, requests);
  await migrateBackupsSchema(c);
  await migrateAccountsEmail(c);
  await ensureEmailVerifiedColumn(c);
  await ensureSubscriptionColumns(c);
  await ensureProfileColumn(c);
  await seedPlans(c);
  // Purge des anciens compteurs d'inscription (régime `reg:`), remplacés par reg_log.
  await pipeline(c, [
    { type: "execute", stmt: { sql: "DELETE FROM auth_attempts WHERE key LIKE 'reg:%'" } },
    { type: "close" },
  ]);
  schemaReadyAt = nowMs;
}

// --- Password hashing (PBKDF2-SHA256, format compatible avec l'app : pbkdf2-v2$iterations$hex) ---
const PASSWORD_ITERATIONS = 60_000;

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const iterations = PASSWORD_ITERATIONS;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  const hex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2-v2$${iterations}$${hex}`;
}

function randomHex(bytes: number): string {
  const out = new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return Array.from(out).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function issueToken(c: { env: Env }, accountId: string): Promise<string> {
  const token = randomHex(32);
  const now = new Date().toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "INSERT INTO auth_tokens (token, account_id, created_at) VALUES (?, ?, ?)", args: [text(token), text(accountId), text(now)] } },
    { type: "close" },
  ]);
  return token;
}

// --- Sécurité : rate limiting et expiration des tokens ---
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_BLOCK_MS = 15 * 60 * 1000; // 15 minutes
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

async function isLoginBlocked(c: { env: Env }, key: string): Promise<boolean> {
  const now = Date.now();
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "SELECT blocked_until FROM auth_attempts WHERE key = ?",
        args: [text(key)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row?.blocked_until) return false;
  return Date.parse(row.blocked_until) > now;
}

async function registerLoginFailure(c: { env: Env }, key: string): Promise<void> {
  const now = new Date().toISOString();
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO auth_attempts (key, count, last_at, blocked_until)
              VALUES (?, 1, ?, NULL)
              ON CONFLICT(key) DO UPDATE SET
                count = auth_attempts.count + 1,
                last_at = excluded.last_at,
                blocked_until = CASE
                  WHEN auth_attempts.count + 1 >= ${LOGIN_MAX_ATTEMPTS}
                    THEN datetime('now', '+${LOGIN_BLOCK_MS / 1000} seconds')
                  ELSE auth_attempts.blocked_until
                END`,
        args: [text(key), text(now)],
      },
    },
    { type: "close" },
  ]);
}

async function clearLoginFailures(c: { env: Env }, key: string): Promise<void> {
  await pipeline(c, [
    { type: "execute", stmt: { sql: "DELETE FROM auth_attempts WHERE key = ?", args: [text(key)] } },
    { type: "close" },
  ]);
}

// --- Inscriptions : sliding window par IP (max 10 / heure) ---
const REGISTER_MAX_PER_HOUR = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

async function registerAllowed(c: { env: Env }, ip: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - REGISTER_WINDOW_MS).toISOString();
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT COUNT(*) AS c FROM reg_log WHERE ip = ? AND created_at > ?", args: [text(ip), text(cutoff)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  return (Number(row?.c) || 0) < REGISTER_MAX_PER_HOUR;
}

async function logRegistration(c: { env: Env }, ip: string): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "INSERT INTO reg_log (ip, created_at) VALUES (?, ?)", args: [text(ip), text(new Date().toISOString())] } },
    { type: "execute", stmt: { sql: "DELETE FROM reg_log WHERE created_at < ?", args: [text(cutoff)] } },
    { type: "close" },
  ]);
}

const RESEND_MAX_PER_HOUR = 5;

async function resendAllowed(c: { env: Env }, ip: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT COUNT(*) AS c FROM resend_log WHERE ip = ? AND created_at > ?", args: [text(ip), text(cutoff)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  return (Number(row?.c) || 0) < RESEND_MAX_PER_HOUR;
}

async function logResend(c: { env: Env }, ip: string): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "INSERT INTO resend_log (ip, created_at) VALUES (?, ?)", args: [text(ip), text(new Date().toISOString())] } },
    { type: "execute", stmt: { sql: "DELETE FROM resend_log WHERE created_at < ?", args: [text(cutoff)] } },
    { type: "close" },
  ]);
}

async function cleanupExpiredTokens(c: { env: Env }): Promise<void> {
  const cutoff = new Date(Date.now() - TOKEN_MAX_AGE_MS).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "DELETE FROM auth_tokens WHERE created_at < ?", args: [text(cutoff)] } },
    { type: "execute", stmt: { sql: "DELETE FROM admin_sessions WHERE expires_at <= ?", args: [text(new Date().toISOString())] } },
    { type: "close" },
  ]);
}

async function issueAdminSession(c: { env: Env }): Promise<string> {
  const token = randomHex(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_MAX_AGE_MS).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)", args: [text(token), text(now.toISOString()), text(expiresAt)] } },
    { type: "close" },
  ]);
  return token;
}

// --- Vérification e-mail ---
const VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VERIFICATION_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute entre deux envois

function generateVerificationCode(): string {
  const out = new Uint8Array(3);
  crypto.getRandomValues(out);
  const num = (((out[0] ?? 0) << 16) | ((out[1] ?? 0) << 8) | (out[2] ?? 0)) % 1_000_000;
  return String(num).padStart(6, "0");
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`merchanthq:verify:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getEmailVerified(c: { env: Env }, accountId: string): Promise<boolean> {
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT email_verified FROM accounts WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  return Number(row?.email_verified) === 1;
}

async function storeVerification(
  c: { env: Env },
  accountId: string,
  email: string,
): Promise<string> {
  const code = generateVerificationCode();
  const hash = await hashCode(code);
  const now = Date.now();
  const created = new Date(now).toISOString();
  const expires = new Date(now + VERIFICATION_TTL_MS).toISOString();
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO email_verifications (account_id, email, code_hash, attempts, created_at, expires_at)
              VALUES (?, ?, ?, 0, ?, ?)
              ON CONFLICT(account_id) DO UPDATE SET
                email = excluded.email,
                code_hash = excluded.code_hash,
                attempts = 0,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at`,
        args: [text(accountId), text(email), text(hash), text(created), text(expires)],
      },
    },
    { type: "close" },
  ]);
  return code;
}

async function getLastVerificationSentAt(c: { env: Env }, accountId: string): Promise<number> {
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT created_at FROM email_verifications WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  const at = Date.parse(row?.created_at ?? "");
  return Number.isNaN(at) ? 0 : at;
}

async function sendVerificationForAccount(
  c: { env: Env },
  accountId: string,
  email: string,
  shopName: string,
): Promise<void> {
  const lastSent = await getLastVerificationSentAt(c, accountId);
  if (lastSent && Date.now() - lastSent < RESEND_COOLDOWN_MS) {
    throw new Error("Veuillez patienter avant de demander un nouveau code.");
  }
  const code = await storeVerification(c, accountId, email);
  await sendVerificationEmail(c.env, email, code, shopName);
}

async function isAccountVerified(c: { env: Env }, accountId: string): Promise<boolean> {
  return getEmailVerified(c, accountId);
}

// --- Abonnements ---
const ADMIN_ACCOUNT_ID = "__admin__";

function generateSubscriptionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out = new Uint8Array(16);
  crypto.getRandomValues(out);
  const chars = Array.from(out).map((b) => alphabet[b % alphabet.length]);
  return [
    chars.slice(0, 4).join(""),
    chars.slice(4, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
  ].join("-");
}

async function authorizeAdmin(c: { req: { header: (n: string) => string | undefined }; env: Env }): Promise<boolean> {
  await ensureSchema(c);
  const header = c.req.header("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT expires_at FROM admin_sessions WHERE token = ?", args: [text(token)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row?.expires_at || Date.parse(row.expires_at) <= Date.now()) {
    if (row) {
      await pipeline(c, [
        { type: "execute", stmt: { sql: "DELETE FROM admin_sessions WHERE token = ?", args: [text(token)] } },
        { type: "close" },
      ]);
    }
    return false;
  }
  return true;
}

async function getSubscription(c: { env: Env }, accountId: string): Promise<{ type: string; expiresAt: string }> {
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT subscription_type, subscription_expires_at FROM accounts WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  return {
    type: row?.subscription_type ?? "",
    expiresAt: row?.subscription_expires_at ?? "",
  };
}

function subscriptionActive(sub: { type: string; expiresAt: string }): boolean {
  if (!sub.type) return false;
  if (!sub.expiresAt) return false;
  return Date.parse(sub.expiresAt) > Date.now();
}

async function applyCodeToAccount(
  c: { env: Env },
  accountId: string,
  code: string,
): Promise<{ ok: boolean; error?: string; type?: string; expiresAt?: string }> {
  const normalized = code.trim().toUpperCase();
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT code, account_id, subscription_type, days, expires_at, used FROM subscription_codes WHERE code = ?", args: [text(normalized)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return { ok: false, error: "Ce code n’existe pas." };
  if (Number(row.used) === 1) return { ok: false, error: "Ce code a déjà été utilisé." };
  const codeExpires = Date.parse(row.expires_at ?? "");
  if (!Number.isNaN(codeExpires) && codeExpires <= Date.now()) {
    return { ok: false, error: "Ce code est expiré." };
  }
  const days = Number(row.days) || 1;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "UPDATE subscription_codes SET used = 1, account_id = ?, activated_at = ?, expires_at = ? WHERE code = ?", args: [text(accountId), text(new Date().toISOString()), text(expiresAt), text(normalized)] } },
    { type: "execute", stmt: { sql: "UPDATE accounts SET subscription_type = ?, subscription_expires_at = ? WHERE account_id = ?", args: [text(row.subscription_type ?? ""), text(expiresAt), text(accountId)] } },
    { type: "close" },
  ]);
  return { ok: true, type: row.subscription_type, expiresAt };
}

async function authorize(c: { req: { header: (n: string) => string | undefined }; env: Env }, accountId: string): Promise<boolean> {
  const header = c.req.header("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT account_id, created_at FROM auth_tokens WHERE token = ?", args: [text(token)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row || row.account_id !== accountId) return false;
  const createdAt = Date.parse(row.created_at ?? "");
  if (!Number.isNaN(createdAt) && Date.now() - createdAt > TOKEN_MAX_AGE_MS) {
    // token expiré : on le supprime et on refuse
    await pipeline(c, [
      { type: "execute", stmt: { sql: "DELETE FROM auth_tokens WHERE token = ?", args: [text(token)] } },
      { type: "close" },
    ]);
    return false;
  }
  return true;
}

function safeEqual(a: string, b: string): boolean {
  // Comparaison sans sortie anticipée pour limiter les fuites temporelles.
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }
  return diff === 0;
}

async function verifyPassword(password: string, saltHex: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const parts = expected.split("$");
  if (parts[0] !== "pbkdf2-v2" || parts.length !== 3) return false;
  const iterations = Number.parseInt(parts[1] ?? "", 10);
  const candidate = await (async () => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const salt = Uint8Array.from(saltHex.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  })();
  return safeEqual(candidate, parts[2] ?? "");
}

app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT ?? "unknown", time: new Date().toISOString() }));

// --- Auth ---
app.post("/api/auth/register", async (c) => {
  await ensureSchema(c);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await registerAllowed(c, ip))) {
    return c.json({ error: "Trop de comptes créés depuis cette adresse. Réessayez plus tard." }, 429);
  }
  const body = await c.req.json<{ email?: string; password?: string; shop_name?: string; marketing_consent?: boolean }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const shopName = (body.shop_name ?? "").trim() || "Ma boutique";
  const marketingConsent = body.marketing_consent === true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return c.json({ error: "Adresse e-mail invalide." }, 400);
  if (password.length < 8) return c.json({ error: "Mot de passe trop court (min 8 caractères)." }, 400);
  if (shopName.length > 120) return c.json({ error: "Nom de boutique trop long." }, 400);
  const existing = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT account_id FROM accounts WHERE email = ? COLLATE NOCASE", args: [text(email)] } },
    { type: "close" },
  ]);
  if (rowOf(existing, 0)) return c.json({ error: "Cette adresse e-mail existe déjà." }, 409);
  await logRegistration(c, ip);
  const accountId = crypto.randomUUID();
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "INSERT INTO accounts (account_id, email, password_hash, password_salt, shop_name, email_verified, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
        args: [text(accountId), text(email), text(hash), text(salt), text(shopName), text(now)],
      },
    },
    { type: "execute", stmt: { sql: "INSERT INTO merchant_profiles (account_id, has_data) VALUES (?, 0)", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const token = await issueToken(c, accountId);
  // Envoi du code de vérification (échec non bloquant pour l'inscription).
  try {
    await sendVerificationForAccount(c, accountId, email, shopName);
  } catch (caught) {
    console.warn("[register] envoi du code échoué", caught instanceof Error ? caught.message : caught);
  }
  // Enregistre l'adresse dans l'audience Resend uniquement avec consentement (non bloquant).
  if (marketingConsent) {
    c.executionCtx.waitUntil(
      addContactToAudience(c.env, email, shopName).then(
        () => console.log("[register] contact audience ajouté", email),
        (caught) => console.warn("[register] ajout audience échoué", caught instanceof Error ? caught.message : caught),
      ),
    );
  }
  return c.json({ ok: true, account: { account_id: accountId, email, shop_name: shopName, email_verified: false, subscription_type: "", subscription_expires_at: "", token } }, 201);
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return c.json({ error: "Identifiants manquants." }, 400);
  await ensureSchema(c);
  // La clé de blocage combine l'IP et l'email : les tentatives échouées depuis
  // une adresse ne bloquent pas l'utilisateur légitime sur son autre réseau.
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const loginKey = `login:${ip}:${email}`;
  if (await isLoginBlocked(c, loginKey)) {
    return c.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, 429);
  }
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "SELECT account_id, email, shop_name, email_verified, subscription_type, subscription_expires_at, password_hash, password_salt FROM accounts WHERE email = ? COLLATE NOCASE",
        args: [text(email)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  const valid = row ? await verifyPassword(password, row.password_salt ?? "", row.password_hash ?? "") : false;
  if (!row || !valid) {
    await registerLoginFailure(c, loginKey);
    // Message générique : ne révèle pas si l'adresse existe.
    return c.json({ error: "Identifiants incorrects." }, 401);
  }
  await clearLoginFailures(c, loginKey);
  await clearLoginFailures(c, `admin:${ip}`);
  await cleanupExpiredTokens(c);
  const token = await issueToken(c, row.account_id ?? "");
  const emailVerified = Number(row.email_verified) === 1;
  return c.json({ ok: true, account: { account_id: row.account_id, email: row.email, shop_name: row.shop_name, email_verified: emailVerified, subscription_type: row.subscription_type ?? "", subscription_expires_at: row.subscription_expires_at ?? "", token } });
});

// --- Vérification e-mail ---
app.post("/api/auth/verify", async (c) => {
  const body = await c.req.json<{ account_id?: string; code?: string }>();
  const accountId = (body.account_id ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!accountId || !/^\d{6}$/.test(code)) {
    return c.json({ error: "Code invalide." }, 400);
  }
  await ensureSchema(c);
  const stored = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT email, code_hash, attempts, expires_at FROM email_verifications WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(stored, 0);
  if (!row) return c.json({ error: "Code invalide ou expiré." }, 400);
  const attempts = Number(row.attempts) || 0;
  if (attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return c.json({ error: "Trop de tentatives. Demandez un nouveau code." }, 400);
  }
  const expiresAt = Date.parse(row.expires_at ?? "");
  if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
    return c.json({ error: "Code expiré. Demandez un nouveau code." }, 400);
  }
  const hash = await hashCode(code);
  if (!safeEqual(hash, row.code_hash ?? "")) {
    await pipeline(c, [
      { type: "execute", stmt: { sql: "UPDATE email_verifications SET attempts = attempts + 1 WHERE account_id = ?", args: [text(accountId)] } },
      { type: "close" },
    ]);
    return c.json({ error: "Code invalide ou expiré." }, 400);
  }
  await pipeline(c, [
    { type: "execute", stmt: { sql: "UPDATE accounts SET email_verified = 1 WHERE account_id = ?", args: [text(accountId)] } },
    { type: "execute", stmt: { sql: "DELETE FROM email_verifications WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  // Email de bienvenue après confirmation (non bloquant).
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const acct = await pipeline(c, [
          { type: "execute", stmt: { sql: "SELECT email, shop_name FROM accounts WHERE account_id = ?", args: [text(accountId)] } },
          { type: "close" },
        ]);
        const accountRow = rowOf(acct, 0);
        if (accountRow?.email) {
          await sendWelcomeEmail(c.env, accountRow.email, accountRow.shop_name ?? "Ma boutique");
          console.log("[verify] email de bienvenue envoyé", accountRow.email);
        }
      } catch (caught) {
        console.warn("[verify] email de bienvenue échoué", caught instanceof Error ? caught.message : caught);
      }
    })(),
  );
  return c.json({ ok: true, email_verified: true });
});

app.post("/api/auth/resend", async (c) => {
  const body = await c.req.json<{ account_id?: string }>();
  const accountId = (body.account_id ?? "").trim();
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  await ensureSchema(c);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await resendAllowed(c, ip))) {
    return c.json({ error: "Trop de demandes de code. Réessayez plus tard." }, 429);
  }
  await logResend(c, ip);
  const account = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT email, shop_name FROM accounts WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(account, 0);
  if (!row?.email) return c.json({ error: "Compte introuvable." }, 404);
  if (await isAccountVerified(c, accountId)) {
    return c.json({ ok: true, email_verified: true });
  }
  try {
    await sendVerificationForAccount(c, accountId, row.email, row.shop_name ?? "Ma boutique");
  } catch (caught) {
    return c.json({ error: caught instanceof Error ? caught.message : "Renvoi impossible." }, 429);
  }
  return c.json({ ok: true });
});

// --- Abonnement utilisateur ---
app.get("/api/auth/subscription", async (c) => {
  const accountId = c.req.query("account_id");
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const sub = await getSubscription(c, accountId);
  let permissions: Record<string, unknown> | null = null;
  if (sub.type) {
    const plan = await pipeline(c, [
      { type: "execute", stmt: { sql: "SELECT permissions FROM plans WHERE id = ?", args: [text(sub.type)] } },
      { type: "close" },
    ]);
    const row = rowOf(plan, 0);
    if (row?.permissions) {
      try {
        permissions = JSON.parse(row.permissions);
      } catch {
        permissions = null;
      }
    }
  }
  return c.json({
    subscription: {
      type: sub.type,
      expires_at: sub.expiresAt,
      active: subscriptionActive(sub),
      permissions,
      devices: await countAccountDevices(c, accountId),
      device_ids: await listAccountDeviceIds(c, accountId),
      devices_limit:
        permissions && typeof permissions.tablets === "number"
          ? permissions.tablets
          : 0,
    },
  });
});

async function listAccountDeviceIds(
  c: { env: Env },
  accountId: string,
): Promise<string[]> {
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "SELECT DISTINCT device_id FROM commerce_latest_backup WHERE account_id = ? AND device_id <> ''",
        args: [text(accountId)],
      },
    },
    { type: "close" },
  ]);
  const first = result.results?.[0]?.response?.result;
  const cols = first?.cols ?? [];
  const deviceCol = cols.findIndex((column) => column.name === "device_id");
  const ids: string[] = [];
  for (const row of first?.rows ?? []) {
    const id = deviceCol >= 0 ? (row[deviceCol]?.value ?? "") : "";
    if (id) ids.push(id);
  }
  return ids;
}

async function countAccountDevices(
  c: { env: Env },
  accountId: string,
): Promise<number> {
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "SELECT COUNT(DISTINCT device_id) AS c FROM commerce_latest_backup WHERE account_id = ? AND device_id <> ''",
        args: [text(accountId)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  return Number(row?.c) || 0;
}

app.get("/api/account/profile", async (c) => {
  const accountId = c.req.query("account_id");
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureProfileColumn(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT merchant_profile FROM accounts WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  let profile: Record<string, unknown> = {};
  try {
    profile = row?.merchant_profile ? JSON.parse(row.merchant_profile) : {};
  } catch {
    profile = {};
  }
  return c.json({ ok: true, profile });
});

app.put("/api/account/profile", async (c) => {
  const body = await c.req.json<{ account_id?: string; profile?: Record<string, unknown> }>();
  const accountId = (body.account_id ?? "").trim();
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureProfileColumn(c);
  const incoming = body.profile ?? {};
  // Merge : les champs vides ne remplacent pas les valeurs déjà enregistrées.
  const existingResult = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT merchant_profile FROM accounts WHERE account_id = ?", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const existingRow = rowOf(existingResult, 0);
  let merged: Record<string, unknown> = {};
  try {
    merged = existingRow?.merchant_profile ? JSON.parse(existingRow.merchant_profile) : {};
  } catch {
    merged = {};
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (value === "" || value === null || value === undefined) {
      if (!(key in merged)) merged[key] = "";
    } else {
      merged[key] = value;
    }
  }
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "UPDATE accounts SET merchant_profile = ? WHERE account_id = ?",
        args: [text(JSON.stringify(merged)), text(accountId)],
      },
    },
    { type: "close" },
  ]);
  return c.json({ ok: true, profile: merged });
});

app.post("/api/auth/apply-code", async (c) => {
  const body = await c.req.json<{ account_id?: string; code?: string }>();
  const accountId = (body.account_id ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!accountId || !code) return c.json({ error: "account_id et code requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await applyCodeToAccount(c, accountId, code);
  if (!result.ok) return c.json({ error: result.error ?? "Code invalide." }, 400);
  return c.json({ ok: true, subscription: { type: result.type, expires_at: result.expiresAt, active: true } });
});

// --- Console Admin ---
app.post("/api/admin/login", async (c) => {
  await ensureSchema(c);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const rateKey = `admin:${ip}`;
  if (await isLoginBlocked(c, rateKey)) {
    return c.json({ error: "Trop de tentatives. Réessayez plus tard." }, 429);
  }
  const body = await c.req.json<{ password?: string }>();
  const password = body.password ?? "";
  const expected = c.env.ADMIN_PASSWORD ?? "";
  if (!expected || !safeEqual(password, expected)) {
    await registerLoginFailure(c, rateKey);
    return c.json({ error: "Mot de passe admin incorrect." }, 401);
  }
  await clearLoginFailures(c, rateKey);
  await cleanupExpiredTokens(c);
  return c.json({ ok: true, token: await issueAdminSession(c) });
});

app.get("/api/admin/codes", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT code, account_id, subscription_type, days, created_at, activated_at, expires_at, used FROM subscription_codes ORDER BY created_at DESC LIMIT 200" } },
    { type: "close" },
  ]);
  const rows = result.results?.[0]?.response?.result?.rows ?? [];
  const codes = rows.map((row) => ({
    code: row[0]?.value ?? "",
    account_id: row[1]?.value ?? "",
    subscription_type: row[2]?.value ?? "",
    days: Number(row[3]?.value) || 0,
    created_at: row[4]?.value ?? "",
    activated_at: row[5]?.value ?? "",
    expires_at: row[6]?.value ?? "",
    used: Number(row[7]?.value) === 1,
  }));
  return c.json({ codes });
});

app.post("/api/admin/codes/generate", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ subscription_type?: string; days?: number; count?: number }>();
  const subscriptionType = (body.subscription_type ?? "").trim();
  const days = Math.min(3650, Math.max(1, Number(body.days) || 30));
  const count = Math.min(50, Math.max(1, Number(body.count) || 1));
  if (!["starter", "pro", "big"].includes(subscriptionType)) {
    return c.json({ error: "Type d'abonnement invalide (starter, pro ou big)." }, 400);
  }
  await ensureSchema(c);
  const now = new Date().toISOString();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateSubscriptionCode();
    await pipeline(c, [
      { type: "execute", stmt: { sql: "INSERT INTO subscription_codes (code, account_id, subscription_type, days, created_at, activated_at, expires_at, used) VALUES (?, '', ?, ?, ?, '', '', 0)", args: [text(code), text(subscriptionType), integer(days), text(now)] } },
      { type: "close" },
    ]);
    codes.push(code);
  }
  return c.json({ ok: true, codes });
});

app.post("/api/admin/codes/renew", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ code?: string; days?: number }>();
  const code = (body.code ?? "").trim().toUpperCase();
  const days = Math.min(3650, Math.max(1, Number(body.days) || 30));
  if (!code) return c.json({ error: "code requis." }, 400);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT account_id, subscription_type, used, expires_at FROM subscription_codes WHERE code = ?", args: [text(code)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return c.json({ error: "Code introuvable." }, 404);
  const accountId = row.account_id ?? "";
  const base = Math.max(Date.now(), Date.parse(row.expires_at ?? "") || Date.now());
  const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "UPDATE subscription_codes SET expires_at = ? WHERE code = ?", args: [text(newExpiry), text(code)] } },
    ...(accountId
      ? [{ type: "execute" as const, stmt: { sql: "UPDATE accounts SET subscription_expires_at = ? WHERE account_id = ?", args: [text(newExpiry), text(accountId)] } }]
      : []),
    { type: "close" },
  ]);
  return c.json({ ok: true, code, expires_at: newExpiry, account_id: accountId });
});

app.post("/api/admin/codes/expire", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ code?: string }>();
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return c.json({ error: "code requis." }, 400);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT account_id FROM subscription_codes WHERE code = ?", args: [text(code)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return c.json({ error: "Code introuvable." }, 404);
  const past = new Date(Date.now() - 1000).toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "UPDATE subscription_codes SET expires_at = ? WHERE code = ?", args: [text(past), text(code)] } },
    ...(row.account_id
      ? [{ type: "execute" as const, stmt: { sql: "UPDATE accounts SET subscription_expires_at = ? WHERE account_id = ?", args: [text(past), text(row.account_id)] } }]
      : []),
    { type: "close" },
  ]);
  return c.json({ ok: true, code, expired: true });
});

app.post("/api/admin/codes/delete", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ code?: string }>();
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return c.json({ error: "code requis." }, 400);
  await ensureSchema(c);
  await pipeline(c, [
    { type: "execute", stmt: { sql: "DELETE FROM subscription_codes WHERE code = ?", args: [text(code)] } },
    { type: "close" },
  ]);
  return c.json({ ok: true, deleted: code });
});

// --- Plans (console admin) ---
app.get("/api/admin/plans", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT id, name, price_monthly, permissions, is_default, created_at, updated_at FROM plans ORDER BY price_monthly" } },
    { type: "close" },
  ]);
  const rows = result.results?.[0]?.response?.result?.rows ?? [];
  const plans = rows.map((row) => ({
    id: row[0]?.value ?? "",
    name: row[1]?.value ?? "",
    price_monthly: Number(row[2]?.value) || 0,
    permissions: JSON.parse(row[3]?.value ?? "{}"),
    is_default: Number(row[4]?.value) === 1,
    created_at: row[5]?.value ?? "",
    updated_at: row[6]?.value ?? "",
  }));
  return c.json({ plans });
});

app.post("/api/admin/plans", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ id?: string; name?: string; price_monthly?: number; permissions?: Record<string, unknown> }>();
  const id = (body.id ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const name = (body.name ?? "").trim();
  const price = Math.max(0, Number(body.price_monthly) || 0);
  if (!id || !name) return c.json({ error: "id et name requis." }, 400);
  await ensureSchema(c);
  const now = new Date().toISOString();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "INSERT INTO plans (id, name, price_monthly, permissions, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, price_monthly = excluded.price_monthly, permissions = excluded.permissions, updated_at = excluded.updated_at", args: [text(id), text(name), integer(price), text(JSON.stringify(body.permissions ?? {})), text(now), text(now)] } },
    { type: "close" },
  ]);
  return c.json({ ok: true, plan: { id, name, price_monthly: price, permissions: body.permissions ?? {} } });
});

app.post("/api/admin/plans/update", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ id?: string; name?: string; price_monthly?: number; permissions?: Record<string, unknown> }>();
  const id = (body.id ?? "").trim();
  if (!id) return c.json({ error: "id requis." }, 400);
  await ensureSchema(c);
  const name = (body.name ?? "").trim();
  const price = Math.max(0, Number(body.price_monthly) || 0);
  const sets = ["updated_at = ?"];
  const args: SqlValue[] = [text(new Date().toISOString())];
  if (name) {
    sets.push("name = ?");
    args.push(text(name));
  }
  if (body.price_monthly !== undefined) {
    sets.push("price_monthly = ?");
    args.push(integer(price));
  }
  if (body.permissions) {
    sets.push("permissions = ?");
    args.push(text(JSON.stringify(body.permissions)));
  }
  args.push(text(id));
  await pipeline(c, [
    { type: "execute", stmt: { sql: `UPDATE plans SET ${sets.join(", ")} WHERE id = ?`, args } },
    { type: "close" },
  ]);
  return c.json({ ok: true });
});

app.post("/api/admin/plans/delete", async (c) => {
  if (!(await authorizeAdmin(c))) return c.json({ error: "Non autorisé." }, 401);
  const body = await c.req.json<{ id?: string }>();
  const id = (body.id ?? "").trim();
  if (!id) return c.json({ error: "id requis." }, 400);
  if (["starter", "pro", "big"].includes(id)) {
    return c.json({ error: "Impossible de supprimer un plan par défaut." }, 400);
  }
  await ensureSchema(c);
  await pipeline(c, [
    { type: "execute", stmt: { sql: "DELETE FROM plans WHERE id = ?", args: [text(id)] } },
    { type: "close" },
  ]);
  return c.json({ ok: true, deleted: id });
});
app.get("/api/accounts/status", async (c) => {
  const accountId = c.req.query("account_id");
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "SELECT has_data, last_backup_at, last_backup_business_date FROM merchant_profiles WHERE account_id = ?",
        args: [text(accountId)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return c.json({ status: { has_data: 0, last_backup_at: null, last_backup_business_date: null } });
  return c.json({
    status: {
      has_data: Number(row.has_data) === 1,
      last_backup_at: row.last_backup_at || null,
      last_backup_business_date: row.last_backup_business_date || null,
    },
  });
});

// --- Boutiques ---
app.get("/api/shops", async (c) => {
  const accountId = c.req.query("account_id");
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT shop_id, account_id, name, created_at FROM shops WHERE account_id = ? ORDER BY created_at", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const rows = result.results?.[0]?.response?.result?.rows ?? [];
  const shops = rows.map((row) => ({
    shop_id: row[0]?.value ?? "",
    account_id: row[1]?.value ?? "",
    name: row[2]?.value ?? "",
    created_at: row[3]?.value ?? "",
  }));
  return c.json({ shops });
});

app.post("/api/shops", async (c) => {
  const body = await c.req.json<{ account_id?: string; name?: string }>();
  const accountId = body.account_id ?? "";
  const name = (body.name ?? "").trim();
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (name.length < 2) return c.json({ error: "Le nom de la boutique doit contenir au moins 2 caractères." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  if (!(await isAccountVerified(c, accountId))) return c.json({ error: "Vérifiez votre adresse e-mail pour utiliser le cloud." }, 403);
  await ensureSchema(c);
  const shopId = crypto.randomUUID();
  await pipeline(c, [
    { type: "execute", stmt: { sql: "INSERT INTO shops (shop_id, account_id, name, created_at) VALUES (?, ?, ?, ?)", args: [text(shopId), text(accountId), text(name), text(new Date().toISOString())] } },
    { type: "close" },
  ]);
  return c.json({ ok: true, shop: { shop_id: shopId, account_id: accountId, name, created_at: new Date().toISOString() } }, 201);
});

app.post("/api/shops/rename", async (c) => {
  const body = await c.req.json<{ account_id?: string; shop_id?: string; name?: string }>();
  const accountId = body.account_id ?? "";
  const shopId = body.shop_id ?? "";
  const name = (body.name ?? "").trim();
  if (!accountId || !shopId) return c.json({ error: "account_id et shop_id requis." }, 400);
  if (name.length < 2) return c.json({ error: "Le nom de la boutique doit contenir au moins 2 caractères." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  if (!(await isAccountVerified(c, accountId))) return c.json({ error: "Vérifiez votre adresse e-mail pour utiliser le cloud." }, 403);
  await ensureSchema(c);
  await pipeline(c, [
    { type: "execute", stmt: { sql: "UPDATE shops SET name = ? WHERE shop_id = ? AND account_id = ?", args: [text(name), text(shopId), text(accountId)] } },
    { type: "close" },
  ]);
  return c.json({ ok: true });
});

// --- Backups ---
app.post("/api/backups", async (c) => {
  const body = await c.req.json<{
    account_id?: string;
    shop_id?: string;
    device_id?: string;
    business_date?: string;
    snapshot_at?: string;
    app_version?: string;
    schema_version?: number;
    payload?: string;
    shop_name?: string;
  }>();
  const { account_id, shop_id, device_id, business_date, snapshot_at, app_version, schema_version, payload, shop_name } = body;
  if (!account_id || !device_id || !business_date || !snapshot_at || !payload) {
    return c.json({ error: "Champs requis manquants (account_id, device_id, business_date, snapshot_at, payload)." }, 400);
  }
  if (payload.length > 2_000_000) return c.json({ error: "Sauvegarde trop volumineuse (max 2 Mo)." }, 413);
  if (!(await authorize(c, account_id))) return c.json({ error: "Non autorisé." }, 401);
  if (!(await isAccountVerified(c, account_id))) return c.json({ error: "Vérifiez votre adresse e-mail pour utiliser le cloud." }, 403);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(business_date)) return c.json({ error: "business_date invalide (YYYY-MM-DD)." }, 400);
  const snapshotMs = Date.parse(snapshot_at);
  if (Number.isNaN(snapshotMs)) {
    return c.json({ error: "snapshot_at invalide (ISO 8601)." }, 400);
  }
  if (snapshotMs > Date.now() + 5 * 60 * 1000) {
    return c.json({ error: "snapshot_at est dans le futur." }, 400);
  }
  if (
    device_id.length > 120 ||
    (shop_id ?? "").length > 120 ||
    (app_version ?? "").length > 40
  ) {
    return c.json({ error: "Identifiants de sauvegarde trop longs." }, 400);
  }
  const snapshotAt = new Date(snapshotMs).toISOString();
  await ensureSchema(c);
  const resolvedShopId = shop_id ?? "";
  const backupId = `${account_id}:${resolvedShopId}:${business_date}`;
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO commerce_manager_backups (backup_id, account_id, shop_id, device_id, business_date, snapshot_at, app_version, schema_version, payload)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(account_id, shop_id, business_date) DO UPDATE SET
                device_id = excluded.device_id,
                snapshot_at = excluded.snapshot_at,
                app_version = excluded.app_version,
                schema_version = excluded.schema_version,
                payload = excluded.payload`,
        args: [text(backupId), text(account_id), text(resolvedShopId), text(device_id), text(business_date), text(snapshotAt), text(app_version ?? "0.1.0"), integer(schema_version ?? 0), text(payload)],
      },
    },
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO commerce_latest_backup (singleton_id, account_id, shop_id, backup_id, device_id, business_date, snapshot_at, app_version, schema_version)
              VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(singleton_id) DO UPDATE SET
                account_id = excluded.account_id,
                shop_id = excluded.shop_id,
                backup_id = excluded.backup_id,
                device_id = excluded.device_id,
                business_date = excluded.business_date,
                snapshot_at = excluded.snapshot_at,
                app_version = excluded.app_version,
                schema_version = excluded.schema_version
              WHERE excluded.snapshot_at >= commerce_latest_backup.snapshot_at`,
        args: [text(account_id), text(resolvedShopId), text(backupId), text(device_id), text(business_date), text(snapshotAt), text(app_version ?? "0.1.0"), integer(schema_version ?? 0)],
      },
    },
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO merchant_profiles (account_id, has_data, last_backup_at, last_backup_business_date)
              VALUES (?, 1, ?, ?)
              ON CONFLICT(account_id) DO UPDATE SET
                has_data = 1,
                last_backup_at = excluded.last_backup_at,
                last_backup_business_date = excluded.last_backup_business_date`,
        args: [text(account_id), text(snapshotAt), text(business_date)],
      },
    },
    ...(shop_name
      ? [{ type: "execute" as const, stmt: { sql: "UPDATE accounts SET shop_name = ? WHERE account_id = ?", args: [text(shop_name), text(account_id)] } }]
      : []),
    { type: "close" },
  ]);
  return c.json({ ok: true, backup_id: backupId });
});

app.get("/api/backups/latest", async (c) => {
  const accountId = c.req.query("account_id");
  const shopId = c.req.query("shop_id") ?? "";
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: `SELECT backup_id, account_id, shop_id, device_id, business_date, snapshot_at, app_version, schema_version
              FROM commerce_manager_backups WHERE account_id = ? AND shop_id = ? ORDER BY snapshot_at DESC LIMIT 1`,
        args: [text(accountId), text(shopId)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return c.json({ backup: null });
  return c.json({ backup: { backup_id: row.backup_id, account_id: row.account_id, shop_id: row.shop_id, device_id: row.device_id, business_date: row.business_date, snapshot_at: row.snapshot_at, app_version: row.app_version, schema_version: Number(row.schema_version) || 0 } });
});

app.get("/api/backups/:backupId", async (c) => {
  const backupId = c.req.param("backupId");
  const accountId = c.req.query("account_id");
  const shopId = c.req.query("shop_id") ?? "";
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT payload FROM commerce_manager_backups WHERE backup_id = ? AND account_id = ? AND shop_id = ?", args: [text(backupId), text(accountId), text(shopId)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row?.payload) return c.json({ error: "Sauvegarde introuvable." }, 404);
  return c.json({ backup_id: backupId, payload: row.payload });
});

export default app;
