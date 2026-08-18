import { describe, expect, test } from "bun:test";

import {
  formatArrivalTime,
  localDateKey,
  parseArrivalTime,
  shiftDateKey,
} from "./attendance";

describe("présences", () => {
  test("utilise la date locale sans décalage UTC", () => {
    expect(localDateKey(new Date(2026, 7, 3, 23, 45))).toBe("2026-08-03");
  });

  test("navigue entre les journées", () => {
    expect(shiftDateKey("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDateKey("2026-08-31", 1)).toBe("2026-09-01");
  });

  test("valide et reformate une heure d’arrivée", () => {
    const value = parseArrivalTime("2026-08-03", "08:15");
    expect(Boolean(value)).toBe(true);
    expect(formatArrivalTime(value)).toBe("08:15");
    expect(parseArrivalTime("2026-08-03", "25:10")).toBe(null);
  });
});
