// Ledger — authentication core (v1.3).
//
// IN-MEMORY STORE — READ THIS BEFORE PRODUCTION USE: users and sessions
// live in module-level variables in the server process. They reset on
// server restart and do not survive a multi-instance deployment. A real
// database replaces exactly this module later; the user/session shapes,
// the API routes, and the permission model do not change. Same warning
// style as the accounts store (src/lib/accounts.ts).
//
// Security properties implemented here (see docs/SECURITY.md):
// - Passwords are NEVER stored in plaintext and NEVER logged. They are
//   hashed with Node crypto.scrypt + a per-user random salt.
// - Sessions are random 256-bit tokens, stored server-side only; the
//   browser holds only an httpOnly, SameSite=Lax cookie (Secure in
//   production). A stolen cookie value alone reveals no password.
// - Sessions expire after 24h absolute (no sliding renewal in this
//   version, so a stolen session has a bounded lifetime).
// - Login is rate-limited: 5 failed attempts per email+IP in 15 minutes,
//   then 429. Successful login clears the counter.
// - Auth POSTs check Origin against Host when an Origin header is present.
// NOT implemented here (future work, documented, not faked): MFA/TOTP,
// email password reset, SSO/SCIM. Until email reset exists, password
// reset is via an admin (see /login copy and docs/SECURITY.md).

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Role } from "./permissions";

export const SESSION_COOKIE = "ledger_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h absolute
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min

export interface StoredUser {
  id: string; email: string; name: string; role: Role;
  passwordHash: string; createdAt: string;
}
export interface PublicUser { id: string; email: string; name: string; role: Role; createdAt: string }
export interface Session { token: string; userId: string; createdAt: number; expiresAt: number; lastSeen: number }

let users: StoredUser[] = [];
let sessions = new Map<string, Session>();
let userCounter = 0;
const failures = new Map<string, number[]>();

const COMMON_PASSWORDS = new Set([
  "password", "password123", "password1234", "123456", "12345678", "123456789",
  "1234567890", "qwerty", "qwerty123", "letmein", "letmein123", "admin123",
  "welcome123", "changeme", "changeme123", "ledger", "ledger123", "aaaaaaa",
]);

export function resetAuthStore(): void {
  users = []; sessions = new Map(); userCounter = 0; failures.clear();
}
export function publicUser(u: StoredUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}
export function listUsers(): PublicUser[] { return users.map(publicUser); }
export function getUserById(id: string): StoredUser | undefined { return users.find((u) => u.id === id); }
/** Server-only lookup for the login route. Never return this record to a
 *  client — it contains the password hash. No client component imports auth.ts. */
export function getStoredUserByEmail(email: string): StoredUser | undefined {
  return users.find((u) => u.email === email.trim().toLowerCase());
}
export function countOwners(): number { return users.filter((u) => u.role === "Owner").length; }

/** Lowercase + trim, then a plain shape check. No DNS/verification in this version. */
export function validateEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  if (!v) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address.";
  return null;
}

/** Policy: minimum 12 characters, not empty, not a common password, not
 *  a single repeated character. Returns an error string or null. */
export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common — choose a less guessable one.";
  if (/^(.)\1+$/.test(password)) return "That password is too weak — use a mix of characters.";
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return attempt.length === expected.length && timingSafeEqual(attempt, expected);
}

export function registerUser(email: string, name: string, password: string): PublicUser {
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const pwErr = validatePassword(password);
  if (pwErr) throw new Error(pwErr);
  const norm = email.trim().toLowerCase();
  if (users.some((u) => u.email === norm)) throw new Error("An account with that email already exists.");
  // First registered user becomes Owner; every later registration defaults
  // to Viewer and is visible in Settings > Team members for an Owner/Admin
  // to promote. This is the bootstrap rule — there is no seeded admin.
  const role: Role = users.length === 0 ? "Owner" : "Viewer";
  const user: StoredUser = {
    id: `user-${++userCounter}-${Date.now().toString(36)}`,
    email: norm, name: name.trim() || norm.split("@")[0], role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
  users.push(user);
  return publicUser(user);
}

export function createSession(userId: string): Session {
  const now = Date.now();
  const s: Session = { token: randomBytes(32).toString("hex"), userId, createdAt: now, expiresAt: now + SESSION_TTL_MS, lastSeen: now };
  sessions.set(s.token, s);
  return s;
}
/** Returns the session's user, or null if the token is missing/expired/unknown. Expired sessions are deleted. */
export function validateSession(token: string | undefined | null): PublicUser | null {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(token); return null; }
  s.lastSeen = Date.now();
  const u = getUserById(s.userId);
  return u ? publicUser(u) : null;
}
export function destroySession(token: string | undefined | null): void {
  if (token) sessions.delete(token);
}

/** Demo access for hackathon judges. ONLY when LEDGER_DEMO_AUTH=true.
 *  The demo session is always a Viewer — never an Owner — and the UI says so. */
export function demoAuthEnabled(): boolean {
  return process.env.LEDGER_DEMO_AUTH === "true";
}
export function getOrCreateDemoUser(): PublicUser {
  let demo = users.find((u) => u.email === "demo@ledger.demo");
  if (!demo) {
    demo = {
      id: `user-demo`, email: "demo@ledger.demo", name: "Demo judge", role: "Viewer",
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    };
    users.push(demo);
  }
  return publicUser(demo);
}

// ---- login rate limiting (per email + IP, in-memory, same caveat as above) ----
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
 *  on top of SameSite=Lax). Absent Origin (curl, same-origin fetch without
 *  one) is allowed — the cookie is httpOnly and session checks still apply. */
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
export function changeUserRole(id: string, role: Role): PublicUser {
  const u = getUserById(id);
  if (!u) throw new Error("User not found");
  if (u.role === "Owner" && role !== "Owner" && countOwners() <= 1) {
    throw new Error("Cannot demote the last Owner — promote another user to Owner first.");
  }
  u.role = role;
  return publicUser(u);
}
