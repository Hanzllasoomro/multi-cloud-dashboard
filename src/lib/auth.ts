// Ledger — authentication core (v1.3.1).
//
// FILE-BACKED STORE (local dev / single-server use) — READ THIS BEFORE
// PRODUCTION USE: users and sessions are persisted to a JSON file
// (default `.ledger-data/auth.json` in the project root, overridable via
// LEDGER_AUTH_FILE) because the previous pure in-memory store did NOT
// survive Next.js dev-server recompiles, restarts, or a second server
// process: a user registered on one dev-server instance was invisible to
// the next request handled by another instance, so login returned 401
// for a just-created account. Every read loads from disk first and every
// mutation saves atomically (tmp file + rename), so all instances that
// share the file see the same users and sessions. Only scrypt hashes
// and session tokens are stored — never plaintext passwords. A real
// database still replaces exactly this module for production; the
// user/session shapes, the API routes, and the permission model do not
// change. The accounts store (src/lib/accounts.ts) is still in-memory.
// Persistence is DISABLED when NODE_ENV=test or VITEST is set, so the
// Vitest suite stays hermetic (see persistenceEnabled()).
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
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

// ---- file-backed persistence (see header) ----
export function persistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && !process.env.VITEST;
}
export function authFilePath(): string {
  const raw = process.env.LEDGER_AUTH_FILE;
  return raw ? resolve(process.cwd(), raw) : resolve(process.cwd(), ".ledger-data", "auth.json");
}
interface AuthFileData { users: StoredUser[]; sessions: Session[]; userCounter: number }
function loadFromDisk(): void {
  if (!persistenceEnabled()) return;
  const file = authFilePath();
  if (!existsSync(file)) return;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as Partial<AuthFileData>;
    if (!Array.isArray(data.users) || !Array.isArray(data.sessions)) throw new Error("bad shape");
    users = data.users;
    sessions = new Map(data.sessions.filter((s) => s && typeof s.token === "string").map((s) => [s.token, s]));
    userCounter = typeof data.userCounter === "number" ? data.userCounter : users.length;
  } catch {
    // A corrupt file must never brick auth or silently wipe data: quarantine
    // it (so it can be inspected) and start from an empty store. The next
    // successful registration then rebuilds the file from scratch.
    try { renameSync(file, `${file}.corrupt-${Date.now()}`); } catch { /* ignore */ }
    users = []; sessions = new Map(); userCounter = 0;
  }
}
function saveToDisk(): void {
  if (!persistenceEnabled()) return;
  try {
    const file = authFilePath();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ users, sessions: [...sessions.values()], userCounter } satisfies AuthFileData), "utf8");
    try { chmodSync(tmp, 0o600); } catch { /* Windows: chmod is a no-op */ }
    renameSync(tmp, file);
    try { chmodSync(file, 0o600); } catch { /* Windows: chmod is a no-op */ }
  } catch {
    // Persistence failure must not fail the request that already succeeded
    // in memory; the in-memory state is still correct for this process.
    // (In dev, a second instance would not see it — same as the old bug —
    // so a failed save is worth checking the server log for, but the
    // request itself should not 500 on a disk problem.)
  }
}

const COMMON_PASSWORDS = new Set([
  "password", "password123", "password1234", "123456", "12345678", "123456789",
  "1234567890", "qwerty", "qwerty123", "letmein", "letmein123", "admin123",
  "welcome123", "changeme", "changeme123", "ledger", "ledger123", "aaaaaaa",
]);

export function resetAuthStore(): void {
  users = []; sessions = new Map(); userCounter = 0; failures.clear();
  // In tests persistence is disabled, so this is a no-op there. Outside
  // tests, reset also wipes the file, or a "reset" store would resurrect
  // on the next loadFromDisk().
  if (persistenceEnabled()) { try { rmSync(authFilePath(), { force: true }); } catch { /* ignore */ } }
}
export function publicUser(u: StoredUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}
export function listUsers(): PublicUser[] { loadFromDisk(); return users.map(publicUser); }
export function getUserById(id: string): StoredUser | undefined { loadFromDisk(); return users.find((u) => u.id === id); }
/** Server-only lookup for the login route. Never return this record to a
 *  client — it contains the password hash. No client component imports auth.ts. */
export function getStoredUserByEmail(email: string): StoredUser | undefined {
  loadFromDisk();
  return users.find((u) => u.email === email.trim().toLowerCase());
}
export function countOwners(): number { loadFromDisk(); return users.filter((u) => u.role === "Owner").length; }

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
  loadFromDisk();
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
  saveToDisk();
  return publicUser(user);
}

export function createSession(userId: string): Session {
  loadFromDisk();
  const now = Date.now();
  const s: Session = { token: randomBytes(32).toString("hex"), userId, createdAt: now, expiresAt: now + SESSION_TTL_MS, lastSeen: now };
  sessions.set(s.token, s);
  saveToDisk();
  return s;
}
/** Returns the session's user, or null if the token is missing/expired/unknown. Expired sessions are deleted. */
export function validateSession(token: string | undefined | null): PublicUser | null {
  if (!token) return null;
  loadFromDisk();
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(token); saveToDisk(); return null; }
  // lastSeen is in-memory only (not saved): expiry is absolute, so a
  // stale lastSeen on disk is harmless, and saving on every /me request
  // would rewrite the file on every page load.
  s.lastSeen = Date.now();
  const u = users.find((x) => x.id === s.userId);
  return u ? publicUser(u) : null;
}
export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  loadFromDisk();
  if (sessions.delete(token)) saveToDisk();
}

/** Demo access for hackathon judges. ONLY when LEDGER_DEMO_AUTH=true.
 *  The demo session is always a Viewer — never an Owner — and the UI says so. */
export function demoAuthEnabled(): boolean {
  return process.env.LEDGER_DEMO_AUTH === "true";
}
export function getOrCreateDemoUser(): PublicUser {
  loadFromDisk();
  let demo = users.find((u) => u.email === "demo@ledger.demo");
  if (!demo) {
    demo = {
      id: `user-demo`, email: "demo@ledger.demo", name: "Demo judge", role: "Viewer",
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    };
    users.push(demo);
    saveToDisk();
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
  loadFromDisk();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error("User not found");
  if (u.role === "Owner" && role !== "Owner" && users.filter((x) => x.role === "Owner").length <= 1) {
    throw new Error("Cannot demote the last Owner — promote another user to Owner first.");
  }
  u.role = role;
  saveToDisk();
  return publicUser(u);
}
