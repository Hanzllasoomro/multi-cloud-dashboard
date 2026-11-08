// Ledger auth — orchestration (v1.6). Registration, sessions, login
// rate limiting, origin checks, cookies, demo access and role changes.
// The pieces live in sibling modules (password / totp / store / mfa /
// reset / api-keys); this file is the public surface that routes import,
// and src/lib/auth.ts re-exports it for backward compatibility.
import { randomBytes } from "node:crypto";
import type { Role } from "../permissions";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import {
  addSession, addUser, countOwners, deleteSession, deleteSessionsForUser, getSession, getStoredUserByEmail, getUserById,
  listSessionsForUser, listUsers, logAuthEvent, nextUserId, publicUser, touchSession, updateUser,
  type PublicSession, type PublicUser, type Session, type StoredUser,
} from "./store";

export * from "./password";
export * from "./totp";
export * from "./store";
export * from "./mfa";
export * from "./reset";
export * from "./api-keys";

export const SESSION_COOKIE = "ledger_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h absolute
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min

export type { PublicUser, PublicSession, Session, StoredUser };

export function validateEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  if (!v) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address.";
  return null;
}

export function registerUser(email: string, name: string, password: string): PublicUser {
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const pwErr = validatePassword(password);
  if (pwErr) throw new Error(pwErr);
  const norm = email.trim().toLowerCase();
  if (getStoredUserByEmail(norm)) throw new Error("An account with that email already exists.");
  // First registered user becomes Owner; every later registration defaults
  // to Viewer and is visible in Settings > Team members for an Owner/Admin
  // to promote. This is the bootstrap rule — there is no seeded admin.
  const role: Role = listUsers().length === 0 ? "Owner" : "Viewer";
  const user: StoredUser = {
    id: nextUserId(),
    email: norm, name: name.trim() || norm.split("@")[0], role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
  addUser(user);
  logAuthEvent("user_registered", { userId: user.id, email: user.email, detail: `Role: ${role}.` });
  return publicUser(user);
}

export interface SessionMeta { userAgent?: string; ip?: string }
export function createSession(userId: string, meta: SessionMeta = {}): Session {
  const now = Date.now();
  const s: Session = { token: randomBytes(32).toString("hex"), userId, createdAt: now, expiresAt: now + SESSION_TTL_MS, lastSeen: now, userAgent: meta.userAgent, ip: meta.ip };
  addSession(s);
  return s;
}
/** Returns the session's user, or null if the token is missing/expired/unknown. Expired sessions are deleted. */
export function validateSession(token: string | undefined | null): PublicUser | null {
  if (!token) return null;
  const s = getSession(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { deleteSession(token); return null; }
  touchSession(s);
  const u = getUserById(s.userId);
  return u ? publicUser(u) : null;
}
export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  deleteSession(token);
}

export function listUserSessions(userId: string, currentToken?: string): PublicSession[] {
  return listSessionsForUser(userId).map((s) => ({
    tokenPrefix: s.token.slice(0, 8), createdAt: s.createdAt, expiresAt: s.expiresAt, lastSeen: s.lastSeen,
    userAgent: s.userAgent, ip: s.ip, current: !!currentToken && s.token === currentToken,
  }));
}
/** Revoke one session by its full token. Returns false when the token
 *  does not belong to this user. */
export function revokeUserSession(userId: string, token: string): boolean {
  const s = getSession(token);
  if (!s || s.userId !== userId) return false;
  deleteSession(token);
  logAuthEvent("session_revoked", { userId, detail: "One session revoked." });
  return true;
}
export function revokeOtherSessions(userId: string, currentToken?: string): number {
  const n = deleteSessionsForUser(userId, currentToken);
  if (n) logAuthEvent("session_revoked", { userId, detail: `${n} other session(s) revoked.` });
  return n;
}

/** Demo access for hackathon judges. ONLY when LEDGER_DEMO_AUTH=true.
 *  The demo session is always a Viewer — never an Owner — and the UI says so. */
export function demoAuthEnabled(): boolean {
  return process.env.LEDGER_DEMO_AUTH === "true";
}
export function getOrCreateDemoUser(): PublicUser {
  let demo = getStoredUserByEmail("demo@ledger.demo");
  if (!demo) {
    const user: StoredUser = {
      id: "user-demo", email: "demo@ledger.demo", name: "Demo judge", role: "Viewer",
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    };
    addUser(user);
    demo = user;
  }
  return publicUser(demo);
}

// ---- login rate limiting (per email + IP, in-memory) ----
const failures = new Map<string, number[]>();
export function rateLimitKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip || "unknown"}`;
}
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const attempts = (failures.get(key) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  failures.set(key, attempts);
  return attempts.length >= LOGIN_MAX_FAILURES;
}
export function recordFailedAttempt(key: string): void {
  failures.set(key, [...(failures.get(key) || []), Date.now()]);
}
export function clearFailedAttempts(key: string): void { failures.delete(key); }

/** Origin check for auth POSTs: if an Origin header is present it must
 *  match the request Host, otherwise the request is rejected (CSRF defence
 *  on top of SameSite=Lax). Absent Origin is allowed — the cookie is
 *  httpOnly and session checks still apply. */
export function originOk(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function sessionCookieHeader(token: string, isProduction: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}
export function clearSessionCookieHeader(isProduction: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

/** Change a user's role. Throws on unknown user or on demoting the last Owner. */
export function changeUserRole(id: string, role: Role, actorId?: string): PublicUser {
  const u = getUserById(id);
  if (!u) throw new Error("User not found");
  if (u.role === "Owner" && role !== "Owner" && countOwners() <= 1) {
    throw new Error("Cannot demote the last Owner — promote another user to Owner first.");
  }
  const before = u.role;
  updateUser(id, { role });
  logAuthEvent("role_changed", { userId: id, email: u.email, detail: `${before} → ${role}.` });
  return publicUser({ ...u, role });
}

/** Set a new password for a user (used by reset + admin flows). Revokes all sessions. */
export function setUserPassword(userId: string, newPassword: string): void {
  const pwErr = validatePassword(newPassword);
  if (pwErr) throw new Error(pwErr);
  updateUser(userId, { passwordHash: hashPassword(newPassword) });
  deleteSessionsForUser(userId);
}
