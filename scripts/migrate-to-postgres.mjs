// Ledger v1.7 — one-time migration: .ledger-data/auth.json -> Postgres.
//
// Usage (from the project root, after creating the database):
//   DATABASE_URL="postgres://..." node scripts/migrate-to-postgres.mjs
//   DATABASE_URL="postgres://..." node scripts/migrate-to-postgres.mjs --dry-run
//
// What it does: creates the tables (same DDL as src/lib/db.ts), then
// copies users, sessions, API keys, reset tokens, MFA challenges and
// audit events from the local auth file. scrypt hashes migrate as-is —
// no password resets needed. The file is kept as a backup and is NOT
// deleted. Managed accounts are seeded by the app itself on first use
// (they live in memory locally, so there is nothing to migrate from a
// local run). Idempotent: re-running skips rows that already exist.
// Never paste the connection string in chat — pass it as an env var.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Pass it as an environment variable (never paste it in chat).");
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  max: 2,
});

let DDL = null;
try { DDL = readFileSync(resolve("src/lib/db.ts"), "utf8"); } catch { /* handled below */ }
if (!DDL) { console.error("Could not read src/lib/db.ts — run from the project root."); process.exit(1); }
const schema = DDL.split("const SCHEMA_SQL = `")[1].split("`;")[0];

const file = resolve(".ledger-data", "auth.json");
const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { users: [], sessions: [], apiKeys: [], resetTokens: [], mfaChallenges: [], auditEvents: [] };
const counts = {};
async function run(text, params = []) {
  if (dryRun) { console.log("[dry-run]", text.split("\n")[0].slice(0, 90), params.length, "params"); return { rowCount: 0, rows: [] }; }
  return pool.query(text, params);
}

await run(schema);
const tables = [
  ["users", data.users || [], (u) => [u.id, u.email, u.name, u.role, u.passwordHash, u.createdAt, !!u.mfaEnabled, u.mfaSecret || null, u.mfaPendingSecret || null, JSON.stringify(u.backupCodes || [])],
    "INSERT INTO users (id, email, name, role, password_hash, created_at, mfa_enabled, mfa_secret, mfa_pending_secret, backup_codes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT (id) DO NOTHING"],
  ["sessions", data.sessions || [], (s) => [s.token, s.userId, s.createdAt, s.expiresAt, s.lastSeen, s.userAgent || null, s.ip || null],
    "INSERT INTO sessions (token, user_id, created_at, expires_at, last_seen, user_agent, ip) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (token) DO NOTHING"],
  ["api_keys", data.apiKeys || [], (k) => [k.id, k.userId, k.name, k.prefix, k.keyHash, k.createdAt, k.lastUsedAt || null, k.revokedAt || null],
    "INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at, last_used_at, revoked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING"],
  ["reset_tokens", data.resetTokens || [], (r) => [r.tokenHash, r.userId, r.email, r.createdAt, r.expiresAt, r.used],
    "INSERT INTO reset_tokens (token_hash, user_id, email, created_at, expires_at, used) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (token_hash) DO NOTHING"],
  ["mfa_challenges", data.mfaChallenges || [], (c) => [c.token, c.userId, c.createdAt, c.expiresAt, c.failures],
    "INSERT INTO mfa_challenges (token, user_id, created_at, expires_at, failures) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (token) DO NOTHING"],
  ["audit_events", data.auditEvents || [], (e) => [e.id, e.at, e.userId || null, e.email || null, e.event, e.detail || null, e.ip || null],
    "INSERT INTO audit_events (id, at, user_id, email, event, detail, ip) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING"],
];
for (const [name, rows, map, sql] of tables) {
  let n = 0;
  for (const row of rows) { await run(sql, map(row)); n++; }
  counts[name] = n;
  console.log(`${name}: ${n} row(s) from file`);
}
console.log(dryRun ? "Dry run complete — nothing was written." : "Migration complete. The local file was kept as a backup; verify counts in Postgres, then set DATABASE_URL in Vercel and redeploy.");
await pool.end();
