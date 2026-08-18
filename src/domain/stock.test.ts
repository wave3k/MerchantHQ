import { describe, expect, test } from "bun:test";

import {
  isLowStock,
  isOutOfStock,
  maximumSaleQuantity,
  tracksStock,
} from "./stock";

describe("produits à stock illimité", () => {
  const unlimited = {
    tracks_stock: 0,
    stock: 0,
    low_stock_threshold: 5,
  };

  test("reste disponible même avec une quantité enregistrée à zéro", () => {
    expect(tracksStock(unlimited)).toBe(false);
    expect(isOutOfStock(unlimited)).toBe(false);
    expect(isLowStock(unlimited)).toBe(false);
  });

  test("n’impose pas de plafond dans le panier", () => {
    expect(maximumSaleQuantity(unlimited)).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("conserve les règles habituelles pour un produit suivi", () => {
    const tracked = {
      tracks_stock: 1,
      stock: 2,
      low_stock_threshold: 5,
    };
    expect(tracksStock(tracked)).toBe(true);
    expect(isOutOfStock(tracked)).toBe(false);
    expect(isLowStock(tracked)).toBe(true);
    expect(maximumSaleQuantity(tracked)).toBe(2);
  });
});
