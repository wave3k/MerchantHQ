import { expect, test } from "bun:test";

import {
  evaluateExpression,
  marginRate,
  percentageOf,
  withDiscount,
  withTax,
} from "./calculator";

test("évalue les priorités opératoires", () => {
  expect(evaluateExpression("2 + 3 * 4")).toBe(14);
  expect(evaluateExpression("(2 + 3) * 4")).toBe(20);
});

test("gère les calculs commerciaux", () => {
  expect(percentageOf(200, 15)).toBe(30);
  expect(withTax(100, 16)).toBe(116);
  expect(withDiscount(100, 20)).toBe(80);
  expect(marginRate(60, 100)).toBe(40);
});
