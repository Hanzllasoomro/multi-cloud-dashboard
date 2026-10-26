// Ledger — connected-accounts store (v1.2).
//
// IN-MEMORY STORE — READ THIS BEFORE PRODUCTION USE: this module keeps
// accounts and audit entries in a module-level variable in the server
// process. It resets on server restart and does not survive a multi-instance
// deployment. A real database replaces exactly this one module later; the
// API shapes, the account model, and the audit format do not change.
// NEVER store a credential here: live credentials stay in server environment
// variables only (see docs/REAL_ACCOUNTS.md) and are never returned by any
// API, never logged, and never appear in this store. Account records carry
// identifiers and scopes only.
//
// Demo mapping (documented, not hidden): demo cost rows carry subAccount
// names (prod-aws, staging-aws, prod-azure-sub, prod-gcp-project). A managed
// account's scope.accounts lists the sub-account names it covers, so
// pausing an account excludes exactly those rows from /api/query totals.
// In live mode the same scope matching applies to live rows' subAccount /
// subAccountId; a paused account whose scope is empty excludes its whole
// provider (it is the sole account for that provider by construction).
import type { CostRow, Provider } from "./types";
import { CONNECTORS, getDataSource } from "./providers/source";

export type AccountStatus = "Pending" | "Validating" | "Healthy" | "Degraded" | "Broken" | "Paused";
export type AccountMode = "demo" | "live";
export interface AccountScope { providers: Provider[]; accounts: string[]; tags: string[]; teams: string[] }
export interface ManagedAccount {
  id: string; provider: Provider; displayName: string; accountId: string; billingAccount: string;
  scope: AccountScope; status: AccountStatus; lastSync: string; nextSync: string;
  mode: AccountMode; createdBy: string; createdAt: string;
  /** Status held before a pause, restored on resume. Internal bookkeeping. */
  previousStatus?: AccountStatus;
}
export interface AuditEntry { id: string; when: string; who: string; what: string; accountId?: string }
export interface ChecklistItem { permission: string; reason: string; status: "pass" | "fail"; fix?: string }
export interface ChecklistResult { account: ManagedAccount; checklist: ChecklistItem[]; passed: number; total: number; mode: AccountMode }

const ACTOR = "finops@acme.example";
const PROVIDERS: Provider[] = ["AWS", "Azure", "GCP"];

/** Permissions checked by "Test connection", with the reason each exists. */
export const PERMISSIONS: Record<Provider, { permission: string; reason: string }[]> = {
  AWS: [
    { permission: "ce:GetCostAndUsage", reason: "Independent reconciliation total (Cost Explorer)" },
    { permission: "s3:GetObject on the export prefix", reason: "Read the FOCUS billing export files" },
    { permission: "organizations:ListAccounts", reason: "Discover member accounts under the payer" },
  ],
  Azure: [
    { permission: "Cost Management Reader", reason: "Read cost + FOCUS exports" },
    { permission: "Reader", reason: "Resource inventory (read-only)" },
    { permission: "Storage Blob Data Reader on export container", reason: "Read export blobs" },
  ],
  GCP: [
    { permission: "BigQuery Data Viewer on the billing dataset", reason: "Read detailed + pricing billing export" },
    { permission: "BigQuery Job User", reason: "Run export queries (or extract to Cloud Storage)" },
    { permission: "Billing Viewer", reason: "Invoice context" },
  ],
};

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
function seedAccounts(): ManagedAccount[] {
  return [
    { id: "acc-aws", provider: "AWS", displayName: "AWS production (payer)", accountId: "123456789012", billingAccount: "123456789012",
      scope: { providers: ["AWS"], accounts: ["prod-aws", "staging-aws"], tags: [], teams: ["platform"] },
      status: "Healthy", lastSync: "2026-10-26 02:10 UTC", nextSync: "2026-10-27 02:10 UTC", mode: "demo", createdBy: ACTOR, createdAt: "2026-10-26 02:10 UTC" },
    { id: "acc-azure", provider: "Azure", displayName: "Azure MCA billing", accountId: "sub-9f21-azure", billingAccount: "sub-9f21-azure",
      scope: { providers: ["Azure"], accounts: ["prod-azure-sub"], tags: [], teams: ["platform"] },
      status: "Degraded", lastSync: "2026-10-24 18:40 UTC", nextSync: "2026-10-25 18:40 UTC", mode: "demo", createdBy: ACTOR, createdAt: "2026-10-24 18:40 UTC" },
    { id: "acc-gcp", provider: "GCP", displayName: "GCP billing export", accountId: "proj-ledger-4412", billingAccount: "proj-ledger-4412",
      scope: { providers: ["GCP"], accounts: ["prod-gcp-project"], tags: [], teams: ["platform"] },
      status: "Healthy", lastSync: "2026-10-26 01:55 UTC", nextSync: "2026-10-27 01:55 UTC", mode: "demo", createdBy: ACTOR, createdAt: "2026-10-26 01:55 UTC" },
  ];
}
let accounts: ManagedAccount[] = seedAccounts();
let audit: AuditEntry[] = seedAccounts().map((a) => ({
  id: `audit-seed-${a.id}`, when: a.createdAt, who: "system (seed)",
  what: `Account seeded (demo): ${a.displayName} (${a.provider})`, accountId: a.id,
}));
let auditCounter = 0;

