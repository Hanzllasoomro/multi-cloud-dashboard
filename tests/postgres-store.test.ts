// Postgres store tests (v1.7): the pg store modules run against a fake
// pool, so the real SQL text and row mapping are exercised without a live
// database (none is available in this workspace). The live-database check
// is the Vercel smoke test in docs/VERCEL_DB_PROPOSAL.md — run it once
// msue provides DATABASE_URL. The dispatcher (file store) is covered by
// the 56 existing tests, which run with no DATABASE_URL set.
import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { setPoolForTests } from "../src/lib/db";
import {
  pgAddUser, pgGetStoredUserByEmail, pgGetUserById, pgCountOwners,
  pgAddSession, pgGetSession, pgListSessionsForUser,
  pgAddApiKey, pgFindApiKeyByHash,
  pgAddResetToken, pgFindResetToken,
  pgAddMfaChallenge, pgGetMfaChallenge,
  pgLogAuthEvent, pgListAuthEvents,
} from "../src/lib/auth/store-pg";
import { pgSeedIfEmpty, pgListAccounts, pgUpsertAccount } from "../src/lib/accounts-pg";
import type { StoredUser } from "../src/lib/auth/store";

interface FakeCall { text: string; params: unknown[] }
const calls: FakeCall[] = [];
const userRow = {
  id: "user-1", email: "pg@example.com", name: "PG User", role: "Owner",
  password_hash: "salt:hash", created_at: "2026-11-09 10:00 UTC",
  mfa_enabled: true, mfa_secret: "JBSWY3DPEHPK3PXP", mfa_pending_secret: null, backup_codes: ["abc"],
};
const sessionRow = {
  token: "tok1", user_id: "user-1", created_at: 1000, expires_at: 2000, last_seen: 1000,
  user_agent: "TestAgent", ip: "1.2.3.4",
};

