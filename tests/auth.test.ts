// Auth + RBAC tests: hashing/policy, sessions, roles matrix, lockout,
// demo flag, and last-Owner protection. Route-level 401/403 behaviour is
// covered by the production smoke test (see final report), not here,
// because route handlers need a running Next server.
import { beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS, changeUserRole, clearFailedAttempts, createSession, demoAuthEnabled,
  destroySession, getOrCreateDemoUser, hashPassword, isRateLimited, listUsers,
  originOk, rateLimitKey, recordFailedAttempt, registerUser, resetAuthStore,
  validateEmail, validatePassword, validateSession, verifyPassword,
} from "../src/lib/auth";
import { can, ROLES } from "../src/lib/permissions";

beforeEach(() => resetAuthStore());

describe("password hashing + policy", () => {
  it("hashes with a per-user salt: same password, different hashes, both verify", () => {
    const a = hashPassword("correct-horse-battery");
    const b = hashPassword("correct-horse-battery");
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct-horse-battery");
    expect(verifyPassword("correct-horse-battery", a)).toBe(true);
    expect(verifyPassword("correct-horse-battery", b)).toBe(true);
    expect(verifyPassword("wrong-password-123", a)).toBe(false);
    expect(verifyPassword("correct-horse-battery", "not-a-hash")).toBe(false);
  });
  it("policy: 12+ chars required, common/empty/repeated rejected", () => {
    expect(validatePassword("")).toBeTruthy();
    expect(validatePassword("short123")).toBeTruthy();
    expect(validatePassword("password123")).toBeTruthy();
    expect(validatePassword("aaaaaaaaaaaa")).toBeTruthy();
    expect(validatePassword("a-strong-enough-1")).toBeNull();
  });
  it("email is lowercased and validated", () => {
    expect(validateEmail("not-an-email")).toBeTruthy();
    expect(validateEmail("")).toBeTruthy();
    expect(validateEmail("User@Example.com")).toBeNull();
  });
});

describe("registration + sessions", () => {
  it("first user is Owner, later users are Viewer, duplicates rejected, no hash returned", () => {
    const owner = registerUser("Owner@Example.com", "Owner One", "a-strong-enough-1");
    expect(owner.role).toBe("Owner");
    expect(owner.email).toBe("owner@example.com");
    expect(Object.keys(owner)).not.toContain("passwordHash");
    const viewer = registerUser("viewer@example.com", "Viewer Two", "a-strong-enough-1");
    expect(viewer.role).toBe("Viewer");
    expect(() => registerUser("viewer@example.com", "Again", "a-strong-enough-1")).toThrow("already exists");
    expect(listUsers()).toHaveLength(2);
  });
  it("session validates, unknown/empty tokens do not, destroy invalidates", () => {
    const u = registerUser("a@example.com", "A", "a-strong-enough-1");
    const s = createSession(u.id);
    expect(SESSION_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(validateSession(s.token)?.id).toBe(u.id);
    expect(validateSession("nope")).toBeNull();
    expect(validateSession(undefined)).toBeNull();
    destroySession(s.token);
    expect(validateSession(s.token)).toBeNull();
  });
  it("last Owner cannot be demoted; promoting another Owner first allows it", () => {
    const owner = registerUser("owner@example.com", "Owner", "a-strong-enough-1");
    const viewer = registerUser("viewer@example.com", "Viewer", "a-strong-enough-1");
    expect(() => changeUserRole(owner.id, "Viewer")).toThrow("last Owner");
    changeUserRole(viewer.id, "Owner");
    expect(changeUserRole(owner.id, "Viewer").role).toBe("Viewer");
  });
  it("demo auth is off by default and always yields a Viewer", () => {
    delete process.env.LEDGER_DEMO_AUTH;
    expect(demoAuthEnabled()).toBe(false);
    process.env.LEDGER_DEMO_AUTH = "true";
    try {
      expect(demoAuthEnabled()).toBe(true);
      expect(getOrCreateDemoUser().role).toBe("Viewer");
    } finally { delete process.env.LEDGER_DEMO_AUTH; }
  });
});

describe("login rate limiting + origin check", () => {
  it("5 failures in 15 min lock the key; clearing resets it", () => {
    const key = rateLimitKey("a@example.com", "1.2.3.4");
    expect(isRateLimited(key)).toBe(false);
    for (let i = 0; i < 5; i++) recordFailedAttempt(key);
    expect(isRateLimited(key)).toBe(true);
    clearFailedAttempts(key);
    expect(isRateLimited(key)).toBe(false);
  });
  it("origin must match host when present; absent origin is allowed", () => {
    expect(originOk("https://ledger.example", "ledger.example")).toBe(true);
    expect(originOk("https://evil.example", "ledger.example")).toBe(false);
    expect(originOk(null, "ledger.example")).toBe(true);
  });
});

describe("RBAC matrix (Settings matrix, as code)", () => {
  it("every role is in the matrix and Viewer/Auditor cannot manage connections", () => {
    expect(ROLES).toEqual(["Owner", "Admin", "FinOps Manager", "Analyst", "Viewer", "Auditor"]);
    expect(can("Viewer", "manageConnections")).toBe(false);
    expect(can("Auditor", "manageConnections")).toBe(false);
    expect(can("Analyst", "manageConnections")).toBe(false);
    expect(can("Owner", "manageConnections")).toBe(true);
    expect(can("Admin", "manageConnections")).toBe(true);
    expect(can("FinOps Manager", "manageConnections")).toBe(true);
  });
  it("audit is Owner/Admin/Auditor only; members is Owner/Admin only", () => {
    expect(can("Auditor", "viewAudit")).toBe(true);
    expect(can("Owner", "viewAudit")).toBe(true);
    expect(can("Viewer", "viewAudit")).toBe(false);
    expect(can("FinOps Manager", "viewAudit")).toBe(false);
    expect(can("Owner", "manageMembers")).toBe(true);
    expect(can("Admin", "manageMembers")).toBe(true);
    expect(can("FinOps Manager", "manageMembers")).toBe(false);
  });
  it("any authenticated role can read data (Viewer scoped, others all-data)", () => {
    expect(can("Viewer", "viewAllData")).toBe(false);
    expect(can("Analyst", "viewAllData")).toBe(true);
    expect(can("Auditor", "viewAllData")).toBe(true);
  });
});
