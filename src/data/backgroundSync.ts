import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { openDatabaseAsync } from "expo-sqlite";

import { syncCloudBackup } from "./cloudApi";
import { getSession, getWorkerUrl } from "./cloudSession";
import { initializeDatabase } from "./database";

export const CLOUD_BACKUP_TASK = "merchanthq-cloud-backup";

TaskManager.defineTask(CLOUD_BACKUP_TASK, async () => {
  const db = await openDatabaseAsync("commerce-manager-public.db");
  try {
    await initializeDatabase(db);
    const session = await getSession();
    if (session) {
      await syncCloudBackup(db);
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  } finally {
    await db.closeAsync();
  }
});

export async function registerCloudBackupTask(): Promise<boolean> {
  const session = await getSession();
  const workerUrl = await getWorkerUrl();
  if (!session || !workerUrl) return false;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(CLOUD_BACKUP_TASK))) {
    await BackgroundTask.registerTaskAsync(CLOUD_BACKUP_TASK, {
      minimumInterval: 15,
    });
  }
  return true;
}