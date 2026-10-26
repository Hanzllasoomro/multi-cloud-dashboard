// Connected-accounts tests: CRUD, checklist shape, paused exclusion, delete confirmation.
import { beforeEach, describe, expect, it } from "vitest";
import {
  createAccount, excludePausedRows, expandAccountIds, getAccount, listAccounts, listAudit,
  removeAccount, resetAccountStore, runTestChecklist, updateAccount,
} from "../src/lib/accounts";
import { allRows } from "../src/lib/data";
import { runQuery } from "../src/lib/query";

beforeEach(() => resetAccountStore());

describe("account seed + CRUD", () => {
  it("seeds the 3 demo providers, Azure degraded", () => {
    const a = listAccounts();
    expect(a.map((x) => x.provider).sort()).toEqual(["AWS", "Azure", "GCP"]);
    expect(a.find((x) => x.provider === "Azure")?.status).toBe("Degraded");
    expect(a.every((x) => x.displayName && x.accountId && x.billingAccount)).toBe(true);
  });
  it("add creates a Pending account and an audit entry; validation rejects bad input", () => {
    const before = listAudit().length;
    const acc = createAccount({ provider: "GCP", displayName: "GCP staging", accountId: "proj-staging-1", billingAccount: "proj-staging-1", scope: { accounts: ["staging-gcp"] } });
    expect(acc.status).toBe("Pending");
    expect(listAudit().length).toBeGreaterThan(before);
    expect(listAudit()[0].what).toContain("Account added");
    expect(() => createAccount({ provider: "GCP", displayName: " ", accountId: "x", billingAccount: "x" })).toThrow("displayName is required");
    expect(() => createAccount({ provider: "Oracle" as never, displayName: "x", accountId: "x", billingAccount: "x" })).toThrow("provider must be");
  });
  it("edit changes name + scope; pause stores previous status and resume restores it", () => {
    const edited = updateAccount("acc-gcp", { displayName: "GCP billing (renamed)", scope: { accounts: ["prod-gcp-project"], tags: ["team:platform"], teams: ["platform"] } });
    expect(edited.displayName).toBe("GCP billing (renamed)");
    expect(edited.scope.tags).toEqual(["team:platform"]);
    const paused = updateAccount("acc-azure", { status: "Paused" });
    expect(paused.status).toBe("Paused");
    const resumed = updateAccount("acc-azure", { status: "Healthy" });
    expect(resumed.status).toBe("Degraded"); // pre-pause status restored, not silently Healthy
  });
  it("remove requires the exact display name; correct confirmation removes and audits keep/purge", () => {
    expect(() => removeAccount("acc-gcp", "wrong name", "keep")).toThrow("does not match");
    expect(getAccount("acc-gcp")).toBeDefined();
    const removed = removeAccount("acc-gcp", "GCP billing export", "purge");
    expect(removed.id).toBe("acc-gcp");
    expect(getAccount("acc-gcp")).toBeUndefined();
    expect(listAudit()[0].what).toContain("data: purge");
  });
});

describe("test-connection checklist", () => {
  it("every item has permission, reason and status; failures carry a fix", () => {
    const r = runTestChecklist("acc-aws");
    expect(r.total).toBe(3);
    expect(r.checklist.every((c) => c.permission && c.reason && (c.status === "pass" || c.status === "fail"))).toBe(true);
    expect(r.checklist.filter((c) => c.status === "fail").every((c) => !!c.fix)).toBe(true);
    expect(r.passed).toBe(3);
    expect(r.account.status).toBe("Healthy");
  });
  it("seeded Azure demo checklist is 2/3 and stays Degraded", () => {
    const r = runTestChecklist("acc-azure");
    expect(r.passed).toBe(2);
    expect(r.account.status).toBe("Degraded");
  });
});

describe("paused accounts + account filter", () => {
  it("pausing AWS excludes exactly the AWS rows from query totals", () => {
    const rows = allRows();
    const before = runQuery(rows, { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-31", topN: 50 });
    const awsTotal = runQuery(rows.filter((r) => r.provider === "AWS"), { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-31", topN: 50 }).totals.cost;
    updateAccount("acc-aws", { status: "Paused" });
    const after = runQuery(excludePausedRows(rows), { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-31", topN: 50 });
    expect(Math.abs((before.totals.cost - after.totals.cost) - awsTotal)).toBeLessThan(1);
    expect(after.data.some((d) => d.key === "AWS")).toBe(false);
  });
  it("expandAccountIds maps a managed id to its covered sub-accounts", () => {
    expect(expandAccountIds(["acc-aws"]).sort()).toEqual(["prod-aws", "staging-aws"]);
    expect(expandAccountIds(["no-such-id"])).toEqual([]);
  });
});
