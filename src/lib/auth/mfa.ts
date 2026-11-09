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

export async function mfaStatus(userId: string): Promise<{ enabled: boolean; backupCodesRemaining: number; pendingSetup: boolean }> {
  const u = await getUserById(userId);
  return { enabled: !!u?.mfaEnabled, backupCodesRemaining: u?.backupCodes?.length || 0, pendingSetup: !!u?.mfaPendingSecret };
}

export async function startMfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
  const u = await getUserById(userId);
  if (!u) throw new Error("User not found");
  if (u.mfaEnabled) throw new Error("MFA is already enabled — disable it first to set up a new authenticator.");
  const secret = generateTotpSecret();
  await updateUser(userId, { mfaPendingSecret: secret });
  return { secret, otpauthUrl: otpauthUrl(secret, u.email) };
}

export async function confirmMfaSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
  const u = await getUserById(userId);
  if (!u) throw new Error("User not found");
  if (!u.mfaPendingSecret) throw new Error("No MFA setup in progress — start setup first.");
  if (!verifyTotp(u.mfaPendingSecret, code)) {
    await logAuthEvent("mfa_setup_failed", { userId, email: u.email, detail: "Incorrect code during MFA setup." });
    throw new Error("Incorrect code — check your authenticator app and try again.");
  }
  const { plain, hashes } = generateBackupCodes();
  await updateUser(userId, { mfaEnabled: true, mfaSecret: u.mfaPendingSecret, mfaPendingSecret: undefined, backupCodes: hashes });
  await logAuthEvent("mfa_enabled", { userId, email: u.email });
  return { backupCodes: plain };
}

export async function disableMfa(userId: string, password: string): Promise<void> {
  const u = await getUserById(userId);
  if (!u) throw new Error("User not found");
  if (!verifyPassword(password, u.passwordHash)) throw new Error("Incorrect password.");
  await updateUser(userId, { mfaEnabled: false, mfaSecret: undefined, mfaPendingSecret: undefined, backupCodes: [] });
  await logAuthEvent("mfa_disabled", { userId, email: u.email });
}

export async function createMfaChallenge(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await addMfaChallenge({ token, userId, createdAt: Date.now(), expiresAt: Date.now() + MFA_CHALLENGE_TTL_MS, failures: 0 });
  return token;
}

/** Verify a challenge with a TOTP code or a backup code. Returns the
 *  user id on success, null on a wrong code (challenge stays alive
 *  until 5 failures or expiry). Consumes backup codes on use. */
export async function verifyMfaChallenge(token: string, code: string): Promise<string | null> {
  const c = await getMfaChallenge(token);
  if (!c) return null;
  if (Date.now() > c.expiresAt) { await removeMfaChallenge(token); return null; }
  if (c.failures >= MFA_MAX_FAILURES) { await removeMfaChallenge(token); return null; }
  const u = await getUserById(c.userId);
  if (!u || !u.mfaEnabled || !u.mfaSecret) { await removeMfaChallenge(token); return null; }
  const clean = code.replace(/[\s-]/g, "");
  if (verifyTotp(u.mfaSecret, clean)) {
    await removeMfaChallenge(token);
    return u.id;
  }
  const hash = hashBackupCode(clean);
  const idx = (u.backupCodes || []).indexOf(hash);
  if (idx >= 0) {
    const remaining = [...(u.backupCodes || [])];
    remaining.splice(idx, 1);
    await updateUser(u.id, { backupCodes: remaining });
    await logAuthEvent("mfa_backup_code_used", { userId: u.id, email: u.email, detail: `${remaining.length} backup codes remaining.` });
    await removeMfaChallenge(token);
    return u.id;
  }
  await updateMfaChallenge(token, { failures: c.failures + 1 });
  await logAuthEvent("mfa_failed", { userId: u.id, email: u.email, detail: `Failed MFA attempt ${c.failures + 1} of ${MFA_MAX_FAILURES}.` });
  return null;
}
