// Ledger auth — store dispatcher (v1.7).
//
// Two backends, one interface (all functions async since v1.7):
//  - Postgres (src/lib/auth/store-pg.ts) when DATABASE_URL is set and we
//    are not under Vitest — the Vercel deployment path. Shared across
//    serverless instances, so accounts/sessions survive cold starts.
//  - File-backed JSON (.ledger-data/auth.json) otherwise — local dev and
//    tests. Same shapes, same behaviour; a real database replaces exactly
//    this module for production.
// Only hashes/tokens are stored — never plaintext passwords. TOTP
// secrets ARE stored reversibly (verification needs them); the file is
// 0600 and gitignored, Postgres relies on encryption at rest, and
// secrets are never returned by an API after the one-time setup response.
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isPostgresEnabled } from "../db";
import * as pg from "./store-pg";
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
export function databaseEnabled(): boolean { return isPostgresEnabled(); }

// ================= file backend (unchanged from v1.6) =================
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

function fileReset(): void {
  users = []; sessions = new Map(); userCounter = 0; apiKeys = []; resetTokens = []; mfaChallenges = []; auditEvents = []; auditCounter = 0;
  if (persistenceEnabled()) { try { rmSync(authFilePath(), { force: true }); } catch { /* ignore */ } }
}
function filePublicUser(u: StoredUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, mfaEnabled: !!u.mfaEnabled };
}
function fileAddUser(u: StoredUser): void { loadFromDisk(); users.push(u); saveToDisk(); }
function fileUpdateUser(id: string, patch: Partial<StoredUser>): StoredUser | undefined {
  loadFromDisk();
  const u = users.find((x) => x.id === id);
  if (!u) return undefined;
  Object.assign(u, patch); saveToDisk(); return u;
}
function fileLogAuthEvent(event: string, opts: { userId?: string; email?: string; detail?: string; ip?: string }): AuthAuditEvent {
  loadFromDisk();
  const e: AuthAuditEvent = { id: `audit-${++auditCounter}-${Date.now().toString(36)}`, at: new Date().toISOString(), event, ...opts };
  auditEvents.push(e);
  if (auditEvents.length > 500) auditEvents = auditEvents.slice(-500);
  saveToDisk();
  return e;
}

