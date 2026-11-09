# Ledger v1.7 (BUILT 2026-11-09, option A — Vercel Postgres): make Vercel deployment persistent

Prepared 2026-11-09 (Asia/Karachi) after Ledger v1.6.0 was deployed to Vercel.
Status: BUILT as v1.7.0 (commit to follow). msue chose option A on 2026-11-09.
No database has been created yet — msue still needs to create the Vercel
Postgres database and set DATABASE_URL in Vercel; the live-database
verification is pending that step.

## Why now

- Ledger v1.6.0 is live at https://multi-cloud-dashboard-ten.vercel.app
  (commit `9fb4d665991422d6266c819151675bbce0b40422`, 56/56 tests).
- At the last live check (2026-11-08 23:20 UTC) `GET /api/auth/status`
  returned `hasUsers: false`, demo off — no account existed yet, and the
  first registration becomes Owner. That seat was deliberately left for msue.
- Vercel serverless filesystems are ephemeral per instance. The auth store
  is a file, so an Owner account created on Vercel may not survive a cold
  start and may differ between instances. The same applies to connected
  accounts (in-memory) and the Demo Studio scenario (file).
- **Do not treat a Vercel-created Owner account as permanent until this
  lands.** If msue has already created one since the last check, delivery
  should re-check `GET /api/auth/status` first — that check was not
  possible in this research run (browser read was unavailable).

## What would be lost on Vercel today

From `src/lib/auth/store.ts` (header: "A real database replaces exactly
this module for production; the shapes, routes and permission model do
not change"):

- `AuthFileData` in `.ledger-data/auth.json` (`LEDGER_AUTH_FILE` override):
  users (scrypt hash + salt, role, MFA flag/secret, hashed backup codes),
  sessions (24h, token + device/IP), API keys (`lk_` prefix + sha256 hash,
  inherit owner's role), reset tokens (sha256, 1h, single-use),
  MFA challenges (5 min), audit events (capped at 500).
- From `src/lib/accounts.ts` (header: "resets on server restart and does
  not survive a multi-instance deployment"): connected accounts and their
  audit entries — identifiers/scopes/status only, never credentials.
  This also closes the pending 2026-10-27 proposal to persist accounts to
  `.ledger-data/accounts.json`; a DB subsumes that file proposal.
- From `src/lib/demo-scenario-store.ts`: Demo Studio scenario
  (`.ledger-data/demo-scenario.json`). Demo-only — recommend leaving it
  file-backed/local for now, not part of v1.7.

## Proposed scope: v1.7, auth + accounts only

Replace exactly two store modules behind their existing interfaces:

1. `src/lib/auth/store.ts` → Postgres-backed store with the same exported
   functions (`listUsers`, `addUser`, `addSession`, API-key, reset-token,
   MFA-challenge and audit functions). Routes, guards, permissions and
   the 56 existing tests do not change shape.
2. `src/lib/accounts.ts` → same account model / API shape, Postgres-backed.

Tables (one per collection above): `users`, `sessions`, `api_keys`,
`reset_tokens`, `mfa_challenges`, `audit_events`, `managed_accounts`.
Local dev keeps the file store when no `DATABASE_URL` is set, so local
behaviour and hermetic tests (`NODE_ENV=test` / `VITEST` disables
persistence) are unchanged.

Migration: one-time import from `.ledger-data/auth.json` (counts verified
per table before/after); scrypt hashes migrate as-is — no password resets
needed. Keep the file as a backup, do not delete it in the migration.
TOTP secrets are stored reversibly by design (verification needs them);
note for the build: rely on the provider's encryption at rest and keep
them out of logs/APIs, as today — do not add a new encryption scheme
without a decision on key management.

## Options

### A — Vercel Postgres (recommended)
Native Vercel integration, `DATABASE_URL` set in the Vercel project env.
Postgres, which matches the original plan (WS-01/WS-07: Postgres control
plane). Smallest operational change for a deployment that already lives
on Vercel. msue creates the database in the Vercel dashboard; Muse wires
the store + migration + tests. No new hosting account beyond Vercel.

### B — Neon / Supabase Postgres (direct)
Same Postgres store code, database created directly with the provider
instead of through Vercel. More control / portability if Ledger ever
leaves Vercel; one more account and connection string to manage, and
the connection string must be added to Vercel env vars by hand.

### C — Leave Vercel, move to a persistent host
e.g. Render / a VPS where `.ledger-data/` persists. Avoids a database
entirely, but abandons the Vercel deployment msue just made and reopens
hosting decisions. Not recommended unless Vercel itself is the problem.

## Decisions needed from msue (nothing is built until these are answered)

1. Option A, B or C? (Recommendation: A.)
2. Include connected accounts in the same v1.7 migration, or auth only?
   (Recommendation: include — it is the same work pattern and closes the
   Oct 2026 proposal.)
3. Leave the Demo Studio scenario file-backed/local? (Recommendation: yes.)
4. Who creates the database? Muse cannot create a Vercel/Neon/Supabase
   account or database on msue's behalf — msue creates it and provides
   `DATABASE_URL` (or grants access), then Muse builds, tests and verifies.

## Verification planned for the build

- `npm run test` stays 56/56 plus new store tests; `tsc` clean; build passes.
- Local smoke test with `DATABASE_URL` set, then a Vercel smoke test:
  register Owner → restart/redeploy → login still works, MFA/API-key/
  session/audit flows intact, `hasUsers` stays true.
- Docs: update `docs/SECURITY.md` "real database" section and
  `detail_explanation.md` limitations, as v1.6.0 did for auth.

## Sources in the repo

- `src/lib/auth/store.ts` — file-backed store, `AuthFileData` shape.
- `src/lib/accounts.ts` — in-memory accounts store.
- `src/lib/demo-scenario-store.ts` — file-backed demo scenario.
- `docs/SECURITY.md` — "What is still production-only work: Real database".
- `src/app/api/auth/status/route.ts` — exposes `{hasUsers, demoAuthEnabled}`.
