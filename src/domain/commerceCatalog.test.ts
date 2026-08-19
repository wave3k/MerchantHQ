import { describe, expect, test } from "bun:test";

import {
  catalogPriceForPrimaryCurrency,
  COMMERCE_CATALOG,
} from "./commerceCatalog";

describe("catalogue MerchantHQ", () => {
  test("contient des noms uniques et des catégories renseignées", () => {
    const names = COMMERCE_CATALOG.map((item) => item.name.toLowerCase());
    expect(new Set(names).size).toBe(COMMERCE_CATALOG.length);
    expect(COMMERCE_CATALOG.length).toBe(62);
    expect(COMMERCE_CATALOG.every((item) => item.category.length > 0)).toBe(
      true,
    );
  });

  test("garde les dollars en USD et les convertit en CDF", () => {
    const service = COMMERCE_CATALOG.find(
      (item) => item.name === "Maquillage nude",
    );
    expect(service !== undefined).toBe(true);
    expect(catalogPriceForPrimaryCurrency(service!, "USD", 2800)).toBe(25);
    expect(catalogPriceForPrimaryCurrency(service!, "CDF", 2800)).toBe(70000);
  });
});
