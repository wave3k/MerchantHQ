import { describe, expect, test } from "bun:test";

import { BUSINESS_SECTORS, CUSTOM_SECTOR, sectorLabel } from "./sectors";

describe("sectors", () => {
  test("la liste est fournie et sans doublon", () => {
    expect(BUSINESS_SECTORS.length > 10).toBe(true);
    expect(new Set(BUSINESS_SECTORS).size).toBe(BUSINESS_SECTORS.length);
  });

  test("sectorLabel gère les valeurs vides et personnalisées", () => {
    expect(sectorLabel(null)).toBe("Non renseigné");
    expect(sectorLabel(undefined)).toBe("Non renseigné");
    expect(sectorLabel("")).toBe("Non renseigné");
    expect(sectorLabel(CUSTOM_SECTOR)).toBe("Autre");
    expect(sectorLabel("Informatique")).toBe("Informatique");
  });
});
