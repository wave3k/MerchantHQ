import { expect, test } from "bun:test";

import {
  configureFormatting,
  formatMoney,
  initials,
  normalizePhone,
} from "./format";

test("initials limite le résultat à deux lettres", () => {
  expect(initials("Maman Boutique Kinshasa")).toBe("MB");
});

test("normalizePhone conserve le préfixe international", () => {
  expect(normalizePhone("+243 812 345 678")).toBe("+243812345678");
});

test("formatMoney affiche la devise principale et la devise secondaire", () => {
  configureFormatting({
    primary: "CDF",
    secondary: "USD",
    rate: 2800,
    language: "fr",
  });
  const value = formatMoney(2800);
  expect(value.includes("FC")).toBe(true);
  expect(value.includes("$")).toBe(true);
});
