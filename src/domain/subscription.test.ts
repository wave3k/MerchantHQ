import { describe, expect, test } from "bun:test";

import type { CloudSession, PlanPermissions } from "../data/cloudSession";
import { planAllows, planLabel, subscriptionDaysLeft } from "./subscription";

function perms(overrides: Partial<PlanPermissions> = {}): PlanPermissions {
  return {
    tablets: 2,
    cashiers: 3,
    backup: "daily",
    reports: "advanced",
    export_excel: true,
    tickets: true,
    support: "email",
    ...overrides,
  };
}

function session(overrides: Partial<CloudSession> = {}): CloudSession {
  return {
    accountId: "acc",
    email: "a@b.com",
    emailVerified: true,
    shopName: "Boutique",
    subscriptionType: "pro",
    subscriptionPermissions: perms(),
    ...overrides,
  };
}

describe("planLabel", () => {
  test("traduit les plans connus et laisse les autres", () => {
    expect(planLabel("starter")).toBe("Starter");
    expect(planLabel("pro")).toBe("Pro");
    expect(planLabel("big")).toBe("Big");
    expect(planLabel("custom")).toBe("custom");
  });
});

describe("planAllows", () => {
  test("refuse sans abonnement ou sans permissions", () => {
    expect(planAllows(null, "tickets")).toBe(false);
    expect(planAllows(undefined, "tickets")).toBe(false);
    expect(planAllows(session({ subscriptionType: undefined }), "tickets")).toBe(
      false,
    );
    expect(
      planAllows(session({ subscriptionPermissions: undefined }), "tickets"),
    ).toBe(false);
  });

  test("autorise les fonctions incluses dans le plan", () => {
    const pro = session();
    expect(planAllows(pro, "tickets")).toBe(true);
    expect(planAllows(pro, "export_excel")).toBe(true);
    expect(planAllows(pro, "advanced_reports")).toBe(true);
    expect(planAllows(pro, "tablets")).toBe(true);
    expect(planAllows(pro, "cashiers")).toBe(true);
  });

  test("rapports avancés uniquement si reports = advanced", () => {
    expect(
      planAllows(
        session({ subscriptionPermissions: perms({ reports: "basic" }) }),
        "advanced_reports",
      ),
    ).toBe(false);
  });

  test("aucune tablette quand la limite est nulle", () => {
    expect(
      planAllows(
        session({ subscriptionPermissions: perms({ tablets: 0 }) }),
        "tablets",
      ),
    ).toBe(false);
  });

  test("options désactivées du plan", () => {
    const basic = session({
      subscriptionPermissions: perms({ tickets: false, export_excel: false }),
    });
    expect(planAllows(basic, "tickets")).toBe(false);
    expect(planAllows(basic, "export_excel")).toBe(false);
  });
});

describe("subscriptionDaysLeft", () => {
  test("renvoie 0 sans date ou date passée", () => {
    expect(subscriptionDaysLeft()).toBe(0);
    expect(subscriptionDaysLeft("")).toBe(0);
    expect(subscriptionDaysLeft(new Date(Date.now() - 1_000).toISOString())).toBe(
      0,
    );
  });

  test("compte les jours restants (arrondi supérieur)", () => {
    const inTwoDays = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const days = subscriptionDaysLeft(inTwoDays);
    expect(days >= 1 && days <= 2).toBe(true);
  });
});
