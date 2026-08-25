export type SyncAction = "keep_local" | "load_remote" | "fresh_start" | "none";

export interface SyncSituation {
  localHasData: boolean;
  remoteHasData: boolean;
  localDataAt: string | null;
  remoteSnapshotAt: string | null;
  accountBound: boolean;
}

export function recommendedSyncAction(situation: SyncSituation): SyncAction {
  if (situation.accountBound) return "none";
  if (!situation.localHasData) {
    return situation.remoteHasData ? "load_remote" : "none";
  }
  if (!situation.remoteHasData) return "keep_local";
  const localTime = new Date(situation.localDataAt ?? "").getTime();
  const remoteTime = new Date(situation.remoteSnapshotAt ?? "").getTime();
  if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
    return localTime > remoteTime ? "keep_local" : "load_remote";
  }
  return "load_remote";
}