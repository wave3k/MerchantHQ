import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { openDatabaseAsync } from "expo-sqlite";

import { initializeDatabase } from "./database";
import { getCloudBackupConfig, syncCloudBackup } from "./cloudBackup";

export const CLOUD_BACKUP_TASK = "commerce-manager-cloud-backup";

TaskManager.defineTask(CLOUD_BACKUP_TASK, async () => {
  const db = await openDatabaseAsync("commerce-manager.db");
  try {
    await initializeDatabase(db);
    await syncCloudBackup(db);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  } finally {
    await db.closeAsync();
  }
});

export async function registerCloudBackupTask(): Promise<boolean> {
  const config = await getCloudBackupConfig();
  if (!config.hasToken) return false;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(CLOUD_BACKUP_TASK))) {
    await BackgroundTask.registerTaskAsync(CLOUD_BACKUP_TASK, {
      minimumInterval: 15,
    });
  }
  return true;
}
