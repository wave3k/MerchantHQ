import { describe, expect, test } from "bun:test";

import {
  formatAppointmentDate,
  formatAppointmentTime,
  formatReminderDelay,
  parseAppointmentDate,
} from "./appointments";

describe("rendez-vous", () => {
  test("convertit une date et une heure locales valides", () => {
    const result = parseAppointmentDate("29/02/2028", "14:30");
    expect(result?.getFullYear()).toBe(2028);
    expect(result?.getMonth()).toBe(1);
    expect(result?.getDate()).toBe(29);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
  });

  test("refuse une date ou une heure impossible", () => {
    expect(parseAppointmentDate("31/02/2028", "14:30")).toBe(null);
    expect(parseAppointmentDate("28/02/2028", "24:00")).toBe(null);
  });

  test("formate les valeurs pour le formulaire", () => {
    const value = new Date(2028, 5, 8, 9, 5);
    expect(formatAppointmentDate(value)).toBe("08/06/2028");
    expect(formatAppointmentTime(value)).toBe("09:05");
  });

  test("formate le délai du rappel", () => {
    expect(formatReminderDelay(0)).toBe("Aucun rappel");
    expect(formatReminderDelay(30)).toBe("30 min avant");
    expect(formatReminderDelay(60)).toBe("1 heure avant");
    expect(formatReminderDelay(120)).toBe("2 heures avant");
    expect(formatReminderDelay(1440)).toBe("1 jour avant");
  });
});
