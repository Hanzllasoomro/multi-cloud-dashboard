// Ledger auth — password reset (v1.6).
// Token-based reset: a random token (sha256-hashed in the store, 1-hour
// expiry, single use) is created on request. Ledger has no email provider
// configured, so the token is returned to the requester in non-production
// runs (local/dev/demo) and must be wired to an email sender for
// production — see docs/SECURITY.md. The request response is always the
// same whether or not the email exists, so it cannot enumerate accounts.
// Confirming a reset sets the new password and revokes ALL sessions,
// so a stolen session cannot survive a reset.
import { createHash, randomBytes } from "node:crypto";
import { addResetToken, findResetToken, updateResetToken, getStoredUserByEmail, updateUser, deleteSessionsForUser, logAuthEvent } from "./store";
import { validatePassword, hashPassword } from "./password";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function requestPasswordReset(email: string, ip?: string): { token: string | null; expiresAt: number } {
  const norm = email.trim().toLowerCase();
  const user = norm ? getStoredUserByEmail(norm) : undefined;
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
  if (!user) {
    // Same shape, no token, no log with a user — cannot enumerate accounts.
    return { token: null, expiresAt };
  }
  const token = randomBytes(32).toString("hex");
  addResetToken({ tokenHash: hashResetToken(token), userId: user.id, email: user.email, createdAt: Date.now(), expiresAt, used: false });
  logAuthEvent("password_reset_requested", { userId: user.id, email: user.email, ip });
  return { token, expiresAt };
}

export function confirmPasswordReset(token: string, newPassword: string, ip?: string): void {
  const pwErr = validatePassword(newPassword);
  if (pwErr) throw new Error(pwErr);
  const rec = findResetToken(hashResetToken(token));
  if (!rec || rec.used || Date.now() > rec.expiresAt) {
    throw new Error("This reset link is invalid or has expired — request a new one.");
  }
  updateResetToken(rec.tokenHash, { used: true });
  updateUser(rec.userId, { passwordHash: hashPassword(newPassword) });
  deleteSessionsForUser(rec.userId);
  logAuthEvent("password_reset_completed", { userId: rec.userId, email: rec.email, detail: "All sessions were revoked.", ip });
}
