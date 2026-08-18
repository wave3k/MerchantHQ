import { describe, expect, test } from "bun:test";

import {
  dueBusinessDate,
  manualBusinessDate,
  shouldOfferRemoteRestore,
  tursoPipelineUrl,
} from "./cloudBackup";

describe("sauvegarde cloud quotidienne", () => {
  test("attend 21 h lors de la toute première journée", () => {
    expect(
      dueBusinessDate(new Date(2026, 6, 28, 20, 59), null, null),
    ).toBe(null);
    expect(
      dueBusinessDate(new Date(2026, 6, 28, 21, 0), null, null),
    ).toBe("2026-07-28");
  });

  test("rattrape la veille au prochain démarrage du matin", () => {
    expect(
      dueBusinessDate(
        new Date(2026, 6, 29, 8, 0),
        "2026-07-27",
        null,
      ),
    ).toBe("2026-07-28");
  });

  test("conserve une journée déjà mise en attente", () => {
    expect(
      dueBusinessDate(
        new Date(2026, 6, 30, 20, 0),
        "2026-07-27",
        "2026-07-28",
      ),
    ).toBe("2026-07-28");
  });

  test("utilise la date du jour pour une sauvegarde manuelle", () => {
    expect(manualBusinessDate(new Date(2026, 6, 28, 10, 0))).toBe(
      "2026-07-28",
    );
  });

  test("convertit une URL libsql en endpoint HTTP", () => {
    expect(
      tursoPipelineUrl("libsql://example.turso.io"),
    ).toBe("https://example.turso.io/v2/pipeline");
  });

  test("propose la copie plus récente d’une autre tablette", () => {
    expect(
      shouldOfferRemoteRestore({
        remoteBackupId: "tablet-b:2026-07-29",
        remoteDeviceId: "tablet-b",
        remoteSnapshotAt: "2026-07-29T21:05:00.000Z",
        currentDeviceId: "tablet-a",
        lastRestoredBackupId: null,
        localDataAt: "2026-07-28T18:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("ignore sa propre copie ou une copie déjà restaurée", () => {
    expect(
      shouldOfferRemoteRestore({
        remoteBackupId: "tablet-a:2026-07-29",
        remoteDeviceId: "tablet-a",
        remoteSnapshotAt: "2026-07-29T21:05:00.000Z",
        currentDeviceId: "tablet-a",
        lastRestoredBackupId: null,
        localDataAt: null,
      }),
    ).toBe(false);
    expect(
      shouldOfferRemoteRestore({
        remoteBackupId: "tablet-b:2026-07-29",
        remoteDeviceId: "tablet-b",
        remoteSnapshotAt: "2026-07-29T21:05:00.000Z",
        currentDeviceId: "tablet-a",
        lastRestoredBackupId: "tablet-b:2026-07-29",
        localDataAt: null,
      }),
    ).toBe(false);
  });

  test("ignore une copie distante plus ancienne que les données locales", () => {
    expect(
      shouldOfferRemoteRestore({
        remoteBackupId: "tablet-b:2026-07-28",
        remoteDeviceId: "tablet-b",
        remoteSnapshotAt: "2026-07-28T21:05:00.000Z",
        currentDeviceId: "tablet-a",
        lastRestoredBackupId: null,
        localDataAt: "2026-07-29T09:00:00.000Z",
      }),
    ).toBe(false);
  });
});
