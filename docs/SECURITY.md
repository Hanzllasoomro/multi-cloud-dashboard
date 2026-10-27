# Ledger — Security (v1.3.1)

## Threat model

| Threat | What an attacker would try | Defence in this version |
|---|---|---|
| Credential theft | Steal the user database and crack passwords | Passwords are never stored in plaintext: `scrypt` + per-user random salt (`src/lib/auth.ts`). No password is ever returned by any API or logged. |
| Session hijacking | Steal or forge a session token | Sessions are random 256-bit tokens, stored server-side only. The browser holds only an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Sessions expire after 24h absolute. Middleware only checks cookie *presence*; route handlers validate the token and role (see below). |
| Brute force | Guess passwords by trying many logins | 5 failed attempts per email+IP in 15 minutes, then HTTP 429. Login failures return a generic "Invalid email or password" so valid emails cannot be enumerated. |
| CSRF | Trick a signed-in browser into calling an auth endpoint | Auth POSTs check `Origin` against `Host` when an Origin header is present, on top of `SameSite=Lax`. |
| Role escalation / cross-tenant access | A Viewer calls an admin API directly, or reads another tenant's data | Authorization is enforced **server-side** in every API route (`src/lib/auth-guard.ts` + `src/lib/permissions.ts`): unauthenticated → 401, forbidden role → 403. UI hiding is cosmetic only. Scopes are mandatory filters in the query layer (see README). The current store is single-tenant demo data; multi-tenant isolation (tenant_id + RLS) is production work, not claimed here. |
| Secret leakage | Credentials in code, logs, or API responses | No secrets in code. Live cloud credentials stay in server environment variables only. `/api/source` returns env *presence* only, never values. The auth store returns public users only — never a hash. |
| Demo-account abuse | A judge demo account used as a backdoor | Demo sign-in (`LEDGER_DEMO_AUTH=true`) always creates a **Viewer** session, never Owner, and is **off by default**. It must stay off for real deployments. |

## What is implemented

- scrypt password hashing + per-user salt; 12-character minimum, common passwords rejected.
- httpOnly session cookie, 24h absolute expiry, logout deletes the server session.
- Login rate limiting (5 / 15 min / email+IP) with 429 + retry guidance.
- Origin check on auth POSTs.
- RBAC as code (`src/lib/permissions.ts`, the Settings roles matrix): Owner, Admin,
  FinOps Manager, Analyst, Viewer, Auditor. Enforced in: `/api/accounts` writes +
  test (Owner/Admin/FinOps Manager), `/api/accounts/audit` (Owner/Admin/Auditor),
  `/api/users` (Owner/Admin), every other API (any authenticated user).
- Next.js middleware (`src/middleware.ts`) redirects unauthenticated browser
  visits to `/login` and returns 401 for unauthenticated API calls outside
  `/api/auth`. It only checks cookie presence (edge runtime cannot validate
  tokens) — route handlers are the authoritative check.
- shadcn-style UI components on Ledger tokens (`src/components/ui/`), with
  accessible labels, focus rings, inline validation errors, and show/hide
  password. See `src/components/ui/README.md` for why this is not a literal
  shadcn CLI install (no Tailwind migration).

## v1.3.1 fix: why registering used to sign you out (and login then failed)

v1.3.0 kept users and sessions in module-level memory only. That worked
under `npm start` (one shared server bundle), but under `npm run dev`
each route handler can hold its own copy of that memory, and a recompile
or a second server process (e.g. an old server still on port 3000 while
the new one moved to 3001) resets it. Symptom, reproduced in dev before
the fix: register → 201, then `/api/auth/me` → 401, then login with the
just-created password → 401 every time (fast 401s are consistent with
"no such user", not with a slow scrypt mismatch).

Fix: users and sessions are now persisted to `.ledger-data/auth.json`
(default; `LEDGER_AUTH_FILE` overrides it), loaded before every lookup
and saved atomically (tmp file + rename) after every mutation, so every
server instance sharing the file sees the same accounts. Only scrypt
hashes and session tokens are stored — never plaintext passwords. The
file is git-ignored and should be owner-only readable (`chmod 600` on
macOS/Linux). `/api/auth/status` exposes only `{hasUsers, demoAuthEnabled}`
so a wiped store is visible on `/login` instead of masquerading as a
wrong password; login failures still return the generic message. If you
are on v1.3.0 and see this: kill any stale server (Windows:
`netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`;
macOS/Linux: `lsof -ti:3000 | xargs kill`), pull v1.3.1, restart, and
register once more.

## What is still production-only work (NOT faked)

- **Real database** for users and sessions (now file-backed for local
  dev/single-server use — see above) and for accounts (still in-memory
  and reset on server restart). A DB replaces one module each; API shapes
  do not change.
- **MFA (TOTP/WebAuthn)** — not implemented. Do not claim it.
- **Email password reset** — not implemented. There is deliberately no
  half-working reset flow: until email reset exists, password reset is via
  an admin, and the login page says so.
- **SSO/SCIM** — buy via WorkOS / Auth0 / Clerk / Keycloak; Ledger owns only
  the authorization model (see the original plan, WS-01).
- **Multi-tenant isolation** (tenant_id on every row, Postgres RLS, per-tenant
  data keys) — the demo data is a single shared organisation. Do not deploy
  this version for multiple untrusted tenants.

## How to create the first Owner account

1. Start the app (`npm run dev` or `npm start`).
2. Open `/register` and create the first account — it becomes **Owner**
   automatically. Later registrations start as **Viewers**.
3. Promote/demote team members in **Settings > Team members** (Owner/Admin
   only). Demoting the last Owner is blocked by the API.
4. For a hackathon demo only, start with `LEDGER_DEMO_AUTH=true` to enable
   the "Continue with demo account" button on `/login` (Viewer session).
   Keep it **off** for any real deployment.
