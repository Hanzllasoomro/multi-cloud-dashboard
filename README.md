# Ledger — Multi-Cloud Cost & Usage Platform

Monitor billing, usage, budgets, anomalies, commitments and recommendations across
AWS, Azure and GCP (plus extensible providers) in one place. Next.js 14 App Router,
TypeScript strict, hand-built SVG charts (no chart-library lock-in).

## Why this wins (the pitch)

**Problem:** a company's cloud bill is split across AWS, Azure and GCP consoles
that never agree, so nobody can answer "why did our bill go up?" in one place.
**Ledger:** one canonical FOCUS-style model, one number across all clouds, every
figure carrying freshness + reconciliation state, read-only least-privilege
connections, and every number drilling down to line items. **Demo it in 3
minutes:** open `/demo` and follow the six steps (connect → one number → March
EC2 spike → budget breach → savings → export/reconcile). Full script: `DEMO.md`.

> **Demo data by default** — this build ships with a deterministic synthetic
> dataset (12 months, 3 providers, realistic services, credits, tax,
> savings-plan purchases, messy tags, one restatement note). Set
> `LEDGER_DATA_SOURCE=live` plus the provider env vars in
> `docs/REAL_ACCOUNTS.md` to switch to real provider data; an unconfigured
> provider shows "Not connected", never fake numbers. No credentials are ever
> committed, logged or returned by the API. See `.env.example` (names only).

## Architecture (v1.1 — demo vs live paths)

```
                         ┌─ DEMO ──────────────────────────────┐
                         │ deterministic synthetic rows        │
                         │ src/lib/data.ts (allRows)           │
Providers (AWS / Azure / GCP, read-only roles)                  │
        │  Cost Explorer / Cost Mgmt Query / BigQuery REST      ▼
        ├─ LIVE ──► src/lib/providers/ (common interface:     Query API
        │            validate / fetchCosts / toFocusRows)      src/lib/query.ts
        │            └─ fixtures + mapping tests               (typed DSL, tenant
        ▼                                                      + scope enforced,
Connectors → Normalizer (provider schema → FOCUS + x_) ───────► meta.source =
        ▼                                                      "demo" | "live")
Reconciliation + publish gate → data_version N (pinned reads)
        ▼
Web app (src/app) · /demo judge walkthrough · CSV + JSON exports
        · API routes (src/app/api, incl. /api/source: mode + env presence only)
```

