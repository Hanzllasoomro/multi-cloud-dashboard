// Ledger — Postgres connected-accounts store (v1.7).
// Same shapes as src/lib/accounts.ts. The dispatcher in accounts.ts
// picks this module when DATABASE_URL is set (never under Vitest).
// Seeds the three demo accounts on first use when the table is empty,
// mirroring the in-memory seed.
import { dbQuery, ensureSchema, getPool } from "./db";
import type { AuditEntry, ManagedAccount } from "./accounts";

function rowToAccount(r: Record<string, unknown>): ManagedAccount {
  const scope = (r.scope as ManagedAccount["scope"]) || { providers: [], accounts: [], tags: [], teams: [] };
  return {
    id: r.id as string, provider: r.provider as ManagedAccount["provider"],
    displayName: r.display_name as string, accountId: r.account_id as string,
    billingAccount: r.billing_account as string, scope,
    status: r.status as ManagedAccount["status"], lastSync: r.last_sync as string,
    nextSync: r.next_sync as string, mode: r.mode as ManagedAccount["mode"],
    createdBy: r.created_by as string, createdAt: r.created_at as string,
    previousStatus: (r.previous_status as ManagedAccount["status"]) || undefined,
  };
}
function rowToAudit(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as string, when: r.when as string, who: r.who as string,
    what: r.what as string, accountId: (r.account_id as string) || undefined,
  };
}
const ACC_COLS = "id, provider, display_name, account_id, billing_account, scope, status, last_sync, next_sync, mode, created_by, created_at, previous_status";
const ACC_VALUES = "$1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13";

export async function pgSeedIfEmpty(seed: ManagedAccount[], seedAudit: AuditEntry[]): Promise<void> {
  await ensureSchema(getPool());
  const { rows } = await dbQuery<{ count: string }>("SELECT COUNT(*)::text AS count FROM managed_accounts");
  if (Number(rows[0]?.count || 0) > 0) return;
  for (const a of seed) {
    await dbQuery(
      `INSERT INTO managed_accounts (${ACC_COLS}) VALUES (${ACC_VALUES}) ON CONFLICT (id) DO NOTHING`,
      [a.id, a.provider, a.displayName, a.accountId, a.billingAccount, JSON.stringify(a.scope), a.status, a.lastSync, a.nextSync, a.mode, a.createdBy, a.createdAt, a.previousStatus || null],
    );
  }
  for (const e of seedAudit) {
    await dbQuery(
      'INSERT INTO account_audit (id, "when", who, what, account_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
      [e.id, e.when, e.who, e.what, e.accountId || null],
    );
  }
}

export async function pgListAccounts(): Promise<ManagedAccount[]> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM managed_accounts ORDER BY created_at ASC");
  return rows.map(rowToAccount);
}
export async function pgGetAccount(id: string): Promise<ManagedAccount | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM managed_accounts WHERE id = $1", [id]);
  return rows[0] ? rowToAccount(rows[0]) : undefined;
}
export async function pgUpsertAccount(a: ManagedAccount): Promise<void> {
  await dbQuery(
    `INSERT INTO managed_accounts (${ACC_COLS}) VALUES (${ACC_VALUES})
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, scope = EXCLUDED.scope,
       status = EXCLUDED.status, last_sync = EXCLUDED.last_sync, next_sync = EXCLUDED.next_sync,
       previous_status = EXCLUDED.previous_status`,
    [a.id, a.provider, a.displayName, a.accountId, a.billingAccount, JSON.stringify(a.scope), a.status, a.lastSync, a.nextSync, a.mode, a.createdBy, a.createdAt, a.previousStatus || null],
  );
}
export async function pgDeleteAccount(id: string): Promise<void> {
  await dbQuery("DELETE FROM managed_accounts WHERE id = $1", [id]);
}
export async function pgListAccountAudit(): Promise<AuditEntry[]> {
  const { rows } = await dbQuery<Record<string, unknown>>('SELECT * FROM account_audit ORDER BY "when" DESC');
  return rows.map(rowToAudit);
}
export async function pgLogAccountAudit(e: AuditEntry): Promise<void> {
  await dbQuery(
    'INSERT INTO account_audit (id, "when", who, what, account_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
    [e.id, e.when, e.who, e.what, e.accountId || null],
  );
}
export async function pgResetAccountStore(): Promise<void> {
  await dbQuery("TRUNCATE managed_accounts, account_audit RESTART IDENTITY CASCADE");
}
