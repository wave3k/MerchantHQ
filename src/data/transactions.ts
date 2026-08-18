import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

type TransactionTask = (transaction: SQLiteDatabase) => Promise<void>;

/**
 * Expo SQLite does not support exclusive transactions on the Web.
 * Keep the safer exclusive connection on Android and use the standard,
 * still-atomic transaction API only in the browser.
 */
export async function withWriteTransaction(
  db: SQLiteDatabase,
  task: TransactionTask,
): Promise<void> {
  if (Platform.OS === "web") {
    await db.withTransactionAsync(() => task(db));
    return;
  }

  await db.withExclusiveTransactionAsync(task);
}
