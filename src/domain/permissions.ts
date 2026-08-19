import type { Role, ScreenKey, User } from "../types";

export type Permission =
  | "dashboard.full"
  | "orders.view"
  | "orders.create"
  | "products.view"
  | "products.manage"
  | "stock.adjust"
  | "clients.view"
  | "clients.create"
  | "clients.manage"
  | "appointments.view"
  | "appointments.manage"
  | "attendance.manage"
  | "statistics.view"
  | "expenses.manage"
  | "team.manage"
  | "logs.view"
  | "tickets.manage"
  | "backup.manage";

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  boss: new Set<Permission>([
    "dashboard.full",
    "orders.view",
    "orders.create",
    "products.view",
    "products.manage",
    "stock.adjust",
    "clients.view",
    "clients.create",
    "clients.manage",
    "appointments.view",
    "appointments.manage",
    "attendance.manage",
    "statistics.view",
    "expenses.manage",
    "team.manage",
    "logs.view",
    "tickets.manage",
    "backup.manage",
  ]),
  manager: new Set<Permission>([
    "dashboard.full",
    "orders.view",
    "orders.create",
    "products.view",
    "products.manage",
    "stock.adjust",
    "clients.view",
    "clients.create",
    "clients.manage",
    "appointments.view",
    "appointments.manage",
    "attendance.manage",
    "statistics.view",
    "expenses.manage",
    "logs.view",
  ]),
  cashier: new Set<Permission>([
    "orders.view",
    "orders.create",
    "products.view",
    "clients.view",
    "clients.create",
    "appointments.view",
  ]),
  employee: new Set<Permission>([
    "orders.view",
    "orders.create",
    "products.view",
    "clients.view",
    "clients.create",
    "appointments.view",
    "appointments.manage",
  ]),
};

export function permissionsForRole(
  role: Role,
): ReadonlySet<Permission> {
  return rolePermissions[role];
}

const allPermissions: ReadonlySet<Permission> = new Set(
  (Object.values(rolePermissions) as ReadonlySet<Permission>[]).flatMap(
    (set) => [...set],
  ),
);

export function parsePermissions(
  raw: string | null | undefined,
): ReadonlySet<Permission> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const known = new Set<string>(
      value.filter((item): item is string => typeof item === "string"),
    );
    return new Set<Permission>(
      [...allPermissions].filter((permission) => known.has(permission)),
    );
  } catch {
    return null;
  }
}

export function can(
  role: Role,
  permission: Permission,
  custom?: ReadonlySet<Permission> | null,
): boolean {
  if (custom) return custom.has(permission);
  return rolePermissions[role].has(permission);
}

export function canAccessScreen(
  role: Role,
  screen: ScreenKey,
  custom?: ReadonlySet<Permission> | null,
): boolean {
  const permissionByScreen: Record<ScreenKey, Permission> = {
    home_dashboard: role === "employee" ? "orders.view" : "dashboard.full",
    home_caisse: "orders.view",
    home_boutique: "products.view",
    statistics: "statistics.view",
    expenses: "expenses.manage",
    orders: "orders.view",
    products: "products.view",
    clients: "clients.view",
    appointments: "appointments.view",
    attendance: "attendance.manage",
    team: "team.manage",
    permissions: "team.manage",
    logs: "logs.view",
    tickets: "tickets.manage",
    settings: "backup.manage",
  };
  return can(role, permissionByScreen[screen], custom);
}

export function userCan(
  user: Pick<User, "role" | "permissions">,
  permission: Permission,
): boolean {
  return can(user.role, permission, parsePermissions(user.permissions));
}

export function userCanAccessScreen(
  user: Pick<User, "role" | "permissions">,
  screen: ScreenKey,
): boolean {
  return canAccessScreen(
    user.role,
    screen,
    parsePermissions(user.permissions),
  );
}

export const roleLabel: Record<Role, string> = {
  boss: "Propriétaire",
  manager: "Gérant",
  cashier: "Caissier",
  employee: "Employé",
};

export const accountRoleDescriptions: Record<
  Exclude<Role, "boss">,
  string
> = {
  manager: "Gère la boutique : produits, stock, équipe, statistiques et présences.",
  cashier: "Encaisse les ventes et gère les clients, sans toucher au stock ni aux réglages.",
  employee: "Encaisse, crée des clients et gère les rendez-vous avec un accès minimal.",
};

export interface PermissionGroup {
  title: string;
  permissions: Array<{ key: Permission; label: string }>;
}

export const permissionGroups: PermissionGroup[] = [
  {
    title: "Dashboard",
    permissions: [
      { key: "dashboard.full", label: "Voir le dashboard et les accès" },
    ],
  },
  {
    title: "Caisse",
    permissions: [
      { key: "orders.view", label: "Consulter les ventes" },
      { key: "orders.create", label: "Encaisser une vente" },
    ],
  },
  {
    title: "Produits",
    permissions: [
      { key: "products.view", label: "Consulter le catalogue" },
      { key: "products.manage", label: "Ajouter, modifier ou retirer des produits" },
      { key: "stock.adjust", label: "Ajuster le stock" },
    ],
  },
  {
    title: "Clients",
    permissions: [
      { key: "clients.view", label: "Consulter les clients" },
      { key: "clients.create", label: "Créer un client" },
      { key: "clients.manage", label: "Modifier ou retirer des clients" },
    ],
  },
  {
    title: "Rendez-vous",
    permissions: [
      { key: "appointments.view", label: "Consulter les rendez-vous" },
      { key: "appointments.manage", label: "Créer ou modifier des rendez-vous" },
    ],
  },
  {
    title: "Équipe",
    permissions: [
      { key: "attendance.manage", label: "Gérer les présences" },
      { key: "team.manage", label: "Gérer les employés et les comptes" },
      { key: "logs.view", label: "Consulter l’activité" },
    ],
  },
  {
    title: "Direction",
    permissions: [
      { key: "statistics.view", label: "Voir les statistiques" },
      { key: "expenses.manage", label: "Gérer les dépenses" },
      { key: "tickets.manage", label: "Modifier le modèle des tickets" },
      { key: "backup.manage", label: "Gérer les sauvegardes et réglages" },
    ],
  },
];