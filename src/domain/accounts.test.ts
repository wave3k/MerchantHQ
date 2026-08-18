import { describe, expect, test } from "bun:test";

import { validateAccountPassword } from "./accounts";

describe("codes des comptes", () => {
  test("un employé peut avoir un compte sans code", () => {
    expect(validateAccountPassword("employee", "")).toBe(null);
  });

  test("un code employé renseigné doit avoir au moins 4 caractères", () => {
    expect(validateAccountPassword("employee", "12")).toBe(
      "Laissez le code vide ou utilisez au moins 4 caractères.",
    );
  });

  test("un gérant doit toujours avoir un code", () => {
    expect(validateAccountPassword("manager", "")).toBe(
      "Le compte Gérant doit avoir un code d’au moins 4 caractères.",
    );
  });
});