// ================= async dispatchers (the public surface) =================
export function publicUser(u: StoredUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, mfaEnabled: !!u.mfaEnabled };
}
export async function resetAuthStore(): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgResetAuthStore(); return; }
  fileReset();
}
export async function listUsers(): Promise<PublicUser[]> {
  if (isPostgresEnabled()) return pg.pgListUsers();
  loadFromDisk(); return users.map(filePublicUser);
}
export async function getUserById(id: string): Promise<StoredUser | undefined> {
  if (isPostgresEnabled()) return pg.pgGetUserById(id);
  loadFromDisk(); return users.find((u) => u.id === id);
}
export async function getStoredUserByEmail(email: string): Promise<StoredUser | undefined> {
  if (isPostgresEnabled()) return pg.pgGetStoredUserByEmail(email);
  loadFromDisk(); return users.find((u) => u.email === email.trim().toLowerCase());
}
export async function countOwners(): Promise<number> {
  if (isPostgresEnabled()) return pg.pgCountOwners();
  loadFromDisk(); return users.filter((u) => u.role === "Owner").length;
}
export async function nextUserId(): Promise<string> {
  if (isPostgresEnabled()) return `user-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  loadFromDisk(); return `user-${++userCounter}-${Date.now().toString(36)}`;
}
export async function addUser(u: StoredUser): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgAddUser(u); return; }
  fileAddUser(u);
}
export async function updateUser(id: string, patch: Partial<StoredUser>): Promise<StoredUser | undefined> {
  if (isPostgresEnabled()) return pg.pgUpdateUser(id, patch);
  return fileUpdateUser(id, patch);
}
export async function addSession(s: Session): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgAddSession(s); return; }
  loadFromDisk(); sessions.set(s.token, s); saveToDisk();
}
export async function getSession(token: string): Promise<Session | undefined> {
  if (isPostgresEnabled()) return pg.pgGetSession(token);
  loadFromDisk(); return sessions.get(token);
}
export async function deleteSession(token: string): Promise<boolean> {
  if (isPostgresEnabled()) return pg.pgDeleteSession(token);
  loadFromDisk(); const ok = sessions.delete(token); if (ok) saveToDisk(); return ok;
}
export async function listSessionsForUser(userId: string): Promise<Session[]> {
  if (isPostgresEnabled()) return pg.pgListSessionsForUser(userId);
  loadFromDisk();
  return [...sessions.values()].filter((s) => s.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}
export async function deleteSessionsForUser(userId: string, exceptToken?: string): Promise<number> {
  if (isPostgresEnabled()) return pg.pgDeleteSessionsForUser(userId, exceptToken);
  loadFromDisk();
  let n = 0;
  for (const [t, s] of [...sessions.entries()]) {
    if (s.userId === userId && t !== exceptToken) { sessions.delete(t); n++; }
  }
  if (n) saveToDisk();
  return n;
}
/** In file mode lastSeen is in-memory only (expiry is absolute); in
 *  Postgres mode it is not rewritten on every request either. */
export async function touchSession(_s: Session): Promise<void> { _s.lastSeen = Date.now(); }
export async function addApiKey(k: ApiKeyRecord): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgAddApiKey(k); return; }
  loadFromDisk(); apiKeys.push(k); saveToDisk();
}
export async function listApiKeysForUser(userId: string): Promise<ApiKeyRecord[]> {
  if (isPostgresEnabled()) return pg.pgListApiKeysForUser(userId);
  loadFromDisk(); return apiKeys.filter((k) => k.userId === userId);
}
export async function findApiKeyByHash(hash: string): Promise<ApiKeyRecord | undefined> {
  if (isPostgresEnabled()) return pg.pgFindApiKeyByHash(hash);
  loadFromDisk(); return apiKeys.find((k) => k.keyHash === hash && !k.revokedAt);
}
export async function updateApiKey(id: string, patch: Partial<ApiKeyRecord>): Promise<ApiKeyRecord | undefined> {
  if (isPostgresEnabled()) return pg.pgUpdateApiKey(id, patch);
  loadFromDisk();
  const k = apiKeys.find((x) => x.id === id);
  if (!k) return undefined;
  Object.assign(k, patch); saveToDisk(); return k;
}
export async function addResetToken(r: ResetTokenRecord): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgAddResetToken(r); return; }
  loadFromDisk(); resetTokens.push(r); saveToDisk();
}
export async function findResetToken(hash: string): Promise<ResetTokenRecord | undefined> {
  if (isPostgresEnabled()) return pg.pgFindResetToken(hash);
  loadFromDisk(); return resetTokens.find((r) => r.tokenHash === hash);
}
export async function updateResetToken(hash: string, patch: Partial<ResetTokenRecord>): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgUpdateResetToken(hash, patch); return; }
  loadFromDisk();
  const r = resetTokens.find((x) => x.tokenHash === hash);
  if (r) { Object.assign(r, patch); saveToDisk(); }
}
export async function addMfaChallenge(c: MfaChallenge): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgAddMfaChallenge(c); return; }
  loadFromDisk(); mfaChallenges.push(c); saveToDisk();
}
export async function getMfaChallenge(token: string): Promise<MfaChallenge | undefined> {
  if (isPostgresEnabled()) return pg.pgGetMfaChallenge(token);
  loadFromDisk(); return mfaChallenges.find((c) => c.token === token);
}
export async function removeMfaChallenge(token: string): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgRemoveMfaChallenge(token); return; }
  loadFromDisk(); mfaChallenges = mfaChallenges.filter((c) => c.token !== token); saveToDisk();
}
export async function updateMfaChallenge(token: string, patch: Partial<MfaChallenge>): Promise<void> {
  if (isPostgresEnabled()) { await pg.pgUpdateMfaChallenge(token, patch); return; }
  loadFromDisk();
  const c = mfaChallenges.find((x) => x.token === token);
  if (c) { Object.assign(c, patch); saveToDisk(); }
}
export async function logAuthEvent(event: string, opts: { userId?: string; email?: string; detail?: string; ip?: string }): Promise<AuthAuditEvent> {
  if (isPostgresEnabled()) return pg.pgLogAuthEvent(event, opts);
  return fileLogAuthEvent(event, opts);
}
export async function listAuthEvents(limit = 200): Promise<AuthAuditEvent[]> {
  if (isPostgresEnabled()) return pg.pgListAuthEvents(limit);
  loadFromDisk();
  return [...auditEvents].reverse().slice(0, limit);
}
