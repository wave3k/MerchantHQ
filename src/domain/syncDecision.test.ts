import { describe, expect, test } from "bun:test";

import { recommendedSyncAction } from "./syncDecision";

const base = {
  localHasData: false,
  remoteHasData: false,
  localDataAt: null,
  remoteSnapshotAt: null,
  accountBound: false,
};

describe("recommandation de synchronisation", () => {
  test("tablette vide + compte vide → rien à faire", () => {
    expect(recommendedSyncAction(base)).toBe("none");
  });

  test("tablette vide + compte avec sauvegarde → charger le compte", () => {
    expect(
      recommendedSyncAction({
        ...base,
        remoteHasData: true,
        remoteSnapshotAt: "2026-08-24T21:00:00.000Z",
      }),
    ).toBe("load_remote");
  });

  test("tablette avec données + compte vide → garder et sauvegarder", () => {
    expect(
      recommendedSyncAction({
        ...base,
        localHasData: true,
        localDataAt: "2026-08-24T18:00:00.000Z",
      }),
    ).toBe("keep_local");
  });

  test("données locales plus récentes → garder la tablette", () => {
    expect(
      recommendedSyncAction({
        ...base,
        localHasData: true,
        remoteHasData: true,
        localDataAt: "2026-08-25T09:00:00.000Z",
        remoteSnapshotAt: "2026-08-24T21:00:00.000Z",
      }),
    ).toBe("keep_local");
  });

  test("sauvegarde du compte plus récente → charger le compte", () => {
    expect(
      recommendedSyncAction({
        ...base,
        localHasData: true,
        remoteHasData: true,
        localDataAt: "2026-08-23T18:00:00.000Z",
        remoteSnapshotAt: "2026-08-24T21:00:00.000Z",
      }),
    ).toBe("load_remote");
  });

  test("égalité de dates → charger le compte (défaut)", () => {
    expect(
      recommendedSyncAction({
        ...base,
        localHasData: true,
        remoteHasData: true,
        localDataAt: "2026-08-24T21:00:00.000Z",
        remoteSnapshotAt: "2026-08-24T21:00:00.000Z",
      }),
    ).toBe("load_remote");
  });

  test("compte déjà lié à cet appareil → aucun choix", () => {
    expect(
      recommendedSyncAction({
        ...base,
        accountBound: true,
        localHasData: true,
        remoteHasData: true,
        localDataAt: "2026-08-24T18:00:00.000Z",
        remoteSnapshotAt: "2026-08-25T21:00:00.000Z",
      }),
    ).toBe("none");
  });
});