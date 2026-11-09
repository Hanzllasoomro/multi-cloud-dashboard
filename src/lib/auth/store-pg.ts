// Ledger auth — Postgres store (v1.7).
//
// Same shapes as the file store (src/lib/auth/store.ts), same exported
// function names, but every function is async and talks to Postgres via
// src/lib/db.ts. The dispatcher in store.ts picks this module when
// DATABASE_URL is set (never under Vitest). Parameterised queries only —
// no string-interpolated values. TOTP secrets are stored reversibly by
// design (verification needs them); they are never returned by an API.
import { dbQuery } from "../db";
import type { ApiKeyRecord, AuthAuditEvent, MfaChallenge, PublicUser, ResetTokenRecord, Session, StoredUser } from "./store";

function rowToUser(r: Record<string, unknown>): StoredUser {
  return {
    id: r.id as string, email: r.email as string, name: r.name as string,
    role: r.role as StoredUser["role"], passwordHash: r.password_hash as string,
    createdAt: r.created_at as string,
    mfaEnabled: !!r.mfa_enabled, mfaSecret: (r.mfa_secret as string) || undefined,
    mfaPendingSecret: (r.mfa_pending_secret as string) || undefined,
    backupCodes: Array.isArray(r.backup_codes) ? (r.backup_codes as string[]) : [],
  };
}
function rowToSession(r: Record<string, unknown>): Session {
  return {
    token: r.token as string, userId: r.user_id as string,
    createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), lastSeen: Number(r.last_seen),
    userAgent: (r.user_agent as string) || undefined, ip: (r.ip as string) || undefined,
  };
}
function rowToApiKey(r: Record<string, unknown>): ApiKeyRecord {
  return {
    id: r.id as string, userId: r.user_id as string, name: r.name as string,
    prefix: r.prefix as string, keyHash: r.key_hash as string, createdAt: r.created_at as string,
    lastUsedAt: (r.last_used_at as string) || undefined, revokedAt: (r.revoked_at as string) || undefined,
  };
}
function rowToResetToken(r: Record<string, unknown>): ResetTokenRecord {
  return {
    tokenHash: r.token_hash as string, userId: r.user_id as string, email: r.email as string,
    createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), used: !!r.used,
  };
}
function rowToChallenge(r: Record<string, unknown>): MfaChallenge {
  return {
    token: r.token as string, userId: r.user_id as string,
    createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), failures: Number(r.failures),
  };
}
function rowToAudit(r: Record<string, unknown>): AuthAuditEvent {
  return {
    id: r.id as string, at: r.at as string,
    userId: (r.user_id as string) || undefined, email: (r.email as string) || undefined,
    event: r.event as string, detail: (r.detail as string) || undefined, ip: (r.ip as string) || undefined,
  };
}
export function publicUser(u: StoredUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, mfaEnabled: !!u.mfaEnabled };
}

const USER_COLS = "id, email, name, role, password_hash, created_at, mfa_enabled, mfa_secret, mfa_pending_secret, backup_codes";
const USER_VALUES = "$1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb";

export async function pgListUsers(): Promise<PublicUser[]> {
  const { rows } = await dbQuery<Record<string, unknown>>(`SELECT ${USER_COLS} FROM users ORDER BY created_at ASC`);
  return rows.map((r) => publicUser(rowToUser(r)));
}
export async function pgGetUserById(id: string): Promise<StoredUser | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? rowToUser(rows[0]) : undefined;
}
export async function pgGetStoredUserByEmail(email: string): Promise<StoredUser | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>(`SELECT ${USER_COLS} FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
  return rows[0] ? rowToUser(rows[0]) : undefined;
}
export async function pgCountOwners(): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE role = 'Owner'");
  return Number(rows[0]?.count || 0);
}
export async function pgAddUser(u: StoredUser): Promise<void> {
  await dbQuery(
    `INSERT INTO users (${USER_COLS}) VALUES (${USER_VALUES}) ON CONFLICT (email) DO NOTHING`,
    [u.id, u.email, u.name, u.role, u.passwordHash, u.createdAt, !!u.mfaEnabled, u.mfaSecret || null, u.mfaPendingSecret || null, JSON.stringify(u.backupCodes || [])],
  );
}
export async function pgUpdateUser(id: string, patch: Partial<StoredUser>): Promise<StoredUser | undefined> {
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  const map: [keyof StoredUser, string][] = [
    ["email", "email"], ["name", "name"], ["role", "role"], ["passwordHash", "password_hash"],
    ["mfaEnabled", "mfa_enabled"], ["mfaSecret", "mfa_secret"], ["mfaPendingSecret", "mfa_pending_secret"],
  ];
  for (const [key, col] of map) {
    if (patch[key] !== undefined) { sets.push(`${col} = $${i++}`); params.push(patch[key]); }
  }
  if (patch.backupCodes !== undefined) { sets.push(`backup_codes = $${i++}::jsonb`); params.push(JSON.stringify(patch.backupCodes)); }
  if (!sets.length) return pgGetUserById(id);
  params.push(id);
  const { rows } = await dbQuery<Record<string, unknown>>(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${USER_COLS}`, params,
  );
  return rows[0] ? rowToUser(rows[0]) : undefined;
}

