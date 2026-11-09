// Auth v1.6 tests: TOTP MFA, backup codes, password reset, API keys,
// session management and the auth audit log. All pure-lib (no server).
import { beforeEach, describe, expect, it } from "vitest";
import {
  confirmMfaSetup, confirmPasswordReset, createApiKey, createMfaChallenge, createSession,
  disableMfa, getStoredUserByEmail, listApiKeys, listAuthEvents, listUserSessions,
  mfaStatus, registerUser, requestPasswordReset, resetAuthStore, revokeApiKey,
  revokeOtherSessions, revokeUserSession, startMfaSetup, totpCode, validateApiKey,
  validateSession, verifyMfaChallenge, verifyPassword, verifyTotp,
} from "../src/lib/auth";

beforeEach(async () => { await resetAuthStore(); });
const PW = "a-strong-enough-1";

async function user(email = "mfa@example.com") {
  return registerUser(email, "MFA User", PW);
}

describe("TOTP", () => {
  it("code verifies at the same instant, ±1 step for clock skew, wrong code fails", async () => {
    const secret = "JBSWY3DPEHPK3PXP"; // "Hello!" in base32
    const now = 1700000000000;
    const code = totpCode(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, now)).toBe(true);
    expect(verifyTotp(secret, code, now + 30000)).toBe(true);
    expect(verifyTotp(secret, code, now - 30000)).toBe(true);
    expect(verifyTotp(secret, "000000", now)).toBe(false);
    expect(verifyTotp(secret, code, now + 90000)).toBe(false);
  });
});

describe("MFA setup / challenge / backup codes", () => {
  it("setup is two-step: pending secret is not enforcement until confirmed", async () => {
    const u = await user();
    const { secret, otpauthUrl } = await startMfaSetup(u.id);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(otpauthUrl).toContain("otpauth://totp/Ledger:");
    expect((await mfaStatus(u.id)).enabled).toBe(false);
    await expect(confirmMfaSetup(u.id, "000000")).rejects.toThrow("Incorrect code");
    expect((await mfaStatus(u.id)).enabled).toBe(false);
    const { backupCodes } = await confirmMfaSetup(u.id, totpCode(secret));
    expect(backupCodes).toHaveLength(8);
    expect(await mfaStatus(u.id)).toEqual({ enabled: true, backupCodesRemaining: 8, pendingSetup: false });
    // backup codes are stored hashed, never plaintext
    expect((await getStoredUserByEmail(u.email))!.backupCodes!.every((h) => !backupCodes.includes(h))).toBe(true);
  });
  it("challenge accepts a TOTP code, rejects a wrong one, and a backup code works once", async () => {
    const u = await user();
    const { secret } = await startMfaSetup(u.id);
    const { backupCodes } = await confirmMfaSetup(u.id, totpCode(secret));
    const ch = await createMfaChallenge(u.id);
    expect(await verifyMfaChallenge(ch, "000000")).toBeNull();
    expect(await verifyMfaChallenge(ch, totpCode(secret))).toBe(u.id);
    expect(await verifyMfaChallenge(ch, totpCode(secret))).toBeNull(); // consumed
    const ch2 = await createMfaChallenge(u.id);
    expect(await verifyMfaChallenge(ch2, backupCodes[0])).toBe(u.id);
    expect((await mfaStatus(u.id)).backupCodesRemaining).toBe(7);
    expect(await verifyMfaChallenge(await createMfaChallenge(u.id), backupCodes[0])).toBeNull(); // spent
  });
  it("disabling MFA needs the password; a wrong password keeps MFA on", async () => {
    const u = await user();
    const { secret } = await startMfaSetup(u.id);
    await confirmMfaSetup(u.id, totpCode(secret));
    await expect(disableMfa(u.id, "wrong-password-123")).rejects.toThrow("Incorrect password");
    expect((await mfaStatus(u.id)).enabled).toBe(true);
    await disableMfa(u.id, PW);
    expect((await mfaStatus(u.id)).enabled).toBe(false);
  });
});

describe("password reset", () => {
  it("request returns a token for a real user and nothing usable for an unknown email", async () => {
    const u = await user();
    const { token } = await requestPasswordReset(u.email);
    expect(token).toBeTruthy();
    expect((await requestPasswordReset("nobody@example.com")).token).toBeNull();
    await confirmPasswordReset(token!, "a-brand-new-pass-2");
    // token is single-use
    await expect(confirmPasswordReset(token!, "another-new-pass-3")).rejects.toThrow("invalid or has expired");
    // old password no longer works, new one does (via stored hash check)
    const stored = (await getStoredUserByEmail(u.email))!;
    expect(verifyPassword("a-brand-new-pass-2", stored.passwordHash)).toBe(true);
    expect(verifyPassword(PW, stored.passwordHash)).toBe(false);
  });
  it("reset revokes all sessions", async () => {
    const u = await user();
    const s = await createSession(u.id);
    expect((await validateSession(s.token))?.id).toBe(u.id);
    const { token } = await requestPasswordReset(u.email);
    await confirmPasswordReset(token!, "a-brand-new-pass-2");
    expect(await validateSession(s.token)).toBeNull();
  });
  it("a weak new password is rejected", async () => {
    const u = await user();
    const { token } = await requestPasswordReset(u.email);
    await expect(confirmPasswordReset(token!, "short")).rejects.toThrow("at least 12 characters");
  });
});

describe("API keys", () => {
  it("create returns the key once; validate works; revoke stops it immediately", async () => {
    const u = await user();
    const { key, record } = await createApiKey(u.id, "reporting script");
    expect(key.startsWith("lk_")).toBe(true);
    expect(record.prefix).toBe(key.slice(0, 12));
    expect((await validateApiKey(key))?.id).toBe(u.id);
    expect(await validateApiKey("lk_nope")).toBeNull();
    expect(await listApiKeys(u.id)).toHaveLength(1);
    expect((await listApiKeys(u.id))[0].prefix).toBe(record.prefix);
    // the full key is never stored / listed
    expect(JSON.stringify(await listApiKeys(u.id))).not.toContain(key);
    await revokeApiKey(u.id, record.id);
    expect(await validateApiKey(key)).toBeNull();
    await expect(revokeApiKey(u.id, record.id)).rejects.toThrow("already revoked");
  });
});

describe("sessions + audit log", () => {
  it("sessions list, revoke one, revoke others", async () => {
    const u = await user();
    const s1 = await createSession(u.id, { userAgent: "TestAgent/1", ip: "1.2.3.4" });
    const s2 = await createSession(u.id, { userAgent: "Other/2" });
    const listed = await listUserSessions(u.id, s1.token);
    expect(listed).toHaveLength(2);
    expect(listed.find((s) => s.current)).toBeTruthy();
    expect(await revokeUserSession(u.id, s2.token)).toBe(true);
    expect(await validateSession(s2.token)).toBeNull();
    expect((await validateSession(s1.token))?.id).toBe(u.id);
    expect(await revokeOtherSessions(u.id, s1.token)).toBe(0);
    const s3 = await createSession(u.id);
    expect(await revokeOtherSessions(u.id, s1.token)).toBe(1);
    expect(await validateSession(s3.token)).toBeNull();
    expect((await validateSession(s1.token))?.id).toBe(u.id);
  });
  it("auth events are recorded newest-first", async () => {
    const u = await user();
    const { secret } = await startMfaSetup(u.id);
    await confirmMfaSetup(u.id, totpCode(secret));
    const events = await listAuthEvents();
    expect(events[0].event).toBe("mfa_enabled");
    expect(events.some((e) => e.event === "user_registered")).toBe(true);
  });
});
