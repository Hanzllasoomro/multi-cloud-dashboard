# Ledger

## Multi-cloud cost, usage, and FinOps operations

Ledger is a Next.js application for understanding cloud spend across **AWS,
Azure, and GCP** in one provider-neutral workspace. It combines cost
exploration, budgets, forecasts, anomaly detection, commitments, allocation,
recommendations, data health, exports, and connected-account management.

The project is designed around one principle:

> Every number should explain where it came from, what it means, how fresh it
> is, and whether it reconciles.

Ledger is useful in two modes:

1. **Demo mode** (the default): deterministic synthetic data makes the product
   reproducible without credentials or network calls.
2. **Live mode**: configured provider connectors read billing data from AWS Cost
   Explorer, Azure Cost Management, and GCP BigQuery billing exports. The
   connectors are read-only and unconfigured providers are reported as
   **Not connected** rather than filled with fake numbers.

This repository is a product/demo implementation, not a production-ready
multi-tenant billing service. The production limitations are documented in
the [security documentation](docs/SECURITY.md#what-is-still-production-only-work-not-faked)
and summarized below.

## Contents

- [Product tour](#product-tour)
- [Core concepts](#core-concepts)
- [Architecture](#architecture)
- [Data model and query pipeline](#data-model-and-query-pipeline)
- [Demo data](#demo-data)
- [Live provider data](#live-provider-data)
- [Authentication and authorization](#authentication-and-authorization)
- [HTTP API](#http-api)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Testing and verification](#testing-and-verification)
- [Security and operational boundaries](#security-and-operational-boundaries)
- [Repository guide](#repository-guide)
- [Known limitations and next steps](#known-limitations-and-next-steps)

## Product tour

The authenticated application is organized as follows:

| Route | Purpose |
|---|---|
| `/` | Overview: month-to-date spend, provider/service/account breakdowns, trend, forecast band, budgets, anomalies, and data health |
| `/explorer` | Cost Explorer: filter, group, compare, change granularity/cost basis, drill into rows, and export the current view |
| `/budgets` | Budget and alert status, including actual versus forecast thresholds |
| `/anomalies` | Spend spikes detected with a median/MAD baseline, absolute and percentage thresholds, and top contributors |
| `/forecast` | Month-end forecast with actual-to-date, run-rate projection, and a low/high range |
| `/commitments` | Normalized AWS Savings Plans/RIs, Azure reservations/savings plans, and GCP committed-use data |
| `/recommendations` | Provider or Ledger recommendations with estimated monthly savings, effort, risk, and status |
| `/allocation` | Tag/team allocation and showback with normalized tags and reconciliation to source totals |
| `/reports` | JSON and CSV export workflows and export-safety notes |
| `/data-health` | Connection freshness, reconciliation variance, and month lifecycle |
| `/connections` | Provider onboarding, least-privilege permission guidance, and environment configuration status |
| `/settings` | Connected-account lifecycle, team members and roles, roles matrix, API/webhook placeholders, and audit log |
| `/demo` | A short guided walkthrough suitable for a product demonstration |
| `/login` | Sign in |
| `/register` | Create an account; the first account becomes the Owner |

### Typical workflow

1. Register the first user at `/register`.
2. Review the deterministic demo dashboard.
3. Use **Cost Explorer** to group spend by provider, service, account, region,
   month, or normalized tags.
4. Open **Anomalies**, **Budgets**, and **Forecast** to understand changes and
   projected month-end exposure.
5. Review **Commitments** and **Recommendations** for optimization context.
6. Configure live provider access through environment variables when real
   billing data is available.
7. Use **Connections** for onboarding guidance and **Settings** for day-to-day
   account lifecycle and role management.

For a scripted three-minute walkthrough, see [DEMO.md](DEMO.md).

## Core concepts

### One canonical cost row

Provider-native responses are mapped into a shared `CostRow` model. A row
contains:

- Provider, billing account, sub-account, service, category, region, resource,
  and SKU identity.
- Charge date and billing month.
- Billed, effective, list, and contracted cost fields.
- Usage quantity and unit.
- Currency and normalized tags.
- Charge category: `Usage`, `Purchase`, `Credit`, `Tax`, or `Adjustment`.
- Lineage fields beginning with `x_`, including source, tenant, connection,
  raw service code, ingestion time, and normalizer version.

The model is defined in [src/lib/types.ts](src/lib/types.ts). Provider quirks
are intentionally contained in the provider adapters rather than leaking into
pages and components.

### Cost basis

The query layer supports:

- **Billed**: the default invoice-oriented amount.
- **Effective**: modeled after discounts/contract effects.
- **List**: pre-discount/list-oriented amount.

The UI labels the selected basis. The query envelope also returns `meta.costBasis`
so consumers do not have to infer it.

### Trust metadata

Every query-style response has a common envelope:

```json
{
  "data": [],
  "totals": { "cost": 0, "usage": 0, "rows": 0 },
  "meta": {
    "source": "demo",
    "dataAsOf": "2026-10-26",
    "freshness": "Fresh",
    "reconciliation": "Reconciled",
    "costBasis": "billed",
    "currency": "USD",
    "estimatedMonths": ["2026-10"],
    "queryId": "q_1",
    "cache": false
  }
}
```

The UI displays freshness, month state, reconciliation, and data-as-of
information together instead of presenting a number without context.

## Architecture

### Runtime and framework

- Next.js `14.2.18` App Router
- React `18.3.1`
- TypeScript `5.5.4` with strict compilation through `tsconfig.json`
- Vitest `2.1.9`
- Node.js runtime for server routes and provider connectors
- SVG/CSS charts; no chart-library dependency is required

### Request flow

```text
Browser page
   |
   v
Next.js route handler (/api/*)
   |
   +--> authentication and permission guard
   |
   +--> demo rows OR live provider fetch
   |
   +--> account scope / paused-account filtering
   |
   +--> typed query, grouping, aggregation, comparison, top-N
   |
   v
JSON envelope -> page/component
```

Important modules:

- [src/app](src/app): pages and API route handlers.
- [src/components](src/components): application shell, cards, tables, charts,
  forms, badges, and shared UI primitives.
- [src/lib/types.ts](src/lib/types.ts): canonical domain types.
- [src/lib/data.ts](src/lib/data.ts): deterministic demo dataset and static
  demo entities.
- [src/lib/query.ts](src/lib/query.ts): filters, grouping, aggregation,
  comparisons, cost basis, tenant filtering, and response metadata.
- [src/lib/providers](src/lib/providers): provider interface, source selection,
  live aggregation, and AWS/Azure/GCP adapters.
- [src/lib/insights.ts](src/lib/insights.ts): anomalies, forecasts, and budget
  evaluation.
- [src/lib/accounts.ts](src/lib/accounts.ts): connected-account model,
  scopes, lifecycle operations, and audit entries.
- [src/lib/auth.ts](src/lib/auth.ts): password hashing, users, sessions,
  registration, login support, and role changes.
- [src/lib/auth-guard.ts](src/lib/auth-guard.ts): authoritative server-side
  authentication and permission checks.
- [src/lib/permissions.ts](src/lib/permissions.ts): role and permission
  matrix.
- [src/lib/exports.ts](src/lib/exports.ts): safe CSV and JSON serialization.
- [src/middleware.ts](src/middleware.ts): first-gate cookie presence check and
  browser/API redirects.

### UI and design

The design system is implemented with CSS variables and semantic tokens in
[src/app/globals.css](src/app/globals.css). See
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for typography, spacing, contrast,
chart, state, and accessibility rules.

The app shell provides:

- Grouped navigation and breadcrumbs.
- Demo/live data banner.
- Connected-account status banner.
- Freshness and reconciliation indicators.
- Light/dark theme toggle.
- Current user and role display.
- Logout.

## Data model and query pipeline

The query pipeline in [src/lib/query.ts](src/lib/query.ts) performs the
following steps:

1. Start with demo rows or live rows.
2. Enforce the canonical tenant ID (`demo-tenant-01` in this version).
3. Exclude paused managed-account scopes.
4. Apply provider, account, service, region, charge-category, tag, and date
   filters.
5. Group by one or more supported keys.
6. Aggregate cost, usage, and row count.
7. Add previous-period or previous-year comparison values when requested.
8. Apply `topN`, putting the remaining groups in an `Other` bucket.
9. Round display totals and return the shared response envelope.

Supported grouping keys include:

`provider`, `billingAccount`, `subAccount`, `service`, `serviceCategory`,
`region`, `chargeCategory`, `month`, `tag:team`, and `tag:env`.

The query layer is deliberately server-side. UI filters are not the security
boundary; tenant and account scope filters are applied to the data before
aggregation.

## Demo data

Demo data is generated in [src/lib/data.ts](src/lib/data.ts) with a seeded
`mulberry32` pseudo-random generator. It covers daily rows from November 2025
through October 26, 2026 for representative AWS, Azure, and GCP services,
including:

- EC2, S3, RDS, and Lambda.
- Azure Virtual Machines, Blob Storage, and SQL Database.
- GCP Compute Engine, Cloud Storage, and Cloud SQL.
- Usage, purchase, credit, and tax rows.
- Messy tag casing/whitespace and occasional untagged values.
- A seeded EC2 spike in March 2026 for anomaly detection.
- A seeded Azure VM spike in July 2026.
- A July EC2 restatement note for lineage/audit demonstrations.

Because the generator is seeded, screenshots, tests, and product demos can be
repeated without external services. Demo mode makes no provider network calls.

The seeded connected-account store contains AWS, Azure, and GCP examples.
Account records and audit entries are currently in memory and reset when the
server restarts. Pausing an account excludes its covered sub-account rows from
query totals; removing a demo account with `purge` records the action but does
not delete shared synthetic rows.

## Live provider data

Set `LEDGER_DATA_SOURCE=live` to enable live fetching. Each configured
connector is called independently. If one provider fails, the response keeps
successful rows and returns a generic `liveErrors` entry for the failed
provider. If a provider is not configured, it contributes no rows and appears
as **Not connected**.

### AWS

The AWS connector uses Cost Explorer `GetCostAndUsage`, daily granularity, and
groups by `SERVICE` and `LINKED_ACCOUNT`. It reads `BlendedCost` and
`UsageQuantity`. This connector honestly reports region as `global`; regional
fidelity requires the FOCUS/CUR export path.

### Azure

The Azure connector calls the Cost Management Query REST API for daily
`ActualCost`, grouping by service, resource location, and charge type. Refunds
become credits, purchases become purchases, taxes become taxes, and unknown
charge types become adjustments.

### GCP

The GCP connector uses the BigQuery REST query path against a billing export.
It maps service, project, location, usage, currency, cost type, and labels.
GCP billing exports are not retroactive; history starts when the export is
enabled.

Live setup, permissions, scopes, reconciliation tolerances, and troubleshooting
are described in [docs/REAL_ACCOUNTS.md](docs/REAL_ACCOUNTS.md). The AWS
least-privilege policy is in
[docs/aws-iam-policy.json](docs/aws-iam-policy.json).

## Authentication and authorization

### Creating the first account

1. Start the application.
2. Open `/register`.
3. Use a password of at least 12 characters that is not a common password.
4. The first registered account becomes **Owner**.
5. Later registrations become **Viewer** accounts.
6. An Owner or Admin can change roles in Settings.

There is no seeded administrator account. If the local auth store is intentionally
wiped, the next registration becomes the Owner again.

### User/session storage

Users and sessions are persisted locally to `.ledger-data/auth.json` by
default. Set `LEDGER_AUTH_FILE` to override the path. The file is ignored by
Git and stores only scrypt password hashes and server-side session data, never
plaintext passwords.

Persistence is disabled during tests. Account management data is a separate
in-memory demo store and is not durable yet.

### Security behavior

- Passwords use Node `scrypt` with a per-user random salt.
- Sessions use random 256-bit tokens.
- The browser receives an `httpOnly`, `SameSite=Lax` cookie.
- Production cookies also use `Secure`.
- Sessions expire after 24 hours.
- Login failures are rate-limited to five attempts per email/IP in 15 minutes.
- Login errors are intentionally generic.
- Auth POST routes validate `Origin` against `Host` when an Origin is present.
- API routes perform server-side role checks; hiding a UI control is not
  authorization.
- The middleware only checks cookie presence because it runs in the edge
  runtime. Route handlers validate the token and role authoritatively.
- The `/api/source` endpoint exposes only environment-variable presence and
  missing variable names, never secret values.

Roles are:

| Role | Main capabilities |
|---|---|
| Owner | All permissions, including plan, members, connections, budgets, allocation, exports, API keys, and audit |
| Admin | Members, connections, all data, budgets, allocation, exports, API keys, and audit |
| FinOps Manager | Connections, all data, budgets, allocation, exports, and API keys |
| Analyst | All data, budgets, and exports |
| Viewer | Scoped data access and scoped exports only |
| Auditor | All data, exports, and audit |

See [src/lib/permissions.ts](src/lib/permissions.ts) for the authoritative
matrix and [docs/SECURITY.md](docs/SECURITY.md) for the threat model.

## HTTP API

All protected endpoints require the `ledger_session` cookie. Most responses
use the shared `data`/`totals`/`meta` envelope.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/status` | Public bootstrap status: whether users exist and whether demo auth is enabled |
| `POST` | `/api/auth/register` | Register a user and create a session |
| `POST` | `/api/auth/login` | Authenticate and create a session |
| `GET` | `/api/auth/me` | Return the current public user |
| `POST` | `/api/auth/logout` | Destroy the current session and clear the cookie |
| `POST` | `/api/auth/demo` | Create a Viewer demo session when `LEDGER_DEMO_AUTH=true` |

### Cost and insights

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/query` | Filter and aggregate cost rows |
| `GET` | `/api/anomalies` | Calculate anomalies |
| `GET` | `/api/budgets` | Evaluate demo budgets |
| `GET` | `/api/forecast` | Return forecast points |
| `GET` | `/api/commitments` | Return normalized commitments |
| `GET` | `/api/recommendations` | Return recommendations |
| `GET` | `/api/data-health` | Return connection health and reconciliation metadata |
| `GET` | `/api/connections` | Return connection summary data |
| `GET` | `/api/source` | Return source mode and provider env presence |

Example query:

```text
/api/query?groupBy=service&provider=AWS&start=2025-11-01&end=2026-10-26&costBasis=billed&topN=10
```

Supported query parameters include `groupBy`, `provider`, `accounts`,
`accountId`, `service`, `start`, `end`, `costBasis`, and `topN`. `accountId`
uses managed-account IDs and expands their configured scopes; `accounts` uses
sub-account names directly.

### Managed accounts and team members

| Method | Endpoint | Required permission | Description |
|---|---|---|---|
| `GET` | `/api/accounts` | Authenticated | List account identifiers and scopes; never credentials |
| `POST` | `/api/accounts` | `manageConnections` | Add a pending account |
| `PATCH` | `/api/accounts/:id` | `manageConnections` | Edit display name/scope or pause/resume |
| `DELETE` | `/api/accounts/:id?confirm=...&data=keep\|purge` | `manageConnections` | Typed-confirmation removal |
| `POST` | `/api/accounts/:id/test` | `manageConnections` | Run provider permission checklist |
| `GET` | `/api/accounts/audit` | `viewAudit` | Read append-only account audit entries |
| `GET` | `/api/users` | `manageMembers` | List public team members |
| `PATCH` | `/api/users/:id` | `manageMembers` | Change a role; cannot demote the last Owner |

## Local development

### Prerequisites

- Node.js compatible with the installed Next.js 14 toolchain.
- npm.

### Install

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then register an account
at `/register`.

### Production-like local run

```bash
npm run build
npm run start
```

### Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm test` | Run the Vitest suite once |
| `npm run typecheck` | Run TypeScript without emitting files |

## Configuration

Copy [.env.example](.env.example) to `.env.local` for local configuration.
Never commit `.env.local` or credential values.

### Application variables

| Variable | Values | Default / purpose |
|---|---|---|
| `LEDGER_DATA_SOURCE` | `demo` or `live` | Defaults to `demo` |
| `LEDGER_DEMO_AUTH` | `true` | Enables the Viewer-only demo sign-in button; keep disabled for real deployments |
| `LEDGER_AUTH_FILE` | File path | Defaults to `.ledger-data/auth.json` |
| `NODE_ENV` | Environment name | Next.js/runtime behavior |

### Provider variables

| Provider | Required variables |
|---|---|
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; `AWS_REGION` defaults to `us-east-1` |
| Azure | `AZURE_SUBSCRIPTION_ID`, `AZURE_ACCESS_TOKEN` |
| GCP | `GCP_PROJECT_ID`, `GCP_BIGQUERY_DATASET`, `GCP_ACCESS_TOKEN`; `GCP_BIGQUERY_TABLE` is optional |

Prefer short-lived tokens, workload identity federation, service-account
impersonation, or assumed roles over long-lived static credentials. Provider
credentials are read server-side only.

## Deployment

### Render

[render.yaml](render.yaml) defines a Node web service:

```text
Build:  npm install && npm run build
Start:  npm run start
Source: demo
```

Set production secrets in the platform's environment configuration, not in
the repository. If using the file-backed auth store, the deployment must
provide durable single-instance storage; otherwise use a real database before
relying on it for account persistence.

### Vercel

[vercel.json](vercel.json) configures Next.js build, install, and development
commands. The same production limitations apply: local file-backed auth and
in-memory connected accounts are not a durable multi-instance persistence
strategy.

## Testing and verification

The test suite is in [tests](tests) and covers:

- Registration, first-Owner behavior, password validation, sessions, rate
  limiting, role changes, and last-Owner protection.
- Account lifecycle and scope behavior.
- Query filters, grouping, totals, cost basis, comparisons, and exports.
- Provider mapping and BigQuery response parsing.
- Anomaly and insight calculations.

Run the focused checks:

```bash
npm test
npm run typecheck
npm run build
```

When testing live providers, start with a small date range and compare one
provider total with its console. The safe live-account checklist is in
[docs/REAL_ACCOUNTS.md](docs/REAL_ACCOUNTS.md).

## Security and operational boundaries

Ledger is intentionally honest about what is and is not implemented:

- Cloud connectors are read-only and do not write, stop, or delete cloud
  resources.
- Credentials are not stored in connected-account records.
- No MFA/TOTP/WebAuthn is implemented.
- No email password-reset flow is implemented.
- No SSO/SCIM integration is implemented.
- The connected-account store and audit store are in memory.
- The demo tenant is single-tenant. Full `tenant_id` isolation, database-backed
  persistence, and database row-level security are future production work.
- The demo dataset is synthetic and must not be described as customer billing.
- A live provider that is not configured never contributes synthetic fallback
  rows.

Read [docs/SECURITY.md](docs/SECURITY.md) before exposing the application to
untrusted users and [docs/REAL_ACCOUNTS.md](docs/REAL_ACCOUNTS.md) before
configuring a cloud account.

## Repository guide

```text
.
├── src/
│   ├── app/                  Pages and /api route handlers
│   ├── components/           App shell, charts, cards, tables, and UI
│   ├── lib/
│   │   ├── providers/        AWS, Azure, GCP connectors and mappers
│   │   ├── auth.ts           Users, sessions, password hashing
│   │   ├── auth-guard.ts     Server-side auth and RBAC enforcement
│   │   ├── accounts.ts       Managed accounts and audit entries
│   │   ├── data.ts           Seeded demo rows and static demo entities
│   │   ├── insights.ts       Forecast, anomaly, and budget logic
│   │   ├── query.ts          Query/filter/aggregation pipeline
│   │   ├── types.ts          Canonical domain model
│   │   └── exports.ts        CSV/JSON export serialization
│   └── middleware.ts         Cookie-presence first gate
├── tests/                    Vitest tests
├── docs/                     Security, real-account, and IAM guidance
├── DEMO.md                   Three-minute demo script
├── DESIGN_SYSTEM.md          UI and accessibility system
├── IMPLEMENTATION_PLAN.md    Product implementation plan
├── render.yaml               Render deployment definition
├── vercel.json               Vercel configuration
└── package.json              Scripts and dependencies
```

## Known limitations and next steps

The natural production path is:

1. Replace [src/lib/accounts.ts](src/lib/accounts.ts) with a database-backed
   account, scope, and audit repository.
2. Replace file-backed auth with a transactional user/session database or a
   managed identity provider.
3. Add tenant IDs and database-level row-level security to every persisted
   data table.
4. Add MFA and an audited password-reset workflow.
5. Implement durable ingestion jobs, provider-specific pagination, retries,
   credential rotation, and scheduled freshness checks.
6. Add real export job persistence and delivery.
7. Add provider-native recommendation ingestion and realized-savings
   verification.
8. Add integration tests using controlled provider fixtures and a staging
   account with read-only permissions.

The implementation plan and security document describe the broader product
intent; this README describes the behavior that exists in the current code.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
