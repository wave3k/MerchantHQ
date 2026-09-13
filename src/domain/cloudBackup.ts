export const CLOUD_BACKUP_HOUR = 21;

export type BackupFrequency = "realtime" | "nightly" | "2x_week";

// En mode « realtime » (plan Big), on évite d'envoyer une copie plus d'une fois
// par minute tout en gardant une sauvegarde quasi immédiate.
const REALTIME_MIN_INTERVAL_MS = 60 * 1000;
// En mode « 2x/semaine » (plan Starter) : lundi (1) et jeudi (4).
const TWICE_WEEKLY_DAYS = [1, 4];

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function previousLocalDate(value: Date): string {
  const previous = new Date(value);
  previous.setDate(previous.getDate() - 1);
  return localDate(previous);
}

export function normalizeBackupFrequency(value: string | undefined): BackupFrequency {
  if (value === "realtime" || value === "nightly" || value === "2x_week") {
    return value;
  }
  return "nightly";
}

export function dueBusinessDate(
  value: Date,
  lastSuccessDate: string | null,
  pendingDate: string | null,
  frequency: BackupFrequency = "nightly",
  lastSuccessAt: string | null = null,
): string | null {
  if (pendingDate) return pendingDate;

  // Realtime : dès qu'une minute s'est écoulée depuis la dernière copie.
  if (frequency === "realtime") {
    if (lastSuccessAt) {
      const elapsed = value.getTime() - Date.parse(lastSuccessAt);
      if (Number.isFinite(elapsed) && elapsed < REALTIME_MIN_INTERVAL_MS) {
        return null;
      }
    }
    return localDate(value);
  }

  // 2x/semaine : seulement les jours choisis, à partir de 21 h.
  if (frequency === "2x_week") {
    if (!TWICE_WEEKLY_DAYS.includes(value.getDay())) return null;
  }

  if (!lastSuccessDate && value.getHours() < CLOUD_BACKUP_HOUR) return null;

  const candidate =
    value.getHours() >= CLOUD_BACKUP_HOUR
      ? localDate(value)
      : previousLocalDate(value);
  return !lastSuccessDate || lastSuccessDate < candidate ? candidate : null;
}

export function manualBusinessDate(value: Date): string {
  return localDate(value);
}

export interface RemoteBackupComparison {
  remoteBackupId: string;
  remoteDeviceId: string;
  remoteSnapshotAt: string;
  currentDeviceId: string;
  lastRestoredBackupId: string | null;
  localDataAt: string | null;
}

export function shouldOfferRemoteRestore(
  comparison: RemoteBackupComparison,
): boolean {
  if (comparison.remoteDeviceId === comparison.currentDeviceId) return false;
  if (comparison.remoteBackupId === comparison.lastRestoredBackupId) {
    return false;
  }
  const remoteTime = new Date(comparison.remoteSnapshotAt).getTime();
  if (!Number.isFinite(remoteTime)) return false;
  if (!comparison.localDataAt) return true;
  const localTime = new Date(comparison.localDataAt).getTime();
  return !Number.isFinite(localTime) || remoteTime > localTime;
}