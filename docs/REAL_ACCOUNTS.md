# Testing with real accounts — read-only, safely

Ledger is **read-only by default**. Nothing in this app writes to, stops, or
deletes anything in your cloud accounts. The only live calls are cost reads.

## Mode switch

```
LEDGER_DATA_SOURCE=demo   # default: deterministic synthetic data
LEDGER_DATA_SOURCE=live   # real providers, configured ones only
```

In live mode an unconfigured provider shows **"Not connected"** in the header
banner and on `/connections` — never fake numbers. `/api/source` reports only
env-var *presence* (booleans + missing names), never values.

## Env vars needed to go live (names only — never commit values)

| Provider | Env vars |
|---|---|
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (default `us-east-1`) |
| Azure | `AZURE_SUBSCRIPTION_ID`, `AZURE_ACCESS_TOKEN` |
| GCP | `GCP_PROJECT_ID`, `GCP_BIGQUERY_DATASET`, `GCP_ACCESS_TOKEN` (+ optional `GCP_BIGQUERY_TABLE`) |

Copy `.env.example` to `.env.local` (git-ignored by Next.js convention; do not
commit it) and fill values there. Tokens: prefer short-lived tokens
(`az account get-access-token`, `gcloud auth print-access-token`, or an assumed
role) over long-lived keys.

## AWS — Cost Explorer (read-only)

1. Create an IAM role (or user, for a quick test only) with the policy in
   `docs/aws-iam-policy.json`. It allows only: `ce:GetCostAndUsage`,
   `ce:GetCostForecast` (optional), `organizations:ListAccounts` (optional,
   member discovery), `s3:GetObject` on your billing-export prefix only (only
   if you also use CUR/FOCUS exports), `sts:GetCallerIdentity`.
2. Prefer a cross-account role with a **unique `ExternalId` per connection**
   (confused-deputy defence) over static keys in production.
3. Activate user-defined cost-allocation tags in Cost Explorer first, or they
   never appear in cost data. Consolidated billing needs the payer account.
4. **Limit of this connector:** Cost Explorer grouping here is SERVICE +
   LINKED_ACCOUNT, so region shows as `global`. For per-region fidelity use the
   FOCUS/CUR export path (S3) described in the README.

## Azure — Cost Management Reader (read-only)

1. Register an Entra app (or use `az login` for a personal test) and assign at
   the billing-account / subscription scope: **Cost Management Reader**,
   **Reader** (inventory only), **Monitoring Reader** (optional, utilisation),
   **Storage Blob Data Reader** on the export container only (if using exports).
2. Set `AZURE_SUBSCRIPTION_ID` and a bearer token from
   `az account get-access-token --resource https://management.azure.com/`.
3. Handle EA / MCA / pay-as-you-go / CSP differences; CSP cost access may be
   restricted — the app surfaces the HTTP error instead of inventing data.

## GCP — BigQuery billing export (read-only)

1. Enable **billing export to BigQuery** (detailed + pricing) in your project.
   **Exports are not retroactive** — history starts when the export is enabled.
2. Grant the reader identity **BigQuery Data Viewer** on the billing dataset
   only, plus **BigQuery Job User** (or extract to Cloud Storage to avoid
   customer query charges). Prefer Workload Identity Federation / service-account
   impersonation over a key file.
3. Set `GCP_PROJECT_ID`, `GCP_BIGQUERY_DATASET`, and a token from
   `gcloud auth print-access-token`. Override the table with
   `GCP_BIGQUERY_TABLE` if your export table name differs from
   `gcp_billing_export_resource_v1`.

## Test safely (checklist)

- [ ] Read-only roles only; confirm no write permission is granted anywhere.
- [ ] Small date range first (e.g. last 7 days) via `/api/query?start=…&end=…`.
- [ ] Compare one total against the provider console (AWS Cost Explorer total,
      Azure Cost Management total, GCP invoice/BigQuery sum) — tolerance:
      open months 0.5%, final months 0.01% per billing account.
- [ ] Check `/api/source` shows only the providers you configured.
- [ ] Revoke the token/role afterwards if it was a throwaway test credential.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `AWS not configured; missing: …` | Env var absent in the server process | Set it in `.env.local`, restart the server (Next.js reads env at start) |
| Azure HTTP 403 | Token lacks Cost Management Reader, or wrong scope | Re-assign the role at the billing scope; refresh the token |
| Azure HTTP 401 | Expired token | Tokens are short-lived — get a fresh one |
| GCP HTTP 404 | Dataset/table name wrong | Set `GCP_BIGQUERY_TABLE` to the full table id |
| GCP: no history before a date | Export enabled later | Expected — GCP exports are not retroactive |
| Live query returns 0 rows | No provider configured, or range before export start | Check `/api/source`; widen/narrow the range |
| Totals differ from console | Credits/tax/timing, or Cost Explorer vs invoice basis | See README reconciliation tolerances; Billed basis ties to invoice |
| A secret appears in logs | Bug — report it | Connectors never log credentials; grep logs and rotate the credential |

## Account lifecycle (Settings › Connected accounts)

Accounts are managed in Settings, not in the wizard: the Connections page
onboards (IaC + permission reasons); Settings adds, edits, pauses, tests and
removes accounts day to day.

| From | Action | To | What happens |
|---|---|---|---|
| — | Add account (provider, display name, identifier, billing account, scope) | Pending | No credentials are asked for or stored — live credentials stay in server env vars only. |
| Pending | Test connection | Validating → Healthy / Degraded / Broken | Per-permission checklist; every failure names its fix. Demo mode: simulated checklist, labelled as such. Live mode: env-presence check (variable names only). |
| Healthy / Degraded | Pause | Paused | Rows for that account's scope are excluded from `/api/query` totals; the header and Overview banner name the paused account. |
| Paused | Resume | Previous status (e.g. Degraded) | Pre-pause status is restored, not silently flipped to Healthy. |
| Any | Edit | Same status | Display name and scope (sub-accounts, tags, teams) only; provider and identifier cannot change. |
| Any | Remove (typed confirmation) | Gone | You must type the display name exactly. Choose **keep** (historical data stays, no new ingestion) or **purge** (a purge job deletes the account's rows in production; in this version demo rows are a shared synthetic dataset, so purge is recorded in the audit log but does not delete other accounts' demo rows). |
| — | Broken | Fix + re-test | Revoking a role flips a connection to Broken within one health-check interval and raises an alert; re-test after re-applying the permission. |

Every add, edit, pause, resume, test and remove writes an append-only audit
entry (who, when, what) shown in Settings › Audit log and at
`GET /api/accounts/audit`. The account store itself is in-memory in this
version and resets on server restart — a database replaces that one module
later; the API shapes and audit format do not change.
