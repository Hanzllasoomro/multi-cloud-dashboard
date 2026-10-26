// Ledger — authorization model (v1.3).
//
// This file is the single source of truth for the roles matrix shown in
// Settings. API routes enforce it server-side via src/lib/auth-guard.ts;
// UI components only hide buttons — hiding is never the enforcement.
// Viewer data access is "scoped": a Viewer may read data, but never all
// data unscoped and never any management action.

export type Role = "Owner" | "Admin" | "FinOps Manager" | "Analyst" | "Viewer" | "Auditor";

export type Permission =
  | "managePlan"
  | "manageMembers"
  | "manageConnections"
  | "viewAllData"
  | "manageBudgets"
  | "manageAllocation"
  | "manageExports"
  | "manageApiKeys"
  | "viewAudit";

export const ROLES: Role[] = ["Owner", "Admin", "FinOps Manager", "Analyst", "Viewer", "Auditor"];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Owner: ["managePlan", "manageMembers", "manageConnections", "viewAllData", "manageBudgets", "manageAllocation", "manageExports", "manageApiKeys", "viewAudit"],
  Admin: ["manageMembers", "manageConnections", "viewAllData", "manageBudgets", "manageAllocation", "manageExports", "manageApiKeys", "viewAudit"],
  "FinOps Manager": ["manageConnections", "viewAllData", "manageBudgets", "manageAllocation", "manageExports", "manageApiKeys"],
  Analyst: ["viewAllData", "manageBudgets", "manageExports"],
  Viewer: ["manageExports"], // scoped only: read own/scoped data and scoped exports
  Auditor: ["viewAllData", "manageExports", "viewAudit"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Viewer never sees unscoped "all data"; every other role does. */
export function canViewAllData(role: Role): boolean {
  return can(role, "viewAllData");
}

/** Display rows for the Settings roles matrix — same data as can(), in words. */
export interface RoleMatrixRow {
  role: Role; plan: string; members: string; connections: string; data: string;
  budgets: string; allocation: string; exports: string; api: string; audit: string;
}
export const ROLE_MATRIX: RoleMatrixRow[] = [
  { role: "Owner", plan: "✓", members: "✓", connections: "✓", data: "✓", budgets: "✓", allocation: "✓", exports: "✓", api: "✓", audit: "✓" },
  { role: "Admin", plan: "—", members: "✓", connections: "✓", data: "✓", budgets: "✓", allocation: "✓", exports: "✓", api: "✓", audit: "✓" },
  { role: "FinOps Manager", plan: "—", members: "—", connections: "✓", data: "✓", budgets: "✓", allocation: "✓", exports: "✓", api: "✓", audit: "—" },
  { role: "Analyst", plan: "—", members: "—", connections: "—", data: "✓", budgets: "✓", allocation: "—", exports: "✓", api: "—", audit: "—" },
  { role: "Viewer", plan: "—", members: "—", connections: "—", data: "Scoped", budgets: "Own", allocation: "—", exports: "Scoped", api: "—", audit: "—" },
  { role: "Auditor", plan: "—", members: "—", connections: "—", data: "✓", budgets: "—", allocation: "—", exports: "✓", api: "—", audit: "✓" },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  managePlan: "Manage plan and payment",
  manageMembers: "Manage members, roles, SSO",
  manageConnections: "Add, edit, remove cloud connections",
  viewAllData: "View all cost and usage data",
  manageBudgets: "Create budgets, alerts, dashboards",
  manageAllocation: "Manage allocation rules",
  manageExports: "Create reports and exports",
  manageApiKeys: "Manage API keys and webhooks",
  viewAudit: "View audit log",
};
