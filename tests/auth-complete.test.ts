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

beforeEach(() => resetAuthStore());
const PW = "a-strong-enough-1";

function user(email = "mfa@example.com") {
  return registerUser(email, "MFA User", PW);
}

describe("TOTP", () => {
  it("code verifies at the same instant, ±1 step for clock skew, wrong code fails", () => {
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
  it("setup is two-step: pending secret is not enforcement until confirmed", () => {
    const u = user();
    const { secret, otpauthUrl } = startMfaSetup(u.id);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(otpauthUrl).toContain("otpauth://totp/Ledger:");
    expect(mfaStatus(u.id).enabled).toBe(false);
    expect(() => confirmMfaSetup(u.id, "000000")).toThrow("Incorrect code");
    expect(mfaStatus(u.id).enabled).toBe(false);
    const { backupCodes } = confirmMfaSetup(u.id, totpCode(secret));
    expect(backupCodes).toHaveLength(8);
    expect(mfaStatus(u.id)).toEqual({ enabled: true, backupCodesRemaining: 8, pendingSetup: false });
    // backup codes are stored hashed, never plaintext
    expect(getStoredUserByEmail(u.email)!.backupCodes!.every((h) => !backupCodes.includes(h))).toBe(true);
  });
  it("challenge accepts a TOTP code, rejects a wrong one, and a backup code works once", () => {
    const u = user();
    const { secret } = startMfaSetup(u.id);
    const { backupCodes } = confirmMfaSetup(u.id, totpCode(secret));
    const ch = createMfaChallenge(u.id);
    expect(verifyMfaChallenge(ch, "000000")).toBeNull();
    expect(verifyMfaChallenge(ch, totpCode(secret))).toBe(u.id);
    expect(verifyMfaChallenge(ch, totpCode(secret))).toBeNull(); // consumed
    const ch2 = createMfaChallenge(u.id);
    expect(verifyMfaChallenge(ch2, backupCodes[0])).toBe(u.id);
    expect(mfaStatus(u.id).backupCodesRemaining).toBe(7);
    expect(verifyMfaChallenge(createMfaChallenge(u.id), backupCodes[0])).toBeNull(); // spent
  });
  it("disabling MFA needs the password; a wrong password keeps MFA on", () => {
    const u = user();
    const { secret } = startMfaSetup(u.id);
    confirmMfaSetup(u.id, totpCode(secret));
    expect(() => disableMfa(u.id, "wrong-password-123")).toThrow("Incorrect password");
    expect(mfaStatus(u.id).enabled).toBe(true);
    disableMfa(u.id, PW);
    expect(mfaStatus(u.id).enabled).toBe(false);
  });
});

describe("password reset", () => {
  it("request returns a token for a real user and nothing usable for an unknown email", () => {
    const u = user();
    const { token } = requestPasswordReset(u.email);
    expect(token).toBeTruthy();
    expect(requestPasswordReset("nobody@example.com").token).toBeNull();
    confirmPasswordReset(token!, "a-brand-new-pass-2");
    // token is single-use
    expect(() => confirmPasswordReset(token!, "another-new-pass-3")).toThrow("invalid or has expired");
    // old password no longer works, new one does (via stored hash check)
    const stored = getStoredUserByEmail(u.email)!;
    expect(verifyPassword("a-brand-new-pass-2", stored.passwordHash)).toBe(true);
    expect(verifyPassword(PW, stored.passwordHash)).toBe(false);
  });
  it("reset revokes all sessions", () => {
    const u = user();
    const s = createSession(u.id);
    expect(validateSession(s.token)?.id).toBe(u.id);
    const { token } = requestPasswordReset(u.email);
    confirmPasswordReset(token!, "a-brand-new-pass-2");
    expect(validateSession(s.token)).toBeNull();
  });
  it("a weak new password is rejected", () => {
    const u = user();
    const { token } = requestPasswordReset(u.email);
    expect(() => confirmPasswordReset(token!, "short")).toThrow("at least 12 characters");
  });
});

describe("API keys", () => {
  it("create returns the key once; validate works; revoke stops it immediately", () => {
    const u = user();
    const { key, record } = createApiKey(u.id, "reporting script");
    expect(key.startsWith("lk_")).toBe(true);
    expect(record.prefix).toBe(key.slice(0, 12));
    expect(validateApiKey(key)?.id).toBe(u.id);
    expect(validateApiKey("lk_nope")).toBeNull();
    expect(listApiKeys(u.id)).toHaveLength(1);
    expect(listApiKeys(u.id)[0].prefix).toBe(record.prefix);
    // the full key is never stored / listed
    expect(JSON.stringify(listApiKeys(u.id))).not.toContain(key);
    revokeApiKey(u.id, record.id);
    expect(validateApiKey(key)).toBeNull();
    expect(() => revokeApiKey(u.id, record.id)).toThrow("already revoked");
  });
});

describe("sessions + audit log", () => {
  it("sessions list, revoke one, revoke others", () => {
    const u = user();
    const s1 = createSession(u.id, { userAgent: "TestAgent/1", ip: "1.2.3.4" });
    const s2 = createSession(u.id, { userAgent: "Other/2" });
    const listed = listUserSessions(u.id, s1.token);
    expect(listed).toHaveLength(2);
    expect(listed.find((s) => s.current)).toBeTruthy();
    expect(revokeUserSession(u.id, s2.token)).toBe(true);
    expect(validateSession(s2.token)).toBeNull();
    expect(validateSession(s1.token)?.id).toBe(u.id);
    expect(revokeOtherSessions(u.id, s1.token)).toBe(0);
    const s3 = createSession(u.id);
    expect(revokeOtherSessions(u.id, s1.token)).toBe(1);
    expect(validateSession(s3.token)).toBeNull();
    expect(validateSession(s1.token)?.id).toBe(u.id);
  });
  it("auth events are recorded newest-first", () => {
    const u = user();
    const { secret } = startMfaSetup(u.id);
    confirmMfaSetup(u.id, totpCode(secret));
    const events = listAuthEvents();
    expect(events[0].event).toBe("mfa_enabled");
    expect(events.some((e) => e.event === "user_registered")).toBe(true);
  });
});
