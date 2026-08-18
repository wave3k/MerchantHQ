import type { SQLiteDatabase } from "expo-sqlite";

import {
  applyRemoteOwnerAccount,
  getOwnerAccountRecord,
  type OwnerAccountRecord,
} from "./database";
import {
  getCloudCredentials,
  runTursoPipeline,
  type TursoPipelineResponse,
} from "./cloudBackup";

const CREATE_OWNER_TABLE = `CREATE TABLE IF NOT EXISTS commerce_owner_account (
  singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

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

async function upsertRemoteOwner(
  credentials: { url: string; token: string },
  account: OwnerAccountRecord,
  options: { attempts?: number; timeoutMs?: number },
): Promise<void> {
  await runTursoPipeline(
    credentials.url,
    credentials.token,
    [
      { type: "execute", stmt: { sql: CREATE_OWNER_TABLE } },
      {
        type: "execute",
        stmt: {
          sql: `INSERT INTO commerce_owner_account
            (singleton_id, name, username, password_hash, password_salt, updated_at)
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(singleton_id) DO UPDATE SET
              name = excluded.name,
              username = excluded.username,
              password_hash = excluded.password_hash,
              password_salt = excluded.password_salt,
              updated_at = excluded.updated_at`,
          args: [
            { type: "text", value: account.name },
            { type: "text", value: account.username },
            { type: "text", value: account.passwordHash },
            { type: "text", value: account.passwordSalt },
            { type: "text", value: account.updatedAt },
          ],
        },
      },
      { type: "close" },
    ],
    options,
  );
}

export async function syncOwnerAccount(
  db: SQLiteDatabase,
  options: { attempts?: number; timeoutMs?: number } = {},
): Promise<"synced" | "not_configured" | "no_account"> {
  const credentials = await getCloudCredentials();
  if (!credentials) return "not_configured";
  const pending = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'owner_account_pending'",
  );
  if (pending?.value === "1") {
    const local = await getOwnerAccountRecord(db);
    if (local) {
      await upsertRemoteOwner(credentials, local, options);
      await db.runAsync(
        "DELETE FROM settings WHERE key = 'owner_account_pending'",
      );
      return "synced";
    }
  }
  const body = await runTursoPipeline(
    credentials.url,
    credentials.token,
    [
      { type: "execute", stmt: { sql: CREATE_OWNER_TABLE } },
      {
        type: "execute",
        stmt: {
          sql: `SELECT name, username, password_hash, password_salt, updated_at
                FROM commerce_owner_account WHERE singleton_id = 1`,
        },
      },
      { type: "close" },
    ],
    options,
  );
  const remote = readFirstRow(body, 1);
  if (remote) {
    await applyRemoteOwnerAccount(db, {
      name: remote.name ?? "",
      username: remote.username ?? "boss",
      passwordHash: remote.password_hash ?? "",
      passwordSalt: remote.password_salt ?? "",
      updatedAt: remote.updated_at ?? new Date().toISOString(),
    });
    return "synced";
  }
  const local = await getOwnerAccountRecord(db);
  if (!local) return "no_account";
  await upsertRemoteOwner(credentials, local, options);
  return "synced";
}

export async function pushOwnerAccount(db: SQLiteDatabase): Promise<void> {
  const credentials = await getCloudCredentials();
  if (!credentials) throw new Error("La connexion Turso n’est pas configurée.");
  const account = await getOwnerAccountRecord(db);
  if (!account) throw new Error("Le compte propriétaire est introuvable.");
  await upsertRemoteOwner(credentials, account, {
    attempts: 3,
    timeoutMs: 10_000,
  });
  await db.runAsync("DELETE FROM settings WHERE key = 'owner_account_pending'");
}
