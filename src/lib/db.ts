// Ledger — Postgres connection (v1.7).
//
// Vercel Postgres (Neon-backed) is reached through a connection string in
// DATABASE_URL. When no DATABASE_URL is set — local dev, and always under
// Vitest — the file/in-memory stores are used instead, so local behaviour
// and hermetic tests are unchanged. This module owns the pool and the
// schema; the stores in src/lib/auth/store-pg.ts and src/lib/accounts-pg.ts
// own the queries. No credential value is ever logged here.
import { Pool, type QueryResultRow } from "pg";

export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  return raw && raw.trim() ? raw.trim() : undefined;
}

/** Postgres is used only when a DATABASE_URL is configured and we are not
 *  running tests. Tests always use the file/in-memory stores. */
export function isPostgresEnabled(): boolean {
  return !!databaseUrl() && process.env.NODE_ENV !== "test" && !process.env.VITEST;
}

let pool: Pool | null = null;
let schemaPromise: Promise<void> | null = null;

/** Test-only pool injection (fake pool in tests/postgres-store.test.ts).
 *  Never called by routes. */
export function setPoolForTests(p: Pool | null): void {
  pool = p;
  schemaPromise = null;
}

export function getPool(): Pool {
  if (pool) return pool;
  const url = databaseUrl()!;
  // Vercel Postgres / Neon require TLS; localhost dev Postgres does not.
  const local = url.includes("localhost") || url.includes("127.0.0.1") || url.includes("host=/");
  pool = new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5, // serverless: keep the pool small; each instance gets its own
    idleTimeoutMillis: 30000,
  });
  pool.on("error", () => { /* a failed idle client must not crash the server */ });
  return pool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT,
  mfa_pending_secret TEXT,
  backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  user_agent TEXT,
  ip TEXT
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS mfa_challenges (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_events (
  seq BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL,
  at TEXT NOT NULL,
  user_id TEXT,
  email TEXT,
  event TEXT NOT NULL,
  detail TEXT,
  ip TEXT
);
CREATE TABLE IF NOT EXISTS managed_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  billing_account TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  last_sync TEXT NOT NULL,
  next_sync TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  previous_status TEXT
);
CREATE TABLE IF NOT EXISTS account_audit (
  id TEXT PRIMARY KEY,
  "when" TEXT NOT NULL,
  who TEXT NOT NULL,
  what TEXT NOT NULL,
  account_id TEXT
);
`;

/** Create tables if missing. Safe to call concurrently — one in-flight
 *  promise is shared. Throws on connection failure; callers surface it
 *  as a 500 rather than silently falling back to the file store (a
 *  silent fallback would split accounts across two stores). */
export async function ensureSchema(p: Pool = getPool()): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = p.query(SCHEMA_SQL).then(() => undefined).catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
  const p = getPool();
  await ensureSchema(p);
  const res = await p.query<T>(text, params as never[]);
  return { rows: res.rows, rowCount: res.rowCount };
}
