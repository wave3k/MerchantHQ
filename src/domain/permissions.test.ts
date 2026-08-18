import { describe, expect, test } from "bun:test";

import type { Permission } from "./permissions";
import {
  can,
  canAccessScreen,
  parsePermissions,
  permissionsForRole,
  userCan,
  userCanAccessScreen,
} from "./permissions";

describe("permissions", () => {
  test("un employé peut encaisser et créer un client", () => {
    expect(can("employee", "orders.create")).toBe(true);
    expect(can("employee", "clients.create")).toBe(true);
  });

  test("un caissier encaisse sans gérer le stock ni les rendez-vous", () => {
    expect(can("cashier", "orders.create")).toBe(true);
    expect(can("cashier", "orders.view")).toBe(true);
    expect(can("cashier", "clients.create")).toBe(true);
    expect(can("cashier", "products.view")).toBe(true);
    expect(can("cashier", "stock.adjust")).toBe(false);
    expect(can("cashier", "appointments.manage")).toBe(false);
    expect(canAccessScreen("cashier", "orders")).toBe(true);
    expect(canAccessScreen("cashier", "products")).toBe(true);
    expect(canAccessScreen("cashier", "statistics")).toBe(false);
    expect(canAccessScreen("cashier", "team")).toBe(false);
  });

  test("un employé peut gérer les rendez-vous sans voir les statistiques", () => {
    expect(can("employee", "appointments.manage")).toBe(true);
    expect(canAccessScreen("employee", "appointments")).toBe(true);
    expect(canAccessScreen("employee", "statistics")).toBe(false);
    expect(canAccessScreen("manager", "statistics")).toBe(true);
  });

  test("un employé ne peut pas modifier le stock", () => {
    expect(can("employee", "stock.adjust")).toBe(false);
    expect(can("employee", "products.manage")).toBe(false);
  });

  test("le boss et le gérant gèrent les présences", () => {
    expect(canAccessScreen("boss", "attendance")).toBe(true);
    expect(canAccessScreen("manager", "attendance")).toBe(true);
    expect(canAccessScreen("employee", "attendance")).toBe(false);
  });

  test("seul le boss accède aux sauvegardes et à l’équipe", () => {
    expect(can("boss", "backup.manage")).toBe(true);
    expect(can("manager", "backup.manage")).toBe(false);
    expect(canAccessScreen("employee", "team")).toBe(false);
  });

  test("seul le boss peut modifier le modèle des tickets", () => {
    expect(canAccessScreen("boss", "tickets")).toBe(true);
    expect(canAccessScreen("manager", "tickets")).toBe(false);
    expect(canAccessScreen("employee", "tickets")).toBe(false);
  });

  test("des permissions personnalisées remplacent celles du rôle", () => {
    const custom = new Set(permissionsForRole("employee"));
    custom.add("statistics.view");
    custom.delete("orders.create");
    expect(can("employee", "statistics.view", custom)).toBe(true);
    expect(can("employee", "orders.create", custom)).toBe(false);
    expect(canAccessScreen("employee", "statistics", custom)).toBe(true);
    expect(canAccessScreen("employee", "products", custom)).toBe(true);
  });

  test("les permissions d’un utilisateur sont lues depuis son compte", () => {
    const employee = {
      role: "employee" as const,
      permissions: JSON.stringify(["statistics.view"]),
    };
    expect(userCan(employee, "statistics.view")).toBe(true);
    expect(userCan(employee, "orders.create")).toBe(false);
    expect(userCanAccessScreen(employee, "statistics")).toBe(true);
    expect(userCanAccessScreen(employee, "orders")).toBe(false);
  });

  test("des permissions invalides sont ignorées", () => {
    expect(parsePermissions("pas du json")).toBe(null);
    expect(parsePermissions('"une chaîne"')).toBe(null);
    const parsed = parsePermissions('["orders.view", "inconnue"]');
    expect(parsed === null).toBe(false);
    expect(parsed?.has("orders.view")).toBe(true);
    expect(parsed?.has("inconnue" as Permission)).toBe(false);
  });
});