Deploy anywhere: `vercel.json` (Vercel), `render.yaml` (Render), `Dockerfile`
(node:20, `npm ci` → build → start) — all consistent with package.json scripts.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (must pass)
npm start
```

## FOCUS schema (canonical row, `src/lib/types.ts`)

| Field | Meaning |
|---|---|
| `provider`, `billingAccount`, `subAccount` | AWS account / Azure subscription / GCP project |
| `service`, `serviceCategory`, `region`, `resourceId`, `skuId` | What was used, where |
| `chargeCategory` | `Usage` / `Purchase` / `Credit` / `Tax` / `Adjustment` |
| `chargePeriod`, `billingPeriod` | Charge date (UTC) / invoice month `YYYY-MM` |
| `billedCost`, `effectiveCost`, `listCost`, `contractedCost` | Billed = invoice; Effective = amortised; List = pre-discount |
| `usageQuantity`, `usageUnit` | Billing usage (GB-months, hours, requests) |
| `tags` | Normalised keys (case/whitespace); original kept on the row |
| `commitmentId`, `commitmentDiscountType` | Savings Plan / reservation / CUD linkage |
| `x_*` | Lineage: source file, source version, ingested time, tenant, connection, raw service code, normalizer version, restatement note |

Cost bases exposed in the UI: **Billed** (default, ties to invoice), **Effective**,
**List**. Every API response carries the envelope
`{ data, totals, meta: { dataAsOf, freshness, reconciliation, costBasis, currency,
estimatedMonths, queryId } }`.

## Replacing synthetic data with real providers

1. **AWS** — Cross-account IAM role with a unique `ExternalId` per connection; a
   FOCUS data export (plus CUR 2.0 where extra columns are needed) delivered to a
   customer-owned S3 bucket. Read: S3 read on the export prefix, Cost Explorer read,
   Organizations read, Cost Optimization Hub / Compute Optimizer read. Activate
   user-defined cost-allocation tags first, or they never appear in cost data.
   Consolidated billing needs the payer (management) account.
2. **Azure** — Entra app registration with admin consent; roles Cost Management
   Reader + Reader at scope, Monitoring Reader, Storage Blob Data Reader on the
   export container. Exports: FOCUS dataset per scope into a storage account.
   Handle EA / MCA / pay-as-you-go / CSP differences; CSP access may be restricted.
3. **GCP** — Billing export to BigQuery (detailed + pricing; FOCUS view where
   available) in the customer's project, read via service-account impersonation or
   Workload Identity Federation (no long-lived keys). Roles: BigQuery Data Viewer
   on the dataset, BigQuery Job User (or extract to Cloud Storage), Monitoring
   Viewer, Billing Viewer, Recommender Viewer. **Exports are not retroactive** —
   history starts when the export is enabled.

Implementation steps: implement one provider end-to-end first
(connect → ingest → normalise → reconcile → publish → query → one dashboard), then
add connectors/mappings only. Replace `allRows()` in `src/lib/data.ts` with a
query against the analytics store; keep `query.ts`'s compiler as the single place
tenant/scope filters are applied.

## Reconciliation tolerances

- Open months: up to **0.5%** variance → status `Variance`, breakdown shown.
- Final months: up to **0.01%** per billing account.
- Independent sources: AWS Cost Explorer total; Azure invoice/billing APIs;
  GCP invoice total entered/uploaded by the user (no invoice API exists).

## Security

- **Tenant isolation** is enforced in the data layer (`x_tenantId` filter in
  `query.ts`), never only hidden in the UI; PostgreSQL RLS is defence in depth.
- **No secrets in code or logs.** Credentials live in a vault, envelope-encrypted
  with KMS, never returned by the API after creation; federation (unique
  `ExternalId` per connection) over static keys wherever possible.
- Read-only by default; write actions are a separately gated workstream (WS-23).
- Spreadsheet formula injection neutralised in exports (`src/lib/format.ts`).
- Tags/resource names are untrusted text: escaped everywhere, never obeyed.

## Settings — connected accounts (v1.2)

`Settings › Connected accounts` is where accounts are managed day to day
(the Connections page is the onboarding wizard). Add an account (provider,
display name, identifier, billing account, scope: sub-accounts/tags/teams),
edit its name and scope, pause/resume it, run a per-permission test
connection, or remove it with typed confirmation (type the display name
exactly) plus a keep-data vs purge-data choice. Paused accounts are excluded
from `/api/query` totals; the header and Overview banner name any
paused/broken account. Every action writes an append-only audit entry.
No secret fields exist anywhere in this flow — live credentials stay in
server environment variables only (see docs/REAL_ACCOUNTS.md). Account
lifecycle: see the "Account lifecycle" section in docs/REAL_ACCOUNTS.md.
Limitation: the account store is in-memory in this version and resets on
server restart; a database replaces that one module later.

## Authentication & authorization (v1.3)

Real auth, not a demo login screen. `/login` and `/register` are built from
shadcn-style UI components (`src/components/ui/` — same API as shadcn,
implemented on Ledger CSS tokens, **not** a shadcn CLI install and no
Tailwind migration; see `src/components/ui/README.md`).

- **First account = Owner.** Register the first user and it becomes Owner
  automatically; later registrations start as Viewers, promotable in
  **Settings > Team members** (Owner/Admin only; demoting the last Owner is
  blocked by the API).
- **Passwords:** minimum 12 characters, common passwords rejected, hashed
  with Node `scrypt` + per-user salt — never stored in plaintext, never
  returned or logged.
- **Sessions:** random 256-bit tokens, server-side only, `httpOnly` +
  `SameSite=Lax` cookie (`Secure` in production), 24h absolute expiry,
  logout deletes the session. Login is rate-limited (5 failures per
  email+IP in 15 min → 429) and failures are generic so emails can't be
  enumerated.
- **Authorization is server-side** (`src/lib/permissions.ts` + middleware +
  route guards): unauthenticated → 401, forbidden role → 403. Account
  writes/test need Owner/Admin/FinOps Manager; audit needs
  Owner/Admin/Auditor; all other APIs need any signed-in user. Viewers see
  accounts read-only in Settings (no add/edit/delete buttons).
- **Hackathon demo access:** start with `LEDGER_DEMO_AUTH=true` to enable
  "Continue with demo account" on `/login` — always a **Viewer** session,
  never Owner. Keep it **off** for real deployments.
- **Not yet built (documented, not faked):** MFA/TOTP, email password
  reset (reset is via an admin until then), SSO/SCIM, and a real database
  — users, sessions, and accounts are in-memory in this version and reset
  on server restart. Full threat model: `docs/SECURITY.md`.

## Routes

Pages: `/` overview, `/login`, `/register`, `/demo`, `/explorer`, `/connections`, `/budgets`, `/anomalies`,
`/forecast`, `/commitments`, `/recommendations`, `/allocation`, `/reports`,
`/data-health`, `/settings`.
APIs: `/api/query` (accepts `?accountId=` managed ids and `?accounts=`
sub-account names; paused accounts excluded), `/api/accounts`,
`/api/accounts/[id]`, `/api/accounts/[id]/test`, `/api/accounts/audit`,
`/api/connections`, `/api/budgets`, `/api/anomalies`,
`/api/forecast`, `/api/recommendations`, `/api/commitments`, `/api/data-health`,
`/api/source`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`,
`/api/auth/me`, `/api/auth/demo`, `/api/users`, `/api/users/[id]`.

## Licence

MIT — see `LICENSE`.
