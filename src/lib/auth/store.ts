// Ledger auth — file-backed store (v1.6).
// Single-server store: users, sessions, API keys, reset tokens, MFA
// challenges and the auth audit log, in one JSON file (default
// `.ledger-data/auth.json`, overridable via LEDGER_AUTH_FILE). Atomic
// tmp+rename saves, 0600 permissions, corrupt-file quarantine. A real
// database replaces exactly this module for production; the shapes,
// routes and permission model do not change. Persistence is disabled
// under Vitest (NODE_ENV=test / VITEST) so tests stay hermetic.
// Only hashes/tokens are stored — never plaintext passwords. TOTP
// secrets ARE stored reversibly (verification needs them); the file
// is 0600 and gitignored, and secrets are never returned by an API
// after the one-time setup response.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Role } from "../permissions";

export interface StoredUser {
  id: string; email: string; name: string; role: Role;
  passwordHash: string; createdAt: string;
  mfaEnabled?: boolean; mfaSecret?: string; mfaPendingSecret?: string;
  backupCodes?: string[]; // sha256 hashes, one-time use
}
export interface PublicUser { id: string; email: string; name: string; role: Role; createdAt: string; mfaEnabled?: boolean }
export interface Session {
  token: string; userId: string; createdAt: number; expiresAt: number; lastSeen: number;
  userAgent?: string; ip?: string;
}
export interface PublicSession {
  tokenPrefix: string; createdAt: number; expiresAt: number; lastSeen: number;
  userAgent?: string; ip?: string; current: boolean;
}
export interface ApiKeyRecord {
  id: string; userId: string; name: string; prefix: string; keyHash: string;
  createdAt: string; lastUsedAt?: string; revokedAt?: string;
}
export interface PublicApiKey {
  id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string; revokedAt?: string;
}
export interface ResetTokenRecord { tokenHash: string; userId: string; email: string; createdAt: number; expiresAt: number; used: boolean }
export interface MfaChallenge { token: string; userId: string; createdAt: number; expiresAt: number; failures: number }
export interface AuthAuditEvent { id: string; at: string; userId?: string; email?: string; event: string; detail?: string; ip?: string }

export interface AuthFileData {
  version: number; users: StoredUser[]; sessions: Session[]; userCounter: number;
  apiKeys: ApiKeyRecord[]; resetTokens: ResetTokenRecord[]; mfaChallenges: MfaChallenge[]; auditEvents: AuthAuditEvent[];
}

export function persistenceEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && !process.env.VITEST;
}
export function authFilePath(): string {
  const raw = process.env.LEDGER_AUTH_FILE;
  return raw ? resolve(process.cwd(), raw) : resolve(process.cwd(), ".ledger-data", "auth.json");
}

let users: StoredUser[] = [];
let sessions = new Map<string, Session>();
let userCounter = 0;
let apiKeys: ApiKeyRecord[] = [];
let resetTokens: ResetTokenRecord[] = [];
let mfaChallenges: MfaChallenge[] = [];
let auditEvents: AuthAuditEvent[] = [];
let auditCounter = 0;

function emptyState(): AuthFileData {
  return { version: 1, users: [], sessions: [], userCounter: 0, apiKeys: [], resetTokens: [], mfaChallenges: [], auditEvents: [] };
}
export function loadFromDisk(): void {
  if (!persistenceEnabled()) return;
  const file = authFilePath();
  if (!existsSync(file)) return;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as Partial<AuthFileData>;
    if (!Array.isArray(data.users) || !Array.isArray(data.sessions)) throw new Error("bad shape");
    users = data.users;
    sessions = new Map(data.sessions.filter((s) => s && typeof s.token === "string").map((s) => [s.token, s]));
    userCounter = typeof data.userCounter === "number" ? data.userCounter : users.length;
    apiKeys = Array.isArray(data.apiKeys) ? data.apiKeys : [];
    resetTokens = Array.isArray(data.resetTokens) ? data.resetTokens : [];
    mfaChallenges = Array.isArray(data.mfaChallenges) ? data.mfaChallenges : [];
    auditEvents = Array.isArray(data.auditEvents) ? data.auditEvents : [];
  } catch {
    try { renameSync(file, `${file}.corrupt-${Date.now()}`); } catch { /* ignore */ }
    const e = emptyState();
    users = e.users; sessions = new Map(); userCounter = 0; apiKeys = []; resetTokens = []; mfaChallenges = []; auditEvents = [];
  }
}
export function saveToDisk(): void {
  if (!persistenceEnabled()) return;
  try {
    const file = authFilePath();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    const data: AuthFileData = { version: 1, users, sessions: [...sessions.values()], userCounter, apiKeys, resetTokens, mfaChallenges, auditEvents };
    writeFileSync(tmp, JSON.stringify(data), "utf8");
    try { chmodSync(tmp, 0o600); } catch { /* Windows: chmod is a no-op */ }
    renameSync(tmp, file);
    try { chmodSync(file, 0o600); } catch { /* Windows: chmod is a no-op */ }
  } catch { /* persistence failure must not fail the request itself */ }
}