/** Test-only reset: restores the seeded store. Never called by API routes. */
export function resetAccountStore(): void {
  accounts = seedAccounts();
  audit = seedAccounts().map((a) => ({
    id: `audit-seed-${a.id}`, when: a.createdAt, who: "system (seed)",
    what: `Account seeded (demo): ${a.displayName} (${a.provider})`, accountId: a.id,
  }));
  auditCounter = 0;
}
function log(what: string, accountId?: string): void {
  audit.unshift({ id: `audit-${++auditCounter}-${Date.now().toString(36)}`, when: stamp(), who: ACTOR, what, accountId });
}
export function listAccounts(): ManagedAccount[] { return accounts.map((a) => ({ ...a, scope: { ...a.scope, providers: [...a.scope.providers], accounts: [...a.scope.accounts], tags: [...a.scope.tags], teams: [...a.scope.teams] } })); }
export function getAccount(id: string): ManagedAccount | undefined { return accounts.find((a) => a.id === id); }
export function listAudit(): AuditEntry[] { return [...audit]; }

function cleanScope(input: Partial<AccountScope> | undefined, provider: Provider): AccountScope {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v : []).map(String).map((s) => s.trim()).filter(Boolean);
  return {
    providers: input?.providers?.filter((p): p is Provider => PROVIDERS.includes(p)).length ? input.providers.filter((p): p is Provider => PROVIDERS.includes(p)) : [provider],
    accounts: arr(input?.accounts), tags: arr(input?.tags), teams: arr(input?.teams),
  };
}
export interface CreateAccountInput { provider: Provider; displayName: string; accountId: string; billingAccount: string; scope?: Partial<AccountScope> }
export function createAccount(input: CreateAccountInput): ManagedAccount {
  if (!PROVIDERS.includes(input.provider)) throw new Error("provider must be AWS, Azure, or GCP");
  if (!input.displayName?.trim()) throw new Error("displayName is required");
  if (!input.accountId?.trim()) throw new Error("accountId is required (AWS account / Azure subscription / GCP project)");
  if (!input.billingAccount?.trim()) throw new Error("billingAccount is required");
  const now = stamp();
  const acc: ManagedAccount = {
    id: `acc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    provider: input.provider, displayName: input.displayName.trim(), accountId: input.accountId.trim(), billingAccount: input.billingAccount.trim(),
    scope: cleanScope(input.scope, input.provider), status: "Pending", lastSync: "—", nextSync: "—",
    mode: getDataSource(), createdBy: ACTOR, createdAt: now,
  };
  accounts.push(acc);
  log(`Account added: ${acc.displayName} (${acc.provider})`, acc.id);
  return { ...acc, scope: { ...acc.scope } };
}
export interface UpdateAccountInput { displayName?: string; scope?: Partial<AccountScope>; status?: "Paused" | "Healthy" }
export function updateAccount(id: string, patch: UpdateAccountInput): ManagedAccount {
  const acc = getAccount(id);
  if (!acc) throw new Error("Account not found");
  if (patch.displayName !== undefined) {
    if (!patch.displayName.trim()) throw new Error("displayName is required");
    acc.displayName = patch.displayName.trim();
  }
  if (patch.scope !== undefined) acc.scope = cleanScope(patch.scope, acc.provider);
  if (patch.status === "Paused") {
    if (acc.status !== "Paused") { acc.previousStatus = acc.status; acc.status = "Paused"; log(`Account paused: ${acc.displayName} (${acc.provider}) — excluded from query totals`, acc.id); }
  } else if (patch.status === "Healthy") {
    if (acc.status === "Paused") {
      const restored = acc.previousStatus && acc.previousStatus !== "Paused" ? acc.previousStatus : "Healthy";
      acc.status = restored; delete acc.previousStatus;
      log(`Account resumed: ${acc.displayName} (${acc.provider}) — restored to ${restored}`, acc.id);
    }
  } else if (patch.status !== undefined) {
    throw new Error("status may only be set to Paused or Healthy via this endpoint (test sets Healthy/Degraded/Broken)");
  }
  if (patch.displayName !== undefined || patch.scope !== undefined) log(`Account edited: ${acc.displayName} (${acc.provider})`, acc.id);
  return { ...acc, scope: { ...acc.scope } };
}
export function removeAccount(id: string, confirm: string, dataChoice: "keep" | "purge"): ManagedAccount {
  const acc = getAccount(id);
  if (!acc) throw new Error("Account not found");
  if (confirm !== acc.displayName) throw new Error("Delete confirmation does not match the account display name — type the display name exactly to confirm removal.");
  if (dataChoice !== "keep" && dataChoice !== "purge") throw new Error("dataChoice must be keep or purge");
  accounts = accounts.filter((a) => a.id !== id);
  const note = dataChoice === "keep"
    ? "Historical cost data kept (visible in past periods, no new ingestion)."
    : "Data purge requested. NOTE: in this version demo rows are a shared synthetic dataset, so purge is recorded in the audit log but does not delete other accounts' demo rows; in production a purge job deletes this account's rows.";
  log(`Account removed: ${acc.displayName} (${acc.provider}) — data: ${dataChoice}. ${note}`, acc.id);
  return acc;
}

/** Build the per-permission checklist. Live = env-presence check (names only),
 *  never a live provider call and never a credential value. Demo = simulated
 *  checklist, labelled as such by the caller; the seeded Azure account keeps
 *  one failing item so its Degraded story stays visible. */
export function runTestChecklist(id: string): ChecklistResult {
  const acc = getAccount(id);
  if (!acc) throw new Error("Account not found");
  const mode = getDataSource();
  acc.status = "Validating";
  let checklist: ChecklistItem[];
  if (mode === "live") {
    const connector = CONNECTORS.find((c) => c.provider === acc.provider);
    const missing = connector ? connector.validate().missing : [];
    checklist = PERMISSIONS[acc.provider].map((p) => missing.length === 0
      ? { permission: p.permission, reason: p.reason, status: "pass" as const }
      : { permission: p.permission, reason: p.reason, status: "fail" as const, fix: `Set server env var(s): ${missing.join(", ")} (names only — never paste values here), then re-test.` });
  } else {
    checklist = PERMISSIONS[acc.provider].map((p) => {
      const fails = acc.id === "acc-azure" && p.permission.startsWith("Storage Blob Data Reader");
      return fails
        ? { permission: p.permission, reason: p.reason, status: "fail" as const, fix: "Re-apply the export container role assignment; check the export has delivered at least one file. (Demo simulation.)" }
        : { permission: p.permission, reason: p.reason, status: "pass" as const };
    });
  }
  const passed = checklist.filter((c) => c.status === "pass").length;
  acc.status = passed === checklist.length ? "Healthy" : passed === 0 ? "Broken" : "Degraded";
  acc.lastSync = stamp();
  log(`Connection tested: ${acc.displayName} (${acc.provider}) — ${passed}/${checklist.length} checks passed, status ${acc.status} (${mode} mode)`, acc.id);
  return { account: { ...acc, scope: { ...acc.scope } }, checklist, passed, total: checklist.length, mode };
}

/** Paused accounts are excluded from query totals. Matching: scope.accounts
 *  against row subAccount/subAccountId, the account's own identifier against
 *  subAccountId, or — when scope.accounts is empty — the whole provider. */
export function excludePausedRows(rows: CostRow[], all: ManagedAccount[] = listAccounts()): CostRow[] {
  const paused = all.filter((a) => a.status === "Paused");
  if (!paused.length) return rows;
  return rows.filter((r) => !paused.some((a) =>
    a.scope.accounts.includes(r.subAccount) || a.scope.accounts.includes(r.subAccountId) ||
    a.accountId === r.subAccountId || (a.scope.accounts.length === 0 && a.provider === r.provider)));
}
/** Expand managed account ids to the sub-account names they cover. */
export function expandAccountIds(ids: string[], all: ManagedAccount[] = listAccounts()): string[] {
  const out: string[] = [];
  ids.forEach((id) => {
    const a = all.find((x) => x.id === id);
    if (a) a.scope.accounts.forEach((s) => { if (!out.includes(s)) out.push(s); });
  });
  return out;
}
