import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  TURSO_URL: string;
  TURSO_TOKEN: string;
  ENVIRONMENT?: string;
};

type SqlValue = { type: string; value?: string | null };
type Stmt = { sql: string; args?: SqlValue[] };
type Request = { type: string; stmt?: Stmt };

type Row = { cols?: Array<{ name?: string }>; rows?: Array<Array<{ type?: string; value?: string | null }>> };
type PipelineResponse = { results?: Array<{ type: string; error?: { message?: string }; response?: { result?: Row } }> };

const app = new Hono<{ Bindings: Env }>();
app.use("/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

function pipelineUrl(url: string): string {
  return url.trim().replace(/^libsql:\/\//i, "https://").replace(/\/+$/, "") + "/v2/pipeline";
}

function text(value: string): SqlValue {
  return { type: "text", value };
}
function integer(value: number): SqlValue {
  return { type: "integer", value: String(value) };
}

async function pipeline(c: { env: Env }, requests: Request[]): Promise<PipelineResponse> {
  const res = await fetch(pipelineUrl(c.env.TURSO_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`Turso HTTP ${res.status}`);
  const body = (await res.json()) as PipelineResponse;
  const failed = body.results?.find((r) => r.type === "error");
  if (failed) throw new Error(failed.error?.message ?? "Turso n’a pas exécuté la requête.");
  return body;
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
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS merchant_profiles (
    account_id TEXT PRIMARY KEY,
    has_data INTEGER NOT NULL DEFAULT 0,
    last_backup_at TEXT,
    last_backup_business_date TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS commerce_manager_backups (
    backup_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    snapshot_at TEXT NOT NULL,
    app_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    UNIQUE(account_id, business_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_backups_account ON commerce_manager_backups(account_id)`,
  `CREATE TABLE IF NOT EXISTS commerce_latest_backup (
    singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
    account_id TEXT NOT NULL,
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
];

async function ensureSchema(c: { env: Env }): Promise<void> {
  const requests: Request[] = SCHEMA_STATEMENTS.map((sql) => ({ type: "execute", stmt: { sql } }));
  requests.push({ type: "close" });
  await pipeline(c, requests);
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

async function authorize(c: { req: { header: (n: string) => string | undefined }; env: Env }, accountId: string): Promise<boolean> {
  const header = c.req.header("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT account_id FROM auth_tokens WHERE token = ?", args: [text(token)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  return Boolean(row && row.account_id === accountId);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPassword(password: string, saltHex: string, expected: string): Promise<boolean> {
  if (!expected) return password.length === 0;
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
  const body = await c.req.json<{ username?: string; password?: string; shop_name?: string }>();
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const shopName = (body.shop_name ?? "").trim() || "Ma boutique";
  if (username.length < 3) return c.json({ error: "Nom d'utilisateur trop court (min 3 caractères)." }, 400);
  if (password.length < 8) return c.json({ error: "Mot de passe trop court (min 8 caractères)." }, 400);
  await ensureSchema(c);
  const existing = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT account_id FROM accounts WHERE username = ? COLLATE NOCASE", args: [text(username)] } },
    { type: "close" },
  ]);
  if (rowOf(existing, 0)) return c.json({ error: "Ce nom d'utilisateur existe déjà." }, 409);
  const accountId = crypto.randomUUID();
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "INSERT INTO accounts (account_id, username, password_hash, password_salt, shop_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [text(accountId), text(username), text(hash), text(salt), text(shopName), text(now)],
      },
    },
    { type: "execute", stmt: { sql: "INSERT INTO merchant_profiles (account_id, has_data) VALUES (?, 0)", args: [text(accountId)] } },
    { type: "close" },
  ]);
  const token = await issueToken(c, accountId);
  return c.json({ ok: true, account: { account_id: accountId, username, shop_name: shopName, token } }, 201);
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>();
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) return c.json({ error: "Identifiants manquants." }, 400);
  await ensureSchema(c);
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: "SELECT account_id, username, shop_name, password_hash, password_salt FROM accounts WHERE username = ? COLLATE NOCASE",
        args: [text(username)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return c.json({ error: "Compte introuvable." }, 401);
  const valid = await verifyPassword(password, row.password_salt ?? "", row.password_hash ?? "");
  if (!valid) return c.json({ error: "Mot de passe incorrect." }, 401);
  const token = await issueToken(c, row.account_id ?? "");
  return c.json({ ok: true, account: { account_id: row.account_id, username: row.username, shop_name: row.shop_name, token } });
});

// --- Statut / profil ---
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

// --- Backups ---
app.post("/api/backups", async (c) => {
  const body = await c.req.json<{
    account_id?: string;
    device_id?: string;
    business_date?: string;
    snapshot_at?: string;
    app_version?: string;
    schema_version?: number;
    payload?: string;
    shop_name?: string;
  }>();
  const { account_id, device_id, business_date, snapshot_at, app_version, schema_version, payload, shop_name } = body;
  if (!account_id || !device_id || !business_date || !snapshot_at || !payload) {
    return c.json({ error: "Champs requis manquants (account_id, device_id, business_date, snapshot_at, payload)." }, 400);
  }
  if (!(await authorize(c, account_id))) return c.json({ error: "Non autorisé." }, 401);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(business_date)) return c.json({ error: "business_date invalide (YYYY-MM-DD)." }, 400);
  await ensureSchema(c);
  const backupId = `${account_id}:${business_date}`;
  await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO commerce_manager_backups (backup_id, account_id, device_id, business_date, snapshot_at, app_version, schema_version, payload)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(account_id, business_date) DO UPDATE SET
                device_id = excluded.device_id,
                snapshot_at = excluded.snapshot_at,
                app_version = excluded.app_version,
                schema_version = excluded.schema_version,
                payload = excluded.payload`,
        args: [text(backupId), text(account_id), text(device_id), text(business_date), text(snapshot_at), text(app_version ?? "0.1.0"), integer(schema_version ?? 0), text(payload)],
      },
    },
    {
      type: "execute",
      stmt: {
        sql: `INSERT INTO commerce_latest_backup (singleton_id, account_id, backup_id, device_id, business_date, snapshot_at, app_version, schema_version)
              VALUES (1, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(singleton_id) DO UPDATE SET
                account_id = excluded.account_id,
                backup_id = excluded.backup_id,
                device_id = excluded.device_id,
                business_date = excluded.business_date,
                snapshot_at = excluded.snapshot_at,
                app_version = excluded.app_version,
                schema_version = excluded.schema_version
              WHERE excluded.snapshot_at >= commerce_latest_backup.snapshot_at`,
        args: [text(account_id), text(backupId), text(device_id), text(business_date), text(snapshot_at), text(app_version ?? "0.1.0"), integer(schema_version ?? 0)],
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
        args: [text(account_id), text(snapshot_at), text(business_date)],
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
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    {
      type: "execute",
      stmt: {
        sql: `SELECT backup_id, account_id, device_id, business_date, snapshot_at, app_version, schema_version
              FROM commerce_manager_backups WHERE account_id = ? ORDER BY snapshot_at DESC LIMIT 1`,
        args: [text(accountId)],
      },
    },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row) return c.json({ backup: null });
  return c.json({ backup: { backup_id: row.backup_id, account_id: row.account_id, device_id: row.device_id, business_date: row.business_date, snapshot_at: row.snapshot_at, app_version: row.app_version, schema_version: Number(row.schema_version) || 0 } });
});

app.get("/api/backups/:backupId", async (c) => {
  const backupId = c.req.param("backupId");
  const accountId = c.req.query("account_id");
  if (!accountId) return c.json({ error: "account_id requis." }, 400);
  if (!(await authorize(c, accountId))) return c.json({ error: "Non autorisé." }, 401);
  await ensureSchema(c);
  const result = await pipeline(c, [
    { type: "execute", stmt: { sql: "SELECT payload FROM commerce_manager_backups WHERE backup_id = ? AND account_id = ?", args: [text(backupId), text(accountId)] } },
    { type: "close" },
  ]);
  const row = rowOf(result, 0);
  if (!row?.payload) return c.json({ error: "Sauvegarde introuvable." }, 404);
  return c.json({ backup_id: backupId, payload: row.payload });
});

export default app;