export function resetAuthStore(): void {
  users = []; sessions = new Map(); userCounter = 0; apiKeys = []; resetTokens = []; mfaChallenges = []; auditEvents = []; auditCounter = 0;
  if (persistenceEnabled()) { try { rmSync(authFilePath(), { force: true }); } catch { /* ignore */ } }
}

// ---- users ----
export function publicUser(u: StoredUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, mfaEnabled: !!u.mfaEnabled };
}
export function listUsers(): PublicUser[] { loadFromDisk(); return users.map(publicUser); }
export function getUserById(id: string): StoredUser | undefined { loadFromDisk(); return users.find((u) => u.id === id); }
export function getStoredUserByEmail(email: string): StoredUser | undefined {
  loadFromDisk();
  return users.find((u) => u.email === email.trim().toLowerCase());
}
export function countOwners(): number { loadFromDisk(); return users.filter((u) => u.role === "Owner").length; }
export function nextUserId(): string { return `user-${++userCounter}-${Date.now().toString(36)}`; }
export function addUser(u: StoredUser): void { loadFromDisk(); users.push(u); saveToDisk(); }
export function updateUser(id: string, patch: Partial<StoredUser>): StoredUser | undefined {
  loadFromDisk();
  const u = users.find((x) => x.id === id);
  if (!u) return undefined;
  Object.assign(u, patch);
  saveToDisk();
  return u;
}

// ---- sessions ----
export function addSession(s: Session): void { loadFromDisk(); sessions.set(s.token, s); saveToDisk(); }
export function getSession(token: string): Session | undefined { loadFromDisk(); return sessions.get(token); }
export function deleteSession(token: string): boolean { loadFromDisk(); const ok = sessions.delete(token); if (ok) saveToDisk(); return ok; }
export function listSessionsForUser(userId: string): Session[] {
  loadFromDisk();
  return [...sessions.values()].filter((s) => s.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}
export function deleteSessionsForUser(userId: string, exceptToken?: string): number {
  loadFromDisk();
  let n = 0;
  for (const [t, s] of [...sessions.entries()]) {
    if (s.userId === userId && t !== exceptToken) { sessions.delete(t); n++; }
  }
  if (n) saveToDisk();
  return n;
}
export function touchSession(s: Session): void { s.lastSeen = Date.now(); /* in-memory only; expiry is absolute */ }

// ---- API keys ----
export function addApiKey(k: ApiKeyRecord): void { loadFromDisk(); apiKeys.push(k); saveToDisk(); }
export function listApiKeysForUser(userId: string): ApiKeyRecord[] { loadFromDisk(); return apiKeys.filter((k) => k.userId === userId); }
export function findApiKeyByHash(hash: string): ApiKeyRecord | undefined { loadFromDisk(); return apiKeys.find((k) => k.keyHash === hash && !k.revokedAt); }
export function updateApiKey(id: string, patch: Partial<ApiKeyRecord>): ApiKeyRecord | undefined {
  loadFromDisk();
  const k = apiKeys.find((x) => x.id === id);
  if (!k) return undefined;
  Object.assign(k, patch); saveToDisk(); return k;
}

// ---- reset tokens ----
export function addResetToken(r: ResetTokenRecord): void { loadFromDisk(); resetTokens.push(r); saveToDisk(); }
export function findResetToken(hash: string): ResetTokenRecord | undefined { loadFromDisk(); return resetTokens.find((r) => r.tokenHash === hash); }
export function updateResetToken(hash: string, patch: Partial<ResetTokenRecord>): void {
  loadFromDisk();
  const r = resetTokens.find((x) => x.tokenHash === hash);
  if (r) { Object.assign(r, patch); saveToDisk(); }
}

// ---- MFA challenges ----
export function addMfaChallenge(c: MfaChallenge): void { loadFromDisk(); mfaChallenges.push(c); saveToDisk(); }
export function getMfaChallenge(token: string): MfaChallenge | undefined { loadFromDisk(); return mfaChallenges.find((c) => c.token === token); }
export function removeMfaChallenge(token: string): void {
  loadFromDisk();
  mfaChallenges = mfaChallenges.filter((c) => c.token !== token);
  saveToDisk();
}
export function updateMfaChallenge(token: string, patch: Partial<MfaChallenge>): void {
  loadFromDisk();
  const c = mfaChallenges.find((x) => x.token === token);
  if (c) { Object.assign(c, patch); saveToDisk(); }
}

// ---- audit log (append-only, capped at 500 events) ----
export function logAuthEvent(event: string, opts: { userId?: string; email?: string; detail?: string; ip?: string }): AuthAuditEvent {
  loadFromDisk();
  const e: AuthAuditEvent = {
    id: `audit-${++auditCounter}-${Date.now().toString(36)}`,
    at: new Date().toISOString(), event, ...opts,
  };
  auditEvents.push(e);
  if (auditEvents.length > 500) auditEvents = auditEvents.slice(-500);
  saveToDisk();
  return e;
}
export function listAuthEvents(limit = 200): AuthAuditEvent[] {
  loadFromDisk();
  return [...auditEvents].reverse().slice(0, limit);
}
