// Ledger auth — TOTP MFA flows (v1.6).
// Setup is two-step: start (stores a *pending* secret, returns it once
// with the otpauth:// URL) then confirm (a correct code activates it and
// returns backup codes once). Until confirm, MFA is not enforced.
// Login with MFA enabled returns a short-lived challenge token (5 min,
// max 5 attempts); the challenge is completed with a TOTP code or a
// one-time backup code. Disabling MFA requires the account password.
import { randomBytes } from "node:crypto";
import { getUserById, updateUser, addMfaChallenge, getMfaChallenge, removeMfaChallenge, updateMfaChallenge, logAuthEvent } from "./store";
import { generateBackupCodes, generateTotpSecret, hashBackupCode, otpauthUrl, verifyTotp } from "./totp";
import { verifyPassword } from "./password";

export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MFA_MAX_FAILURES = 5;

export function mfaStatus(userId: string): { enabled: boolean; backupCodesRemaining: number; pendingSetup: boolean } {
  const u = getUserById(userId);
  return { enabled: !!u?.mfaEnabled, backupCodesRemaining: u?.backupCodes?.length || 0, pendingSetup: !!u?.mfaPendingSecret };
}

export function startMfaSetup(userId: string): { secret: string; otpauthUrl: string } {
  const u = getUserById(userId);
  if (!u) throw new Error("User not found");
  if (u.mfaEnabled) throw new Error("MFA is already enabled — disable it first to set up a new authenticator.");
  const secret = generateTotpSecret();
  updateUser(userId, { mfaPendingSecret: secret });
  return { secret, otpauthUrl: otpauthUrl(secret, u.email) };
}

export function confirmMfaSetup(userId: string, code: string): { backupCodes: string[] } {
  const u = getUserById(userId);
  if (!u) throw new Error("User not found");
  if (!u.mfaPendingSecret) throw new Error("No MFA setup in progress — start setup first.");
  if (!verifyTotp(u.mfaPendingSecret, code)) {
    logAuthEvent("mfa_setup_failed", { userId, email: u.email, detail: "Incorrect code during MFA setup." });
    throw new Error("Incorrect code — check your authenticator app and try again.");
  }
  const { plain, hashes } = generateBackupCodes();
  updateUser(userId, { mfaEnabled: true, mfaSecret: u.mfaPendingSecret, mfaPendingSecret: undefined, backupCodes: hashes });
  logAuthEvent("mfa_enabled", { userId, email: u.email });
  return { backupCodes: plain };
}

export function disableMfa(userId: string, password: string): void {
  const u = getUserById(userId);
  if (!u) throw new Error("User not found");
  if (!verifyPassword(password, u.passwordHash)) throw new Error("Incorrect password.");
  updateUser(userId, { mfaEnabled: false, mfaSecret: undefined, mfaPendingSecret: undefined, backupCodes: [] });
  logAuthEvent("mfa_disabled", { userId, email: u.email });
}

export function createMfaChallenge(userId: string): string {
  const token = randomBytes(32).toString("hex");
  addMfaChallenge({ token, userId, createdAt: Date.now(), expiresAt: Date.now() + MFA_CHALLENGE_TTL_MS, failures: 0 });
  return token;
}

/** Verify a challenge with a TOTP code or a backup code. Returns the
 *  user id on success, null on a wrong code (challenge stays alive
 *  until 5 failures or expiry). Consumes backup codes on use. */
export function verifyMfaChallenge(token: string, code: string): string | null {
  const c = getMfaChallenge(token);
  if (!c) return null;
  if (Date.now() > c.expiresAt) { removeMfaChallenge(token); return null; }
  if (c.failures >= MFA_MAX_FAILURES) { removeMfaChallenge(token); return null; }
  const u = getUserById(c.userId);
  if (!u || !u.mfaEnabled || !u.mfaSecret) { removeMfaChallenge(token); return null; }
  const clean = code.replace(/[\s-]/g, "");
  if (verifyTotp(u.mfaSecret, clean)) {
    removeMfaChallenge(token);
    return u.id;
  }
  const hash = hashBackupCode(clean);
  const idx = (u.backupCodes || []).indexOf(hash);
  if (idx >= 0) {
    const remaining = [...(u.backupCodes || [])];
    remaining.splice(idx, 1);
    updateUser(u.id, { backupCodes: remaining });
    logAuthEvent("mfa_backup_code_used", { userId: u.id, email: u.email, detail: `${remaining.length} backup codes remaining.` });
    removeMfaChallenge(token);
    return u.id;
  }
  updateMfaChallenge(token, { failures: c.failures + 1 });
  logAuthEvent("mfa_failed", { userId: u.id, email: u.email, detail: `Failed MFA attempt ${c.failures + 1} of ${MFA_MAX_FAILURES}.` });
  return null;
}
