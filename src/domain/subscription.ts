import type { CloudSession, PlanPermissions } from "../data/cloudSession";

export type PlanFeature =
  | "tickets"
  | "export_excel"
  | "advanced_reports"
  | "tablets"
  | "cashiers";

export function planLabel(type: string): string {
  const labels: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    big: "Big",
  };
  return labels[type] ?? type;
}

export function planAllows(
  session: CloudSession | null | undefined,
  feature: PlanFeature,
): boolean {
  const perms = session?.subscriptionPermissions as PlanPermissions | undefined;
  if (!session?.subscriptionType || !perms) return false;
  switch (feature) {
    case "tickets":
      return Boolean(perms.tickets);
    case "export_excel":
      return Boolean(perms.export_excel);
    case "advanced_reports":
      return perms.reports === "advanced";
    case "tablets":
      return perms.tablets > 0;
    case "cashiers":
      return perms.cashiers === 0 || perms.cashiers > 0;
    default:
      return true;
  }
}

export function subscriptionDaysLeft(expiresAt?: string): number {
  if (!expiresAt) return 0;
  const diff = Date.parse(expiresAt) - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}