// ---- sessions ----
export async function pgAddSession(s: Session): Promise<void> {
  await dbQuery(
    "INSERT INTO sessions (token, user_id, created_at, expires_at, last_seen, user_agent, ip) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (token) DO NOTHING",
    [s.token, s.userId, s.createdAt, s.expiresAt, s.lastSeen, s.userAgent || null, s.ip || null],
  );
}
export async function pgGetSession(token: string): Promise<Session | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM sessions WHERE token = $1", [token]);
  return rows[0] ? rowToSession(rows[0]) : undefined;
}
export async function pgDeleteSession(token: string): Promise<boolean> {
  const { rowCount } = await dbQuery("DELETE FROM sessions WHERE token = $1", [token]);
  return (rowCount || 0) > 0;
}
export async function pgListSessionsForUser(userId: string): Promise<Session[]> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  return rows.map(rowToSession);
}
export async function pgDeleteSessionsForUser(userId: string, exceptToken?: string): Promise<number> {
  const { rowCount } = exceptToken
    ? await dbQuery("DELETE FROM sessions WHERE user_id = $1 AND token <> $2", [userId, exceptToken])
    : await dbQuery("DELETE FROM sessions WHERE user_id = $1", [userId]);
  return rowCount || 0;
}

// ---- API keys ----
export async function pgAddApiKey(k: ApiKeyRecord): Promise<void> {
  await dbQuery(
    "INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at, last_used_at, revoked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [k.id, k.userId, k.name, k.prefix, k.keyHash, k.createdAt, k.lastUsedAt || null, k.revokedAt || null],
  );
}
export async function pgListApiKeysForUser(userId: string): Promise<ApiKeyRecord[]> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  return rows.map(rowToApiKey);
}
export async function pgFindApiKeyByHash(hash: string): Promise<ApiKeyRecord | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL", [hash]);
  return rows[0] ? rowToApiKey(rows[0]) : undefined;
}
export async function pgUpdateApiKey(id: string, patch: Partial<ApiKeyRecord>): Promise<ApiKeyRecord | undefined> {
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  for (const [key, col] of [["lastUsedAt", "last_used_at"], ["revokedAt", "revoked_at"]] as const) {
    if (patch[key] !== undefined) { sets.push(`${col} = $${i++}`); params.push(patch[key]); }
  }
  if (!sets.length) return undefined;
  params.push(id);
  const { rows } = await dbQuery<Record<string, unknown>>(`UPDATE api_keys SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, params);
  return rows[0] ? rowToApiKey(rows[0]) : undefined;
}

// ---- reset tokens ----
export async function pgAddResetToken(r: ResetTokenRecord): Promise<void> {
  await dbQuery(
    "INSERT INTO reset_tokens (token_hash, user_id, email, created_at, expires_at, used) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (token_hash) DO NOTHING",
    [r.tokenHash, r.userId, r.email, r.createdAt, r.expiresAt, r.used],
  );
}
export async function pgFindResetToken(hash: string): Promise<ResetTokenRecord | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM reset_tokens WHERE token_hash = $1", [hash]);
  return rows[0] ? rowToResetToken(rows[0]) : undefined;
}
export async function pgUpdateResetToken(hash: string, patch: Partial<ResetTokenRecord>): Promise<void> {
  if (patch.used !== undefined) await dbQuery("UPDATE reset_tokens SET used = $1 WHERE token_hash = $2", [patch.used, hash]);
}

// ---- MFA challenges ----
export async function pgAddMfaChallenge(c: MfaChallenge): Promise<void> {
  await dbQuery(
    "INSERT INTO mfa_challenges (token, user_id, created_at, expires_at, failures) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (token) DO NOTHING",
    [c.token, c.userId, c.createdAt, c.expiresAt, c.failures],
  );
}
export async function pgGetMfaChallenge(token: string): Promise<MfaChallenge | undefined> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM mfa_challenges WHERE token = $1", [token]);
  return rows[0] ? rowToChallenge(rows[0]) : undefined;
}
export async function pgRemoveMfaChallenge(token: string): Promise<void> {
  await dbQuery("DELETE FROM mfa_challenges WHERE token = $1", [token]);
}
export async function pgUpdateMfaChallenge(token: string, patch: Partial<MfaChallenge>): Promise<void> {
  if (patch.failures !== undefined) await dbQuery("UPDATE mfa_challenges SET failures = $1 WHERE token = $2", [patch.failures, token]);
}

// ---- audit log (append-only, capped at 500 events) ----
export async function pgLogAuthEvent(event: string, opts: { userId?: string; email?: string; detail?: string; ip?: string }): Promise<AuthAuditEvent> {
  const id = `audit-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const at = new Date().toISOString();
  await dbQuery(
    "INSERT INTO audit_events (id, at, user_id, email, event, detail, ip) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [id, at, opts.userId || null, opts.email || null, event, opts.detail || null, opts.ip || null],
  );
  await dbQuery("DELETE FROM audit_events WHERE seq NOT IN (SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 500)");
  return { id, at, event, ...opts };
}
export async function pgListAuthEvents(limit = 200): Promise<AuthAuditEvent[]> {
  const { rows } = await dbQuery<Record<string, unknown>>("SELECT * FROM audit_events ORDER BY seq DESC LIMIT $1", [limit]);
  return rows.map(rowToAudit);
}

export async function pgResetAuthStore(): Promise<void> {
  await dbQuery("TRUNCATE audit_events, mfa_challenges, reset_tokens, api_keys, sessions, users RESTART IDENTITY CASCADE");
}
