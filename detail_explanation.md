# Ledger — Detailed Explanation

> **For viewers, judges, new contributors, and anyone opening this repo
> for the first time.** This document explains *everything* about the
> project in one place: what it is, what problem it solves, what every
> page does, how the data works, how security works, how to run and
> test it, and — just as importantly — what it does **not** do yet.
>
> **Current version:** 1.5.1 · **Stack:** Next.js 14 (App Router) +
> TypeScript (strict) + React 18 · **Charts:** hand-built SVG, no
> chart library · **Tests:** 46 Vitest tests, all passing ·
> **Licence:** MIT · **Repo:**
> https://github.com/Hanzllasoomro/multi-cloud-dashboard
>
> **Start here if you only have 3 minutes:** open `/demo` in the app
> and follow its six steps (connect → one number → March EC2 spike →
> budget breach → savings → export/reconcile). The full script is in
> `DEMO.md`. If you only read one more section, read
> ["Is the data real?"](#is-the-data-real-demo-vs-live) — it is the
> most important honesty note in this document.

## Contents

- [1. What is Ledger?](#1-what-is-ledger)
- [2. The problem it solves](#2-the-problem-it-solves)
- [3. Is the data real? Demo vs live](#3-is-the-data-real-demo-vs-live)
- [4. A tour of every page](#4-a-tour-of-every-page)
- [5. Demo Studio: changing the demo story](#5-demo-studio-changing-the-demo-story)
- [6. How the platform is built (architecture)](#6-how-the-platform-is-built-architecture)
- [7. The data: FOCUS model and the seeded dataset](#7-the-data-focus-model-and-the-seeded-dataset)
- [8. How the analytics work](#8-how-the-analytics-work)
- [9. Accounts, authentication and authorisation](#9-accounts-authentication-and-authorisation)
- [10. API reference](#10-api-reference)
- [11. Design system and user interface](#11-design-system-and-user-interface)
- [12. How to run it](#12-how-to-run-it)
- [13. How to test it](#13-how-to-test-it)
- [14. Deployment](#14-deployment)
- [15. Project structure](#15-project-structure)
- [16. Limitations and known simplifications (read before judging)](#16-limitations-and-known-simplifications-read-before-judging)
- [17. Roadmap: what comes next](#17-roadmap-what-comes-next)
- [18. Frequently asked questions](#18-frequently-asked-questions)
- [19. Other documents and version history](#19-other-documents-and-version-history)

---

## 1. What is Ledger?

**Ledger is a multi-cloud cost and usage platform.** It brings the
billing and usage of Amazon Web Services (AWS), Microsoft Azure, and
Google Cloud Platform (GCP) into **one number, one currency, one cost
basis** — so a finance or engineering team can answer, in one place,
"why did our cloud bill go up?", "are we going to breach budget?",
"what is wasting money?", and "which team spent what?".

In plain terms, it is the single dashboard a company wishes it had
instead of three separate cloud consoles that never agree with each
other. It is **read-only by design**: it reads billing data, it never
changes, starts, stops, or deletes anything in your cloud accounts.

**Who is it for?**

- **FinOps / finance teams** — one reconciled bill, budgets that warn
  *before* the money is spent, and exports that tie back to invoices.
- **Engineering / platform teams** — per-service, per-account, per-team
  and per-region breakdowns, anomaly alerts, and rightsizing
  recommendations.
- **Managers / judges / reviewers** — a 3-minute walkthrough (`/demo`)
  that shows the whole story without needing a real cloud account.

**What kind of software is it?** A web application (a Next.js app you
open in a browser), not a desktop program, not a mobile app, and not a
cloud service you subscribe to. You run it on your own machine or host
it yourself (see [Deployment](#14-deployment)).

## 2. The problem it solves

A company that uses more than one cloud provider hits the same pain
every month:

1. **Three bills, three languages.** AWS calls it Cost Explorer, Azure
   calls it Cost Management, GCP calls it a billing export. The
   columns, currencies, discounts and tax treatments all differ.
2. **No single total.** "How much did we spend on cloud last month?"
   becomes a spreadsheet exercise, and two people get two answers.
3. **Surprises, not warnings.** A budget breach is usually discovered
   *after* the invoice arrives, when it is too late to act.
4. **Spikes with no story.** A bill jumps 48% and nobody can say
   which service, account, or region caused it, or whether it was
   expected.
5. **Savings nobody acts on.** Idle machines, unattached disks and
   uncovered commitments sit unnoticed because the recommendations
   live in three different advisors.
6. **Unfair allocation.** Shared costs (support, tax) and messy tags
   ("Prod", " prod ", "PROD", blank) make "which team spent what?"
   unreliable.

Ledger's answer, in one sentence: **normalise everything once into a
single canonical model (FOCUS-inspired, see
[Section 7](#7-the-data-focus-model-and-the-seeded-dataset)), then
build every view — totals, charts, budgets, anomalies, forecasts,
allocations, recommendations — on top of that one model, with
freshness and reconciliation state shown on every figure.**

Design principles behind that answer (from the original plan, kept
throughout the build):

- **Numbers first; trust visible.** Every figure carries "data as of",
  freshness (Fresh / Delayed / Stale / Failed), month state
  (Estimated / Provisional / Final) and reconciliation
  (Reconciled / Variance / Unable to verify).
- **Explain, don't just show.** An anomaly states its method in plain
  words; a forecast states its method; a connection permission states
  *why* it exists.
- **Never colour alone.** Cost up is red *and* has an ▲ arrow and a
  number; cost down is green *and* ▼; status always has text, never
  colour only. This is also an accessibility rule.
- **One way to do one thing.** One query engine, one chart adapter,
  one auth guard — views never re-implement the same logic.
- **Read-only, least privilege.** Connections use read-only roles,
  federation over static keys, and no secret is ever stored in code,
  logged, or returned by an API.

## 3. Is the data real? Demo vs live

**This is the most important section for a viewer. Read it before
believing any number in a screenshot.**

By default, **the app shows deterministic demo data** — a synthetic
dataset generated by code (`src/lib/data.ts`) that always produces
the same numbers. It is labelled "Demo data" in a banner on every
page, and the walkthrough page says so in plain words. It is *not*
real billing from a real cloud account, and it must never be
presented as such. Demo Studio scenarios (Section 5) change this
demo story; they do not create real billing either.

**Live mode exists and is real code, but it has never been run
against a real cloud account in this environment** (no credentials
exist here, and none were ever requested in chat). To use it, you set
`LEDGER_DATA_SOURCE=live` plus provider environment variables on your
own machine (see `docs/REAL_ACCOUNTS.md`). In live mode:

- A configured provider contributes its real rows.
- An **unconfigured provider contributes nothing and is reported as
  "Not connected"** — it is never filled in with fake numbers.
- Demo Studio saving is **blocked** (HTTP 409), so a demo scenario
  can never be mistaken for live billing.

In short: **demo = a realistic, labelled story for showing and
testing the platform. Live = real provider data, only on a machine
you configure yourself, with read-only credentials you control.**
Never paste a cloud key into chat, into the app's forms, or into a
file that gets committed — live credentials live in server
environment variables only.

## 4. A tour of every page

The app has 16 pages (plus login/register). All pages share one shell:
a pale warm-gray canvas, one white rounded frame, a grouped sidebar
(Menu / General), a top bar with search, freshness, theme toggle and
a user chip, and the Demo/Live banner plus a connected-accounts
banner on every page.

| Page (route) | What it is for | What you will see there |
|---|---|---|
| **Overview** (`/`) | The home dashboard | Month-to-date spend (dark-green hero card), month-end forecast, potential savings, open anomalies, trend + forecast band, provider donut, top services, top accounts, budget meters, latest anomalies, data-health table, cost-per-day (unit economics) |
| **Cost Explorer** (`/explorer`) | Ask any cost question | Filter by date, provider, account, service, region, tag, cost basis and currency; group by provider/service/account/region/tag; compare to previous period; trend chart + breakdown bars + detail table; **CSV and JSON export** of exactly the filtered view |
| **Connections** (`/connections`) | Onboard a cloud, read-only | Per-provider connection cards with status/freshness/variance, plus copyable IaC snippets: AWS CloudFormation (least-privilege role), Azure Bicep (Entra app + roles), GCP gcloud (BigQuery export) — every permission listed with its reason |
| **Budgets** (`/budgets`) | Stop overspend before it happens | Three budgets (Total cloud $22,000/mo, AWS production $12,000/mo, Engineering teams $9,000/mo) with progress meters, forecast vs amount, and state (OK / Triggered). See the "Triggered" note in Section 8 |
| **Anomalies** (`/anomalies`) | Find the spike | Median/MAD anomaly cards: service, date, actual vs expected, delta %, severity, top contributing regions, method in plain words; filter by severity |
| **Forecast** (`/forecast`) | Where the month ends | October month-end forecast with low–high band, actual-vs-forecast chart, and a monthly forecast table with the method stated for each month |
| **Commitments** (`/commitments`) | Savings Plans / reservations / CUDs | AWS Savings Plan, Azure reservation and GCP committed-use discount in one normalised view: term, utilisation, coverage, savings rate, unused cost |
| **Recommendations** (`/recommendations`) | What to fix, and what it saves | Rightsizing, idle-resource, storage-tier and commitment recommendations with monthly savings (provider estimates, labelled as such), effort, risk and status; open recommendations total **$5,100/month** in the seeded demo |
| **Allocation** (`/allocation`) | Which team spent what | Allocation by team (tags normalised: case + whitespace), reconciliation proof (allocated + untagged = source total, nothing lost or doubled), and the four allocation rules |
| **Reports** (`/reports`) | Exports, done properly | Export job templates and format notes: exported totals always equal on-screen totals; spreadsheet formula-injection is neutralised (cells starting with `=`, `+`, `−` or `@` are escaped) |
| **Data Health** (`/data-health`) | Can you trust this month's data? | Per-connection freshness and variance (Azure is Degraded/Delayed at 0.68% variance — above the 0.5% open-month tolerance), variance breakdown, and the month lifecycle (Estimated → Provisional → Final, with publish gates) |
| **Settings** (`/settings`) | Run the platform | Connected accounts (add/edit/pause/resume/test/remove), team members and roles, roles matrix, API keys (hashed, never returned after creation), and the append-only audit log |
| **Demo walkthrough** (`/demo`) | The 3-minute story | Six steps: connect → one number → March EC2 spike → budget breach → savings → export/reconcile, with live numbers from the current (possibly scenario-adjusted) data |
| **Demo Studio** (`/demo-studio`) | Change the demo story | See Section 5 — multipliers, presets, extra demo accounts, and the "what changes" impact panel |
| **Login / Register** (`/login`, `/register`) | Sign in | Modern login/register UI (shadcn-style components on Ledger tokens — see Section 11). First registered user becomes Owner; later users start as Viewers |

### The 3-minute walkthrough, step by step

1. **Connect — read-only, least privilege.** One connection per
   cloud, read-only roles only, federation over static keys.
2. **See all clouds in one number.** Month-to-date spend across AWS,
   Azure and GCP: **$19,848.69** (October 2026, estimated, baseline
   demo) — one number, one currency, one cost basis (Billed, so it
   ties to invoices).
3. **Find the March EC2 spike.** Amazon EC2: actual **$6,525** vs
   expected **$4,395** (+48% over baseline), median/MAD method,
   Purchase charges excluded so savings-plan buys never look like
   spikes.
4. **Budget breach, before it happens.** Total-cloud forecast
   **$17,796** against a $22,000 budget — the alert fires on
   *forecast* (at the 80% threshold), not after the money is spent.
5. **Savings you can act on.** Open recommendations total
   **$5,100/month** (provider estimates, labelled as such), each
   linked to its resource and evidence.
6. **Export and reconcile.** Export the exact filtered view as CSV
   or JSON from the Explorer; totals in the export equal totals on
   screen, and every figure carries data-as-of, freshness and
   reconciliation state.

## 5. Demo Studio: changing the demo story

Demo Studio (`/demo-studio`, sidebar → General) is a **separate
control panel for demo data only** — it is not part of the dashboards
themselves, and it is not a way to edit real billing. Think of it as
the "director's console" for a presentation or a test run: change the
story in Studio, save, reload a dashboard tab, and the new story is
live everywhere.

### What you can change

- **Multipliers (0–10, they combine by multiplication).**
  Global (everything) × provider × account × service. A multiplier
  of 0 makes that slice $0 — useful to simulate an account or service
  disappearing. A multiplier of 2 doubles it.
- **Presets (one click, then Save).** Original seeded demo; Growth
  story (everything ×1.4); EC2 spike story (Amazon EC2 ×2);
  Savings story (everything ×0.7).
- **Extra demo accounts (up to 5).** Give a provider, a sub-account
  name, a service and a monthly base (up to $1,000,000), and Studio
  generates a full 12 months of daily demo rows for it, so it appears
  in Top accounts, the provider donut, totals, budgets and forecasts
  — not just as a label.

### What clicking a preset shows (v1.5.1)

Clicking a preset does not just change the totals. Studio immediately
shows a **"What this preset changes"** panel, computed from the same
rows the dashboards use:

- A count of options **going up ▲** (red, cost up), **going down ▼**
  (green, cost down), **unchanged**, and **added ✚**.
- The exact multipliers that changed (e.g. "Everything ×1.4 ▲ up").
- Three tables — **by provider, by fake account, by service** — each
  with **Original → With this draft → Change ($ and %)**. A new
  extra account shows as $0 → its preview total, labelled "new",
  never as a percentage.
- Changed multiplier fields are highlighted in the form itself
  (red tint + ▲ up above ×1, green tint + ▼ down below ×1). The
  clicked preset button turns solid; editing any field by hand
  clears that highlight, so the panel always describes the draft on
  screen, not the preset clicked earlier. If the panel says "Nothing
  changes", the draft *is* the original demo.

### Rules that keep Studio honest

- **Demo mode only.** Saving is blocked (409) in live mode.
- **Cost and usage scale together**, and every scaled row keeps its
  original date, service, account, tags and lineage — so charts,
  tables, budgets, forecasts and anomalies stay internally
  consistent. No single fake invoice line is invented.
- **Recommendations and commitments are NOT scaled** (they are
  static demo lists), so a scenario never invents savings.
- **Roles:** any signed-in user may read a scenario; only Owner,
  Admin or FinOps Manager may save or reset it (enforced server-side,
  not just by hiding buttons).
- **Persistence:** the scenario is saved to
  `.ledger-data/demo-scenario.json` on the machine running the
  server (gitignored, no credentials inside). It **survives a server
  restart** — verified by test — but it **does not travel with a
  `git pull`**. Always set the scenario up on the presentation
  machine itself.
- **Reset in one click** returns to the original seeded demo.

Full Studio docs: `docs/DEMO_STUDIO.md`. Full test scenarios with
verified expected numbers: `docs/DEMO_STUDIO_TESTING.md` (8
scenarios, summarised in [Section 13](#13-how-to-test-it)).

## 6. How the platform is built (architecture)

### The big picture

```
Browser pages (React, client components)
  │  render seeded rows directly (demo)  ·  fetch /api/* for accounts,
  │  scenario, users, and (in live mode) query results
  ▼
Next.js App Router — pages in src/app, API routes in src/app/api
  │
  ├─ DEMO path ──► src/lib/data.ts  (deterministic synthetic rows)
  │                 └─ + Demo Studio scenario (src/lib/demo-scenario.ts)
  │                      applied in demo mode, before filtering
  │
  ├─ LIVE path ──► src/lib/providers/  (AWS / Azure / GCP connectors)
  │                 Cost Explorer · Cost Management Query · BigQuery REST
  │                 └─ common interface: validate / fetchCosts / toFocusRows
  │
  └─ Both paths ─► src/lib/query.ts  (typed query DSL: filter → group
                      → aggregate → topN + "Other" → envelope)
                      └─ tenant filter is mandatory, never UI-only
                      └─ paused accounts excluded (API path)
  ▼
Shared libraries: insights (anomalies/forecast/budgets) · accounts ·
auth + permissions · exports · format · charts (hand-built SVG)
```

### Request flow, step by step (demo mode, Overview page)

1. The browser loads `/`. The shell (`AppShell`) checks the session
   (via `/api/auth/me`); without a valid session it redirects to
   `/login` (middleware checks only that a session cookie is
   *present*; the authoritative check is in `auth-guard.ts`).
2. The page takes the seeded rows (`allRows()`), fetches the saved
   demo scenario from `/api/demo-scenario`, and — if one is active —
   applies it (`applyScenario`: multipliers + extra accounts).
3. From those rows it derives everything on screen: monthly totals,
   month-to-date, forecast, anomalies, budgets, provider/service/
   account groupings. No page re-implements the query logic; the
   Explorer and Allocation pages use the same `runQuery` engine.
4. The API path (`/api/query`, `/api/budgets`, `/api/anomalies`,
   `/api/forecast`) does the same thing server-side: seeded rows →
   scenario (demo only) → paused-account exclusion → query engine →
   `{ data, totals, meta }` envelope.

### Live-mode flow (same shape, different source)

1. `LEDGER_DATA_SOURCE=live` is set on the server.
2. `/api/source` reports which providers are configured (booleans and
   missing env-var *names* only — never values).
3. `fetchLiveRows` calls only configured providers, maps each
   provider's native shape into FOCUS rows, and reports unconfigured
   providers / errors instead of inventing rows.
4. Everything downstream (query, budgets, anomalies, forecast) is
   identical — that is the point of the canonical model.

### Key modules (where the logic lives)

| Module | Job |
|---|---|
| `src/lib/types.ts` | Canonical FOCUS-inspired row, query inputs, envelopes, budgets, anomalies, forecasts, recommendations, commitments — the contract everything else honours |
| `src/lib/data.ts` | Deterministic seeded dataset (mulberry32 PRNG, fixed seed), monthly totals, month cost, seeded connections, commitments, recommendations, allocation rules |
| `src/lib/query.ts` | Typed query DSL: mandatory tenant filter, provider/account/service/region/tag/date filters, grouping, aggregation, topN + Other, previous-period comparison, meta envelope |
| `src/lib/insights.ts` | Anomaly detection (median/MAD), month-end forecast, budget evaluation — see Section 8 |
| `src/lib/demo-scenario.ts` | Scenario model, validation, presets, scaling, extra-account row generation, impact breakdown (up/down/same/new) — pure, client-safe |
| `src/lib/demo-scenario-store.ts` | File-backed scenario store (atomic save, corrupt-file quarantine, disabled under Vitest) — server-only |
| `src/lib/accounts.ts` | Connected-accounts store, scopes, pause/resume, test-connection checklists, audit log (in-memory — see Section 16) |
| `src/lib/auth.ts` | Users/sessions, scrypt hashing, lockout, origin check; file-backed store (see Section 9) |
| `src/lib/auth-guard.ts` + `src/lib/permissions.ts` | Server-side session + role enforcement; the single source of truth for the roles matrix |
| `src/lib/providers/` | AWS (Cost Explorer SDK), Azure (Cost Management REST), GCP (BigQuery REST), common interface, fixtures and mapping tests |
| `src/lib/exports.ts`, `src/lib/format.ts` | CSV/JSON export (with formula-injection escaping) and money/date formatting (compact vs full, tabular numbers, true minus) |
| `src/components/` | Shell, KPI cards, hand-built SVG charts (line/bar/donut), tables, filter bar, badges, budget meters, anomaly/recommendation/connection cards, shadcn-style UI primitives in `components/ui/` |

## 7. The data: FOCUS model and the seeded dataset

### The canonical row (FOCUS-inspired)

Every cost line, demo or live, is normalised into one shape
(`src/lib/types.ts`). The most important fields:

| Field | Meaning |
|---|---|
| `provider`, `billingAccount`, `subAccount` | Cloud, payer/billing account, and AWS account / Azure subscription / GCP project |
| `service`, `serviceCategory`, `region`, `resourceId`, `skuId` | What was used, what kind, where, which resource, which price SKU |
| `chargeCategory` | `Usage` / `Purchase` / `Credit` / `Tax` / `Adjustment` |
| `chargePeriod`, `billingPeriod` | Charge date (UTC, `YYYY-MM-DD`) / invoice month (`YYYY-MM`) |
| `billedCost`, `effectiveCost`, `listCost`, `contractedCost` | Billed = invoice amount; Effective = amortised; List = pre-discount; Contracted = after negotiated rates |
| `usageQuantity`, `usageUnit` | How much was used (hours, GB-months, requests, …) |
| `tags` | Team/env/project tags — normalised for grouping, original value kept on the row |
| `commitmentId` | Savings Plan / reservation / CUD linkage, where applicable |
| `x_*` fields | Lineage: source file, source version, ingested time, tenant, connection, raw service code, normalizer version, restatement note |

**Cost bases in the UI:** Billed (default — ties to the invoice),
Effective, List. Currency is USD throughout the demo.

### The seeded demo dataset (what is actually in it)

- **Period:** 1 November 2025 – 26 October 2026 (12 months).
- **Rows:** 3,696 (Overview basis, by billing month). The Explorer
  at its default dates shows 3,693 rows — see the note below.
- **Providers and services (10):** AWS — Amazon EC2, Amazon S3,
  Amazon RDS, AWS Lambda; Azure — Virtual Machines, Blob Storage,
  SQL Database; GCP — Compute Engine, Cloud Storage, Cloud SQL.
- **Accounts (4 sub-accounts):** prod-aws (AWS), staging-aws (AWS),
  prod-azure-sub (Azure), prod-gcp-project (GCP).
- **Realistic mess, on purpose:** savings-plan/reservation
  *Purchase* rows, monthly *Credit* and *Tax* rows, messy tags
  (case/whitespace variants, occasional blanks → "Untagged"), a
  seeded March 2026 EC2 spike, a July 2026 Azure VM bump, and a July
  2026 EC2 restatement note — so anomaly detection, allocation and
  reconciliation have something real to chew on.
- **Seeded connections (3):** AWS production — Healthy, Fresh,
  0.12% variance; Azure MCA billing — **Degraded, Delayed, 0.68%
  variance** (above the 0.5% open-month tolerance, so Data Health
  flags it); GCP billing export — Healthy, Fresh, 0.04% variance.

### The headline numbers (baseline demo, verified)

| Figure | Value | Where you see it |
|---|---|---|
| 12-month total (Overview, by billing month) | **$264,267.79** | Overview cost-per-day basis |
| 12-month total (Explorer, default dates 1 Nov 2025 – 26 Oct 2026) | **$262,220.79 / 3,693 rows** | Cost Explorer totals row |
| Provider split | AWS $120,744.80 · Azure $86,134.39 · GCP $55,341.60 | Overview donut, Explorer |
| Top account / top service | prod-aws $117,489.72 · Amazon EC2 $87,081.81 | Overview Top accounts/services |
| October 2026 MTD / September 2026 | $19,848.69 / $21,675.88 | Overview hero card (October down vs September) |
| October forecast | $17,796 (range $16,372 – $19,220) | Overview, Forecast page |
| Cost per day (labelled) | $264,267.79 ÷ 360 days ≈ **$734/day** | Overview dark card — divide by your own unit (customers, requests, orders) for cost per unit |

**Why the two 12-month totals differ by $2,047.00:** Overview sums
by *billing month*, Explorer's default view filters by *charge
date* ending 26 Oct 2026 — so Explorer excludes the three October
tax rows dated 28 Oct 2026. That difference is expected and
documented; if the two totals matched exactly, that would be the
bug. (Change Explorer's end date to 31 Oct to include them.)

### Freshness, month state and reconciliation — on every figure

- **Freshness:** Fresh / Delayed / Stale / Failed — how recently
  the data arrived.
- **Month state:** Estimated (open month: actual-to-date + run
  rate) / Provisional / Final (closed month).
- **Reconciliation:** Reconciled / Variance / Unable to verify —
  whether the figure ties to an independent total.
- **Tolerances (from the plan):** open months ≤ 0.5% variance,
  final months ≤ 0.01% per billing account. Azure's 0.68% is
  therefore shown as Variance, not hidden.
- **Data as of (baseline demo):** 26 October 2026.

## 8. How the analytics work

### The query engine (`src/lib/query.ts`)

Every grouped view goes through the same typed query: **filter →
group → aggregate → topN + "Other" → envelope**. Filters include
provider, account (sub-account), service, region, charge category,
tag (`team:…`, `env:…`), date range and cost basis. Grouping keys
include provider, billing account, sub-account, service, service
category, region, charge category, month, and tags. Results beyond
`topN` are folded into a single labelled "Other" bucket (always
last). A `compareTo` option compares against the previous period or
the previous year. **Tenant isolation is mandatory in the filter
layer** — a row from another tenant can never leak through a UI
filter alone. Every API response returns
`{ data, totals, meta }`, where `meta` carries source (demo/live),
data-as-of, freshness, reconciliation, cost basis, currency,
estimated months and a query id.

### Anomaly detection (`detectAnomalies`)

- **Method:** per-service median/MAD (median absolute deviation)
  baseline over monthly totals.
- **A month flags only if all three hold:** score > 3, absolute
  difference ≥ $500, percentage difference ≥ 25% — and only when
  spend is *above* the baseline.
- **Purchase charges are excluded**, so a savings-plan purchase
  never looks like a spike.
- **Seeded example:** Amazon EC2, March 2026 — actual $6,525 vs
  expected $4,395 (+48%, Medium severity), top contributor shown by
  region. Uniformly scaling EC2 (Demo Studio ×2) scales both the
  actual and the median, so the percentage stays +48% — a
  month-specific spike cannot be created by a uniform multiplier,
  which is why the March spike is the anomaly test.
- **Severity bands:** by dollar gap — over $5,000 High, over $2,000
  Medium, otherwise Low. (Scaling the demo down ×0.7 drops the
  March EC2 anomaly from Medium to Low, while its percentage stays
  +48% — a good test that severity follows dollars, not just %.)

### Forecast (`forecastMonth`, `currentMonthForecast`)

- **Open month (October 2026):** actual-to-date + run-rate remainder
  (actual ÷ 26 days × 31 days, weekday-adjusted, one-offs removed).
  Baseline: forecast **$17,796**, band **±8%** ($16,372 – $19,220).
- **Closed months:** shown as actual, with a ±3% band.
- The method is stated in plain words on the Forecast page for
  every month — never just a number with no explanation.

### Budgets (`evaluateBudgets`)

Three budgets, evaluated from October month-to-date and forecast:

| Budget | Amount | Baseline actual (Oct MTD) | Baseline forecast | Baseline state |
|---|---|---|---|---|
| Total cloud spend | $22,000/mo | $19,849 | $17,796 | Triggered |
| AWS production | $12,000/mo | $10,321 | $9,254 | OK |
| Engineering teams | $9,000/mo | $8,138 | $7,296 | Triggered |

**Read "Triggered" correctly:** the state machine fires at the
80% threshold as well as at 100%. Baseline Total-cloud forecast is
81% of its budget, so Triggered is correct even though $17,796 is
*under* $22,000. A budget is *over* its amount only when forecast
exceeds amount (e.g. Growth scenario: Total $24,915 > $22,000,
AWS $12,956 > $12,000).

**Known simplification (do not miss this):** the AWS and
Engineering budget rows are computed as fixed shares of the total
(52% and 41% of October MTD/forecast), not by re-querying each
scope. They therefore move with the total even when only one
provider changes. The Total-cloud row is the one that truly follows
a scenario. See Section 16.

### Allocation (`/allocation`)

Tags are normalised (case + whitespace: "Prod", " prod ", "PROD"
→ one team) before grouping; the original tag value is kept on the
row. Four rules: by account → team; by tag team; shared costs
(support/tax) split proportionally; untagged spend is always its
own line, never hidden. The page proves reconciliation on screen:
**allocated + untagged = source total**.

### Commitments and recommendations (static demo lists)

- **Commitments (3):** AWS Savings Plan (Compute, 3 yr, 91%
  utilisation, 78% coverage), Azure VM reservation (1 yr, 84% /
  64%), GCP committed-use discount (1 yr, 96% / 71%) — with savings
  rate and unused cost for each.
- **Recommendations (5, 4 open):** rightsizing idle EC2 ($1,840/mo),
  deleting unattached Azure disks/IPs ($640/mo), moving GCP storage
  to Nearline ($410/mo), buying a Compute Savings Plan ($2,210/mo)
  — **open total $5,100/month** — plus one Accepted Cloud SQL
  downgrade ($530/mo). Savings are *provider estimates, labelled as
  such*, and Demo Studio deliberately does **not** scale them, so a
  scenario can never invent savings.

## 9. Accounts, authentication and authorisation

### Connected accounts (Settings → Connected accounts)

Three seeded demo accounts (AWS production, Azure MCA billing, GCP
billing export), each with a provider, display name, identifier,
billing account, **scope** (providers, sub-accounts, tags, teams),
status and mode (demo/live). You can add, edit (name + scope),
pause, resume, test and remove accounts:

- **Scope is a real filter, not a label.** Scopes are injected as
  mandatory filters in the query layer.
- **Pause** excludes that account's rows from `/api/query` totals
  (by scope sub-accounts, by account id, or — for an empty scope —
  the whole provider). Verified in v1.2: pausing AWS dropped the
  API total from $262,220.79 / 3,693 rows to $141,475.99 / 2,218
  rows, and resuming restored it exactly.
- **Test connection** runs a per-permission checklist and names the
  exact fix for each failing item. In demo mode the checklist is a
  labelled simulation (the seeded Azure account keeps one failing
  item so its Degraded story stays visible); in live mode it checks
  env-var presence (names only, never values).
- **Remove** requires typing the display name exactly, plus a
  keep/purge choice for historical data.
- **No secret fields, ever.** The form has none, the store holds
  none, the API returns none. Live credentials are server
  environment variables only.

### Authentication (v1.3 / v1.3.1)

- **Pages:** `/login` and `/register` with modern (shadcn-style)
  UI components built on Ledger tokens.
- **Passwords:** hashed with Node `crypto.scrypt` + a per-user
  random salt. Never stored or logged in plaintext. Minimum
  **12 characters**, with a common-password blocklist.
- **Sessions:** random 256-bit tokens stored server-side; the
  browser holds only an `httpOnly`, `SameSite=Lax` cookie (Secure
  in production). Sessions expire after **24 hours** absolute (no
  sliding renewal).
- **Lockout:** 5 failed logins per email + IP in 15 minutes, then
  HTTP 429. A successful login clears the counter.
- **Origin check** on auth POSTs (Origin vs Host, when an Origin
  header is present).
- **First user = Owner; later users = Viewer.** A demo login exists
  only when `LEDGER_DEMO_AUTH=true` (off by default) and is
  Viewer-only.
- **Persistence (the v1.3.1 fix):** users and sessions are saved to
  `.ledger-data/auth.json` (gitignored, hashes + tokens only,
  atomic tmp + rename, corrupt-file quarantine). This fixed the
  v1.3.0 bug where a user registered in dev was signed out and
  could not log back in, because route handlers did not share the
  old in-memory store. **Consequence to know:** an account created
  under v1.3.0 existed only in old server memory and is gone —
  register once more after upgrading to v1.3.1+.
- **Middleware is only the first gate:** it checks that a session
  cookie is *present* (it runs on the edge and cannot validate a
  token). The authoritative check is `auth-guard.ts` on every
  protected API route: no valid session → 401; wrong role → 403.

### Roles (single source of truth: `src/lib/permissions.ts`)

| Role | Plan | Members | Connections | All data | Budgets | Allocation | Exports | API keys | Audit |
|---|---|---|---|---|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FinOps Manager | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Analyst | — | — | — | ✓ | ✓ | — | ✓ | — | — |
| Viewer | — | — | — | Scoped | Own | — | Scoped | — | — |
| Auditor | — | — | — | ✓ | — | — | ✓ | — | ✓ |

Settings → Team members lists registered users; Owner/Admin can
change roles, and demoting the last Owner is blocked by the API.
UI hiding is never the enforcement — every protected route checks
the role server-side.

### Security, in one paragraph

Read-only connections, least-privilege roles, federation over
static keys, scrypt passwords, httpOnly sessions, lockout, origin
checks, no secrets in code/logs/API responses, hashed API keys
(never returned after creation), CSV formula-injection escaping,
and an append-only audit log for account actions. Full detail:
`docs/SECURITY.md`. **Not built yet:** MFA/TOTP, WebAuthn, email
password reset (admin reset until then), SSO/SCIM, and a real
database (see Section 16).

## 10. API reference

All API routes require a valid session (401 without one) unless
noted; management routes additionally require the role shown.
Every response uses the envelope
`{ data, totals, meta: { source, dataAsOf, freshness, reconciliation,
costBasis, currency, estimatedMonths, queryId } }`.

| Route | Method | What it does | Role needed |
|---|---|---|---|
| `/api/query?groupBy=…&provider=…&accounts=…&service=…&start=…&end=…&costBasis=…&topN=…` | GET | Grouped cost query (demo rows + scenario, or live rows); paused accounts excluded | Any signed-in user |
| `/api/source` | GET | Demo/live mode + per-provider configured booleans (never values) | Any signed-in user |
| `/api/accounts` | GET / POST | List / add a connected account (identifiers + scopes only) | Read: any user · Add: manageConnections |
| `/api/accounts/[id]` | PATCH / DELETE | Edit name/scope, pause/resume; remove (typed confirmation + keep/purge) | manageConnections |
| `/api/accounts/[id]/test` | POST | Per-permission connection checklist | manageConnections |
| `/api/accounts/audit` | GET | Account audit log (newest first) | Any signed-in user (audit viewing is role-checked for full audit in Settings) |
| `/api/budgets`, `/api/anomalies`, `/api/forecast` | GET | Evaluated budgets / detected anomalies / forecast points (scenario-adjusted in demo mode) | Any signed-in user |
| `/api/connections`, `/api/data-health`, `/api/commitments`, `/api/recommendations` | GET | Connection health, data-health detail, commitments, recommendations | Any signed-in user |
| `/api/demo-scenario` | GET / PUT / DELETE | Read / save / reset the Demo Studio scenario (PUT/DELETE blocked 409 in live mode) | Read: any user · Save/reset: manageConnections |
| `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/status` | POST / GET | Register, log in, log out, current user, "do any users exist yet?" (status returns only booleans) | Public for register/login; others need a session |
| `/api/auth/demo` | POST | Demo login, Viewer-only, only when `LEDGER_DEMO_AUTH=true` | Public (when enabled) |
| `/api/users`, `/api/users/[id]` | GET / PATCH | List users / change a role (last-Owner protection) | List/change: Owner/Admin (manageMembers) |

## 11. Design system and user interface

The design system is called **Ledger** (full spec:
`DESIGN_SYSTEM.md`; tokens in `src/app/globals.css`).

- **Look (v1.4, modelled on a Dribbble Task Management Dashboard,
  adapted — not copied):** pale warm-gray canvas, one white rounded
  (24px) frame, grouped sidebar, pill buttons, 20px cards, capsule
  chart bars with a hatched "remaining" track, and a deep-forest
  green (**#175E3B**) hero stat card and dark card. No Donezo
  branding, names or sample tasks were copied.
- **Colour:** Ledger neutrals + brand/status scales; data series use
  the colour-blind-safe Okabe-Ito palette. Status text uses the
  700 step for contrast (blue-600 ≈ 6.2:1, green-700 ≈ 5.7:1,
  red-700 ≈ 6.6:1 on white). **Cost up = red, cost down = green,
  usage change = neutral** — always arrow + text, never colour alone.
- **Type:** Inter stack, tabular numbers everywhere for money
  (`font-variant-numeric: tabular-nums`), compact KPIs ($1.24M)
  vs full tables ($1,234,567.89), signed deltas, true minus (−),
  `$0.00` for a real zero vs `—` for missing, dates as "Oct 26, 2026".
- **Components:** shadcn-*style* Button/Input/Label/Card/Alert/
  FormField (`src/components/ui/`) built on Ledger tokens. Note
  carefully: this is **not** a literal shadcn CLI / Tailwind
  install — a CLI install would have forced a Tailwind migration
  and broken the Ledger tokens, so the team built API-compatible
  primitives on the existing tokens instead.
- **Charts:** hand-built SVG only (line, bar, horizontal bar,
  donut) behind one chart adapter, so views never import a chart
  library. Forecast is always a dashed line + shaded band, labelled
  as a band, never a single point. Donut centre shows the total;
  legends show label + value + share %.
- **Modes:** light + dark via `[data-theme]`; high-contrast follows
  the same token pipeline. Focus ring is 2px brand colour on
  `:focus-visible`. Tables are sortable with `aria-sort`, budget
  meters use `role="progressbar"` with `aria-valuenow`, KPI cards
  carry an `aria-label` with their value.
- **Density and spacing:** 4/8/12/16/24/32px scale; radius
  2/4/6/8/12/20/24/999px (999 = pills/chips); soft shadows only.

## 12. How to run it

### Prerequisites

Node.js 20+ and npm. No database, no Docker, no cloud account is
needed to run the demo.

### On your own machine (Windows / PowerShell, as used by the team)

```powershell
# 1. Kill any stale server first — an old server holding port 3000
#    silently pushes the new one to 3001, and you will test the old build.
netstat -ano | findstr :3000
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# 2. Get the code and install
git pull origin main
npm install

# 3. Run (development) or build + start (production)
npm run dev      # http://localhost:3000  (or :3001 if 3000 is busy — check the log)
npm run build    # must pass before you claim anything works
npm start        # production server, after a successful build
```

On macOS/Linux the stale-server step is `lsof -ti:3000 | xargs kill`
(or `fuser -k 3000/tcp`).

### First sign-in

1. Open http://localhost:3000 — you are redirected to `/login`.
2. Register once. **The first registered user becomes Owner**;
   later registrations start as Viewers.
3. If the login page says "no accounts exist yet", that is the
   expected v1.3.1+ signal that the user store is empty — register,
   do not keep retrying a password.
4. Your account is saved to `.ledger-data/auth.json` on that
   machine and survives restarts. **Do not delete `.ledger-data/`**
   unless you mean to wipe all local users and scenarios, and never
   commit it (it is gitignored).

### Environment variables (names only — never put values in chat or in git)

| Variable | Meaning | Default |
|---|---|---|
| `LEDGER_DATA_SOURCE` | `demo` or `live` | `demo` |
| `LEDGER_DEMO_AUTH` | Allow the Viewer-only demo login | off (`false`) |
| AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Live AWS (read-only) | — |
| Azure: `AZURE_SUBSCRIPTION_ID`, `AZURE_ACCESS_TOKEN` | Live Azure (read-only) | — |
| GCP: `GCP_PROJECT_ID`, `GCP_BIGQUERY_DATASET`, `GCP_ACCESS_TOKEN` | Live GCP (read-only) | — |
| `LEDGER_AUTH_FILE` | Override the auth store path | `.ledger-data/auth.json` |
| `LEDGER_DEMO_SCENARIO_FILE` | Override the scenario store path | `.ledger-data/demo-scenario.json` |

Live-mode detail, including a read-only AWS IAM policy, is in
`docs/REAL_ACCOUNTS.md`. Start any live test with a 7-day range
and compare it against the provider console before trusting a
larger range.

## 13. How to test it

### Automated tests (46 tests, all passing)

```bash
npm test        # vitest run
npm run typecheck  # tsc --noEmit
npm run build   # Next.js production build — must pass
```

Test files: `tests/auth.test.ts` (12), `tests/accounts.test.ts`
(8), `tests/providers.test.ts` (10), `tests/demo-scenario.test.ts`
(8), `tests/query.test.ts` (4), `tests/insights.test.ts` (4).
They cover scrypt hashing and password policy, account
create/pause/resume/remove and scope exclusion, provider connector
validation and mapping, scenario scaling/validation/impact,
query grouping and totals, and anomaly/forecast/budget logic.
Persistence is disabled under Vitest, so tests stay hermetic —
file-backed stores are verified by the manual restart test below,
not by unit tests.

### Manual / presentation testing with Demo Studio (8 scenarios)

Full guide with verified expected numbers:
`docs/DEMO_STUDIO_TESTING.md`. In brief:

| # | Scenario | Studio setup | Expected Overview total |
|---|---|---|---|
| 1 | Baseline (control) | Reset / Original | $264,267.79 |
| 2 | Growth story | Preset ×1.4 | $369,974.89 |
| 3 | EC2 spike story | Preset EC2 ×2 | $352,095.36 |
| 4 | Savings story | Preset ×0.7 | $184,988.11 |
| 5 | Azure surge | Custom Azure ×2 | $351,041.54 |
| 6 | Account disappears | Custom prod-aws ×0 | $146,032.31 |
| 7 | New account onboarded | Extra GCP demo-acme-eu, $8,000/mo | $357,482.05 / 4,056 rows |
| 8 | Reset + restart survival | Save Growth → full restart → Reset | $369,974.89, then back to $264,267.79 |

**How to run a scenario:** Studio tab → preset/multiplier →
**Save & activate** → reload the dashboard tab → compare against
the table → Reset before the next scenario. The testing guide also
documents the three traps to avoid (Overview vs Explorer totals,
"Triggered" = 80% threshold, proportional budget rows).

### Runtime checks already performed (and their limits)

- **v1.0–v1.5 production servers** returned 200 for all pages and
  API routes in this workspace, including a full restart-survival
  test for Demo Studio (save ×1.4 + extra account → stop → restart
  → identical `/api/query` total $402,070.66 / 4,053 rows, same
  session, Studio 200, unauthenticated scenario 401).
- **Auth smoke test (v1.3):** unauthenticated `/` → 307 to
  `/login`, `/api/query` → 401, Owner register/login/query → 200,
  Viewer POST `/api/accounts` → 403, logout → `/api/auth/me` 401.
- **Pause test (v1.2):** pausing AWS dropped the API total from
  $262,220.79 / 3,693 rows to $141,475.99 / 2,218 rows; resuming
  restored it exactly.
- **Not tested here:** real AWS/Azure/GCP calls, Docker/Vercel/
  Render deploys, PDF/XLSX generation, and browser click-through
  (localhost navigation is blocked in the build environment used
  here, even though the server itself returns 200 — that is an
  environment limit, not an app fault). Judge the UI on your own
  machine, not from this document's word alone.

## 14. Deployment

Deploy configs exist and are consistent with `package.json`
scripts, but **no deploy has been run from this repo's history**
— pick one, deploy, and verify it yourself before presenting a
public URL:

- **Vercel:** `vercel.json` present.
- **Render:** `render.yaml` present.
- **Docker:** `Dockerfile` present (Node 20, `npm ci` → build →
  start). Run it, confirm the login page loads, register, and
  confirm the Overview numbers match Section 7 before sharing the
  link.
- **Any Node host:** `npm ci && npm run build && npm start`.

Deployment notes that matter: the file-backed stores
(`.ledger-data/`) are **local to one server process/machine**.
On a multi-instance or ephemeral host (serverless, containers
that restart), users, sessions and scenarios will not be shared
across instances — that is exactly what a real database replaces
(see Section 17). Do not present a single-instance file store as
production persistence.

## 15. Project structure

```
multi-cloud-cost-platform/
├── detail_explanation.md        # this file — the whole project, for viewers
├── README.md                    # pitch, architecture diagram, FOCUS table, run steps
├── DESIGN_SYSTEM.md             # Ledger tokens, type, components, chart rules
├── IMPLEMENTATION_PLAN.md       # original plan (workstreams WS-01–WS-23)
├── DEMO.md                      # 3-minute judge walkthrough script
├── docs/
│   ├── DEMO_STUDIO.md           # Demo Studio: what it changes, what it does not
│   ├── DEMO_STUDIO_TESTING.md   # 8 verified test scenarios
│   ├── REAL_ACCOUNTS.md         # live-mode env vars + read-only IAM policy
│   ├── SECURITY.md              # auth, roles, secrets, what is not built
│   └── aws-iam-policy.json      # read-only AWS policy for live mode
├── src/
│   ├── app/                     # pages + API routes (see Section 4 and 10)
│   │   ├── page.tsx             # Overview
│   │   ├── explorer/ budgets/ anomalies/ forecast/ commitments/
│   │   │   recommendations/ allocation/ reports/ data-health/
│   │   │   connections/ settings/ demo/ demo-studio/ login/ register/
│   │   ├── api/                 # query, source, accounts, budgets, anomalies,
│   │   │                        # forecast, demo-scenario, auth, users, …
│   │   ├── globals.css          # Ledger design tokens (the design system, in code)
│   │   └── layout.tsx           # root layout + AppShell
│   ├── components/              # shell, KPI cards, SVG charts, tables, filter bar,
│   │   ├── ui/                  # shadcn-style primitives on Ledger tokens
│   │   └── useScenarioRows.ts   # client hook: seeded rows + saved scenario
│   ├── lib/                     # data, query, insights, accounts, auth,
│   │   ├── providers/           # AWS / Azure / GCP connectors + fixtures
│   │   ├── demo-scenario.ts     # scenario model, presets, scaling, impact
│   │   └── demo-scenario-store.ts  # file-backed scenario store (server-only)
│   └── middleware.ts            # first-gate: session cookie present? else /login
├── tests/                       # 46 Vitest tests (see Section 13)
├── package.json                 # Next.js 14, React 18, AWS Cost Explorer SDK, Vitest
├── vercel.json  render.yaml  Dockerfile  # deploy configs (see Section 14)
└── .ledger-data/                # LOCAL ONLY, gitignored: auth.json + demo-scenario.json
                                 # (created at runtime — never commit, never share)
```

Files *not* in the repo (and why): `node_modules/` and `.next/`
(build artefacts, reinstall/rebuild with `npm install` /
`npm run build`), and `.ledger-data/` (local runtime state).

## 16. Limitations and known simplifications (read before judging)

A viewer who only reads the feature list will overrate this build.
These are the real limits, stated plainly:

1. **Demo data by default; live mode never tested against a real
   cloud account here.** See Section 3. Do not present demo
   figures as real billing.
2. **No real database.** Users/sessions are file-backed
   (single-server); connected accounts and audit entries are still
   **in-memory and reset on server restart** (a persistence
   proposal for accounts exists but is not built). A real database
   replaces exactly those modules later, without changing API
   shapes.
3. **No MFA/TOTP, no WebAuthn, no email password reset, no
   SSO/SCIM.** Password reset is via an admin until email reset
   exists. Do not use this for production accounts with sensitive
   data until those exist.
4. **Budget scope rows are proportional estimates** (AWS 52%,
   Engineering 41% of the total), not scoped re-queries. See
   Section 8.
5. **Recommendations and commitments are static demo lists.**
   They do not update from live provider advisors, and Demo Studio
   deliberately does not scale them.
6. **Pausing an account affects `/api/query` totals, but browser
   dashboard pages compute from seeded rows on the client and do
   not yet apply the pause filter there.** Test pause via the API,
   not by expecting Overview to drop in this version.
7. **Demo Studio cannot create a month-specific spike, a
   per-day event, or a tag change** — only uniform multipliers and
   whole extra accounts. The March EC2 spike is the anomaly test.
8. **Reports are templates/format notes; the working export is
   CSV/JSON from the Explorer.** PDF/XLSX generation is not built.
9. **Deploy configs exist but no deploy has been run.** Verify
   any public URL yourself before sharing it.
10. **Single-tenant demo, single-server stores.** Multi-tenancy
    is in the data model (mandatory tenant filter) and the plan,
    but this build runs one demo tenant (`demo-tenant-01`) on one
    server. Concurrent multi-user editing, backups and audit
    retention need the database + deployment work in Section 17.
11. **No AI assistant, no alert delivery (email/Slack/Teams),
    no webhook delivery** — those are in the original plan
    (WS-15–WS-23) as described behaviour, not as working features
    in this build. The Budgets page describes the alert state
    machine; it does not send alerts yet.

If you find a behaviour that contradicts this section, that is a
bug worth reporting — the section is meant to be the honest
baseline, not a shield.

## 17. Roadmap: what comes next

In rough priority order, each item replacing exactly one module
without breaking API shapes where possible:

1. **Real database** for users, sessions, accounts, audit and
   scenarios (replacing `.ledger-data/` files and the in-memory
   account store); multi-instance-safe, with backups.
2. **Connected-accounts persistence** (the pending proposal:
   `.ledger-data/accounts.json` as the interim step, then the
   database) so added/paused accounts survive restarts like
   users and scenarios already do.
3. **Pause filter on browser pages**, so Settings pause and
   dashboard totals agree everywhere, not just on `/api/query`.
4. **Scoped budget evaluation** (re-query each budget's scope
   instead of proportional shares) and budget *creation* in the
   UI (today the three budgets are seeded definitions).
5. **MFA (TOTP + WebAuthn), email password reset, SSO/SCIM**
   (via WorkOS/Auth0/Clerk/Keycloak as the plan suggests; the
   authorisation model itself stays Ledger-owned).
6. **Live-mode verification** against real AWS/Azure/GCP accounts
   (7-day range first, reconciled against provider consoles),
   then a verified public deployment.
7. **PDF/XLSX exports, scheduled reports, and alert delivery**
   (email/Slack/Teams, signed webhooks) to complete the Reports
   and Budgets stories.
8. **Month-specific Demo Studio controls** (e.g. "spike EC2 in
   March only") and tag edits, so anomaly-creation can be tested
   directly instead of only via the seeded March spike.
9. **AI assistant** (natural-language cost questions over the
   same query engine, with evidence links) — planned, not built.
10. **Multi-tenancy hardening, audit retention, and
    high-contrast/RTL polish** for production readiness.

## 18. Frequently asked questions

**Q: Is Ledger a real product I can sign up for?**
A: No. It is an open-source-style project build (MIT) that you run
yourself. There is no hosted Ledger service, no signup page, and
no billing — "plan and billing" in Settings refers to the
*platform's own* plan model in the original design, not a
subscription you can buy here.

**Q: Are the numbers on the screenshots real?**
A: No, unless the machine was explicitly put in live mode with
real provider credentials (see Section 3). By default every
number is the labelled, deterministic demo dataset. A Demo Studio
scenario makes the demo story different; it does not make it real.

**Q: Why does Overview say $264,267.79 but Explorer says
$262,220.79?**
A: Different date bases — Overview sums by billing month,
Explorer's default view filters by charge date ending 26 Oct
2026, excluding three October tax rows dated 28 Oct. See
Section 7. It is documented, not a reconciliation failure.

**Q: Why does a budget say "Triggered" when it is under its amount?**
A: "Triggered" fires at the 80% threshold as well as at 100%.
Check forecast vs amount, not just the state word. See Section 8.

**Q: I paused an account in Settings but Overview did not change.
Is it broken?**
A: In this version, pause affects `/api/query` only; browser
pages do not yet apply it (Section 16, item 6). Test pause via
the API, and expect the browser-page fix in the roadmap.

**Q: Can I connect my real AWS/Azure/GCP account?**
A: Yes, in principle, on your own machine: set
`LEDGER_DATA_SOURCE=live` and the provider env vars in
`docs/REAL_ACCOUNTS.md`, using read-only roles (the AWS policy
in `docs/aws-iam-policy.json` is a starting point). It has not
been verified against a real account from this workspace, so
start with a 7-day range and reconcile against the provider
console. Never paste keys in chat or commit them.

**Q: I registered, then the app signed me out and my password
"stopped working". What happened?**
A: That was the v1.3.0 bug (in-memory user store lost on dev
recompile/restart). It is fixed in v1.3.1+ by the file-backed
auth store — but an account created under v1.3.0 is gone, because
it only ever existed in old server memory. Kill stale servers,
pull v1.3.1+, and register once more. If the login page says "no
accounts exist yet", that confirms the store is empty; register
rather than retrying.

**Q: Where do I start if I want to contribute?**
A: Read this file, then `DESIGN_SYSTEM.md` (tokens/components),
`src/lib/types.ts` (the data contract), and the test files.
Keep changes to one module where possible, keep the Demo banner
honest, never add a secret field to a form or a credential to a
store, and add a test for any new query/insight/scenario logic
before claiming it works.

**Q: What should I show a judge in 3 minutes?**
A: `/demo` (six steps), then Demo Studio: click Growth, read the
"What this preset changes" panel, Save & activate, reload
Overview, and point out the budget breach — then Reset. That
sequence shows the data model, the analytics, the budgets, and
the demo tooling in one flow, without pretending the data is live.

## 19. Other documents and version history

### Document map

| Document | For whom / what |
|---|---|
| `detail_explanation.md` (this file) | Viewers: everything about the project |
| `README.md` | Quick pitch, architecture diagram, FOCUS table, run steps |
| `DEMO.md` | Presenter: 3-minute walkthrough script |
| `docs/DEMO_STUDIO.md` | Presenter/tester: Demo Studio rules and run steps |
| `docs/DEMO_STUDIO_TESTING.md` | Tester: 8 scenarios with verified expected numbers |
| `docs/REAL_ACCOUNTS.md` + `docs/aws-iam-policy.json` | Operator: live-mode setup, read-only IAM |
| `docs/SECURITY.md` | Reviewer: auth, roles, secrets, what is not built |
| `DESIGN_SYSTEM.md` | Designer/developer: tokens, type, components, chart rules |
| `IMPLEMENTATION_PLAN.md` | Planner: original workstreams WS-01–WS-23 (the full vision; this build implements a subset — see Section 16) |

### Version history (main branch, verified by reading back from GitHub after each push)

| Version | Commit | What changed |
|---|---|---|
| 1.0 | `d76058e7` | First build: 49 files, 23 routes, synthetic demo data, all pages, build passes; source zip delivered |
| 1.1 | `55419620` | Real-provider connectors (env-only), demo/live mode, `/demo` walkthrough, JSON export, deploy configs, 18 tests |
| 1.2 | `fe918a5d` | Connected-accounts management in Settings; paused accounts excluded from API totals (verified live) |
| 1.3 | `fcbb2cee` | Authentication + authorisation: shadcn-style login UI, scrypt, sessions, lockout, roles, Team members |
| 1.3.1 | `d8e2c404` | **Fix:** file-backed users/sessions survive dev restarts (the sign-out bug); `/api/auth/status` added |
| 1.4 | `6bcffa97` | UI refresh modelled on a Dribbble dashboard, adapted not copied: rounded frame, forest-green hero card |
| 1.5 | `e125c05c` | Demo Studio: multipliers, presets, extra demo accounts, file-backed scenarios, demo-mode only |
| 1.5.1 | `86ff2118` | Demo Studio preset impact: what goes up/down/unchanged/added, per provider/account/service, highlighted fields |
| (docs) | `cf16645e` | Docs-only: Demo Studio testing guide (8 scenarios) — no code or version change |

### A final note to viewers

If you remember one thing from this document, remember this:
**Ledger is a working, testable demo of a real FinOps idea, not a
claim to have solved multi-cloud billing in production.** The
query engine, anomaly detection, forecast, budgets, allocation,
auth and Demo Studio all genuinely run and can be tested with the
numbers in this document. The live connections, database, MFA,
SSO, alert delivery and PDF exports are the honest next steps —
not hidden gaps, and not claimed features. Judge it on what it
does, test it with Demo Studio, and use the roadmap in Section 17
to judge what it could become.
