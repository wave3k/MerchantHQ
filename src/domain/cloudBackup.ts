export const CLOUD_BACKUP_HOUR = 21;

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

export function dueBusinessDate(
  value: Date,
  lastSuccessDate: string | null,
  pendingDate: string | null,
): string | null {
  if (pendingDate) return pendingDate;
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

export function tursoPipelineUrl(value: string): string {
  const normalized = value.trim().replace(/^libsql:\/\//i, "https://");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("L’URL Turso n’est pas valide.");
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) {
    throw new Error("Utilisez une URL Turso libsql:// ou https:// sécurisée.");
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/v2/pipeline`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}