function fakePool(): Pool {
  return {
    query: async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      if (text.includes("CREATE TABLE")) return { rows: [], rowCount: 0 };
      if (text.includes("FROM users WHERE id")) return { rows: [userRow], rowCount: 1 };
      if (text.includes("FROM users WHERE email")) return { rows: [userRow], rowCount: 1 };
      if (text.includes("COUNT(*)") && text.includes("role = 'Owner'")) return { rows: [{ count: "1" }], rowCount: 1 };
      if (text.includes("COUNT(*)") && text.includes("managed_accounts")) return { rows: [{ count: "0" }], rowCount: 1 };
      if (text.includes("FROM sessions WHERE token")) return { rows: [sessionRow], rowCount: 1 };
      if (text.includes("FROM sessions WHERE user_id")) return { rows: [sessionRow], rowCount: 1 };
      if (text.includes("FROM api_keys WHERE key_hash")) return { rows: [{ id: "key-1", user_id: "user-1", name: "k", prefix: "lk_abc", key_hash: "h", created_at: "2026-11-09 10:00 UTC", last_used_at: null, revoked_at: null }], rowCount: 1 };
      if (text.includes("FROM reset_tokens WHERE token_hash")) return { rows: [{ token_hash: "h", user_id: "user-1", email: "pg@example.com", created_at: 1, expires_at: 2, used: false }], rowCount: 1 };
      if (text.includes("FROM mfa_challenges WHERE token")) return { rows: [{ token: "ch1", user_id: "user-1", created_at: 1, expires_at: 2, failures: 0 }], rowCount: 1 };
      if (text.includes("FROM audit_events ORDER BY seq DESC")) return { rows: [{ id: "audit-1", at: "2026-11-09T10:00:00.000Z", user_id: "user-1", email: "pg@example.com", event: "login_success", detail: null, ip: null }], rowCount: 1 };
      if (text.includes("FROM managed_accounts ORDER BY")) return { rows: [{ id: "acc-aws", provider: "AWS", display_name: "AWS production (payer)", account_id: "123", billing_account: "123", scope: { providers: ["AWS"], accounts: ["prod-aws"], tags: [], teams: [] }, status: "Healthy", last_sync: "2026-10-26 02:10 UTC", next_sync: "2026-10-27 02:10 UTC", mode: "demo", created_by: "finops@acme.example", created_at: "2026-10-26 02:10 UTC", previous_status: null }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
}

beforeEach(() => {
  calls.length = 0;
  setPoolForTests(fakePool());
});

describe("postgres auth store (fake pool)", () => {
  it("schema SQL creates all seven tables", async () => {
    const { ensureSchema, getPool } = await import("../src/lib/db");
    await ensureSchema(getPool());
    const schema = calls.find((c) => c.text.includes("CREATE TABLE"))!.text;
    for (const t of ["users", "sessions", "api_keys", "reset_tokens", "mfa_challenges", "audit_events", "managed_accounts", "account_audit"]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
  });
  it("users: insert is parameterised and reads map snake_case to the store shape", async () => {
    const u: StoredUser = { id: "user-1", email: "pg@example.com", name: "PG User", role: "Owner", passwordHash: "salt:hash", createdAt: "2026-11-09 10:00 UTC", mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP", backupCodes: ["abc"] };
    await pgAddUser(u);
    const insert = calls.find((c) => c.text.startsWith("INSERT INTO users"))!;
    expect(insert.text).not.toContain("pg@example.com"); // values are parameters, never interpolated
    expect(insert.params).toContain("pg@example.com");
    const byId = await pgGetUserById("user-1");
    expect(byId?.email).toBe("pg@example.com");
    expect(byId?.mfaEnabled).toBe(true);
    expect(byId?.backupCodes).toEqual(["abc"]);
    expect((await pgGetStoredUserByEmail("PG@Example.com"))?.id).toBe("user-1");
    expect(await pgCountOwners()).toBe(1);
  });
  it("sessions, api keys, reset tokens and challenges round-trip through the mapping", async () => {
    await pgAddSession({ token: "tok1", userId: "user-1", createdAt: 1000, expiresAt: 2000, lastSeen: 1000, userAgent: "TestAgent", ip: "1.2.3.4" });
    expect((await pgGetSession("tok1"))?.userAgent).toBe("TestAgent");
    expect((await pgListSessionsForUser("user-1"))).toHaveLength(1);
    await pgAddApiKey({ id: "key-1", userId: "user-1", name: "k", prefix: "lk_abc", keyHash: "h", createdAt: "2026-11-09 10:00 UTC" });
    expect((await pgFindApiKeyByHash("h"))?.prefix).toBe("lk_abc");
    await pgAddResetToken({ tokenHash: "h", userId: "user-1", email: "pg@example.com", createdAt: 1, expiresAt: 2, used: false });
    expect((await pgFindResetToken("h"))?.used).toBe(false);
    await pgAddMfaChallenge({ token: "ch1", userId: "user-1", createdAt: 1, expiresAt: 2, failures: 0 });
    expect((await pgGetMfaChallenge("ch1"))?.failures).toBe(0);
  });
  it("audit log inserts and caps at 500, newest first", async () => {
    await pgLogAuthEvent("login_success", { userId: "user-1", email: "pg@example.com" });
    expect(calls.some((c) => c.text.includes("INSERT INTO audit_events"))).toBe(true);
    expect(calls.some((c) => c.text.includes("NOT IN (SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 500)"))).toBe(true);
    const events = await pgListAuthEvents();
    expect(events[0].event).toBe("login_success");
    expect(calls.some((c) => c.text.includes("ORDER BY seq DESC LIMIT $1"))).toBe(true);
  });
});

describe("postgres accounts store (fake pool)", () => {
  it("seeds the demo accounts when the table is empty and lists them mapped", async () => {
    const seed = [{ id: "acc-aws", provider: "AWS" as const, displayName: "AWS production (payer)", accountId: "123", billingAccount: "123", scope: { providers: ["AWS" as const], accounts: ["prod-aws"], tags: [], teams: [] }, status: "Healthy" as const, lastSync: "2026-10-26 02:10 UTC", nextSync: "2026-10-27 02:10 UTC", mode: "demo" as const, createdBy: "finops@acme.example", createdAt: "2026-10-26 02:10 UTC" }];
    await pgSeedIfEmpty(seed, []);
    expect(calls.some((c) => c.text.includes("INSERT INTO managed_accounts"))).toBe(true);
    const list = await pgListAccounts();
    expect(list[0].provider).toBe("AWS");
    expect(list[0].scope.accounts).toEqual(["prod-aws"]);
    await pgUpsertAccount(list[0]);
    expect(calls.some((c) => c.text.includes("ON CONFLICT (id) DO UPDATE"))).toBe(true);
  });
});
