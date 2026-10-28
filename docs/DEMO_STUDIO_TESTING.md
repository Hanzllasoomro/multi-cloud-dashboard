# Testing the whole platform with Demo Studio (v1.5)

Use Demo Studio (`/demo-studio`, sidebar → General) to change the demo
story and prove the platform actually recomputes — instead of trusting
that a page "looks right". Every expected number below was computed
from the real seeded rows with the real scenario code on 2026-10-28
(`src/lib/data.ts` + `src/lib/demo-scenario.ts` + `src/lib/insights.ts`),
not guessed. Small $1 rounding differences from on-screen rounding are
fine; a different order of magnitude, a missing account, or a budget
that does not flip is not.

## Before you start

1. **One server, the right build.** Kill stale servers first (Windows:
   `netstat -ano | findstr :3000` and `:3001`, then
   `taskkill /PID <pid> /F`), then `git pull origin main`,
   `npm install`, `npm run dev`. Confirm `package.json` is 1.5.0 and
   the Overview has the pale warm-gray canvas and dark-green hero card.
2. **Sign in as Owner, Admin, or FinOps Manager.** Viewers can read a
   scenario but cannot save one — if Save fails with 403, that is the
   role check working, not a bug.
3. **Two tabs, one rule.** Keep Demo Studio open in one tab and the
   dashboard in another. After every save, **reload the dashboard tab**:
   dashboard pages fetch the scenario on load, they do not live-update
   from the Studio tab.
4. **Reset between scenarios.** Press **Reset to original demo** in
   Studio (or the Original preset + Save) before starting the next
   scenario, otherwise multipliers stack and your numbers will not
   match the tables below.
5. **Demo mode only.** All of this runs with the default
   `LEDGER_DATA_SOURCE=demo`. If the server is in live mode, Studio
   saves are blocked (409) by design — see `docs/DEMO_STUDIO.md`.

## Reading the numbers (three traps, read first)

- **Overview total ≠ Explorer total, by $2,047.00, on purpose.**
  Overview sums by *billing month* (12-month total, baseline
  $264,267.79). Explorer at its default dates (1 Nov 2025 – 26 Oct 2026)
  filters by *charge date*, so it excludes the three October tax rows
  dated 28 Oct 2026: Explorer total $262,220.79 over 3,693 rows, vs
  Overview's 3,696 rows. If those two totals matched exactly, *that*
  would be the bug.
- **"Triggered" does not mean "over budget".** The budget code fires
  at the 80% threshold as well as at 100%. Baseline Total-cloud
  forecast is $17,796 against a $22,000 budget (81%) — so it correctly
  shows Triggered, not OK. A budget is *over* its amount only when its
  forecast exceeds its amount (see Scenario 2).
- **AWS / Engineering budget figures are proportional estimates.**
  `evaluateBudgets` takes October month-to-date and forecast totals and
  applies fixed shares (AWS 52%, Engineering 41%), rather than
  re-querying each scope. So in Scenario 5 (Azure surge) the AWS budget
  still flips to Triggered even though AWS spend did not change.
  Treat those two budget rows as "total-driven estimates", and the
  Total-cloud budget row as the one that truly follows the scenario.
  This is a known simplification, documented here so a tester does not
  mistake it for a scenario failure.

## At a glance — 8 scenarios

| # | Scenario | Studio setup | Overview 12-mo total | Oct MTD | Oct forecast | What flips |
|---|----------|--------------|----------------------|---------|--------------|------------|
| 1 | Baseline (control) | Reset / Original | $264,267.79 | $19,848.69 | $17,796 | Nothing — this is the reference |
| 2 | Growth story | Preset: Growth (×1.4) | $369,974.89 | $27,788.18 | $24,915 | All budgets Triggered; Total + AWS over amount |
| 3 | EC2 spike story | Preset: EC2 spike (EC2 ×2) | $352,095.36 | $26,604.99 | $22,529 | EC2 becomes top service; anomaly $13,051 vs $8,789 |
| 4 | Savings story | Preset: Savings (×0.7) | $184,988.11 | $13,894.09 | $12,457 | All budgets OK; anomaly drops Medium → Low |
| 5 | Azure surge | Custom: Azure ×2 | $351,041.54 | $26,281.50 | $23,073 | Azure becomes top provider; VMs top service |
| 6 | Account disappears | Custom: prod-aws ×0 | $146,032.31 | $10,849.88 | $10,390 | prod-aws $0; EC2 gone; anomalies empty |
| 7 | New account onboarded | Extra: GCP demo-acme-eu, Demo Compute, $8,000/mo | $357,482.05 | $26,590.73 | $25,835 | GCP top provider; Demo Compute top service; 4,056 rows |
| 8 | Reset + restart survival | Save Growth → restart → Reset | $369,974.89, then back to $264,267.79 | $27,788.18, then $19,848.69 | $24,915, then $17,796 | Scenario survives restart; reset restores baseline |

Run them in order. Tick each scenario off only when its "Pass if"
checks all hold.

---

## Scenario 1 — Baseline: prove the control numbers first

**Why:** without a control, every later scenario is unverifiable.

**Studio setup:** Press **Reset to original demo**. Studio should show
"Original seeded demo", Active off.

**Pages to open:** Overview, Cost Explorer, Anomalies, Budgets,
Forecast, Allocation.

**Expected (baseline):**

- Overview 12-month total **$264,267.79**; October MTD **$19,848.69**;
  September **$21,675.88** (October is *down* vs September — the hero
  card delta should be negative/green, cost-down).
- October forecast **$17,796** (range $16,372 – $19,220).
- Provider split (Explorer, default dates): AWS **$120,744.80**,
  Azure **$86,134.39**, GCP **$55,341.60**; Explorer total
  **$262,220.79 / 3,693 rows** (see the $2,047 tax-row note above).
- Top account: prod-aws **$117,489.72**. Top service: Amazon EC2
  **$87,081.81**.
- Anomalies: exactly **1** — Amazon EC2, March 2026, actual **$6,525**
  vs expected **$4,395** (+48%, Medium).
- Budgets: Total-cloud Triggered ($17,796 / $22,000, 81% threshold);
  AWS production OK ($9,254 / $12,000); Engineering teams Triggered
  ($7,296 / $9,000, 81%).
- Allocation: allocated + untagged = source total (nothing lost,
  nothing doubled).

**Pass if:** all of the above hold, and the Demo banner is visible on
every page. **What it proves:** the seeded story, the query engine,
anomaly detection, forecast and budgets all agree on one dataset.

## Scenario 2 — Growth story: does everything move, and do budgets breach?

**Studio setup:** Preset **Growth story (×1.4)** → **Save & activate**
→ reload Overview.

**Expected:**

- Overview total **$369,974.89**; MTD **$27,788.18**; forecast
  **$24,915** (range $22,922 – $26,908).
- Provider split: AWS $169,042.77, Azure $120,588.04, GCP $77,478.29.
- Budgets: **all three Triggered**, and now genuinely over amount:
  Total-cloud $24,915 > $22,000; AWS production $12,956 > $12,000.
- Anomaly: still the March EC2 spike, now $9,136 vs $6,152 — same
  +48%, because a uniform multiplier scales the median baseline too.

**Pass if:** the hero card, trend chart, donut, Top services and
Budgets all move by ~×1.4, and the Total + AWS budget rows cross from
"under amount" to "over amount". **What it proves:** global scaling
flows through charts, KPIs, forecast and budget evaluation together.

## Scenario 3 — EC2 spike story: does one service move on its own?

**Studio setup:** Reset, then preset **EC2 spike story (EC2 ×2)** →
**Save & activate** → reload.

**Expected:**

- Overview total **$352,095.36**; MTD **$26,604.99**; forecast **$22,529**.
- AWS **$207,826.61**; Azure and GCP unchanged ($86,134.39 /
  $55,341.60). Top service is now Amazon EC2 at **$174,163.62**.
- Anomaly: March EC2 **$13,051 vs $8,789 (+48%, Medium)**.
- Budgets: all Triggered (Total $22,529 > $22,000; AWS $11,715, under
  amount but over the 80% threshold — see the Triggered note above).

**Pass if:** only AWS/EC2 figures move; Azure/GCP figures are
byte-identical to Scenario 1. **What it proves:** service-level
multipliers are scoped, not global.

**Honest limit this scenario exposes:** uniform ×2 does *not* create
a new anomaly — the anomaly percentage stays +48% because the baseline
median doubles too. Demo Studio cannot create a month-specific spike
(one month up, the rest flat); the March 2026 EC2 spike in Scenario 1
is the anomaly-hunting test. Do not claim otherwise in a presentation.

## Scenario 4 — Savings story: does the platform show good news correctly?

**Studio setup:** Reset, then preset **Savings story (×0.7)** →
**Save & activate** → reload.

**Expected:**

- Overview total **$184,988.11**; MTD **$13,894.09**; forecast
  **$12,457** (range $11,461 – $13,454).
- Provider split: AWS $84,521.66, Azure $60,294.22, GCP $38,739.33.
- Budgets: **all three OK** (Total $12,457 / $22,000; AWS $6,478 /
  $12,000; Engineering $5,107 / $9,000).
- Anomaly: March EC2 **$4,568 vs $3,076 (+48%)**, severity now **Low**
  (the dollar gap, $1,492, falls below the $2,000 Medium threshold).

**Pass if:** every budget flips to OK and the anomaly severity drops
while its percentage stays +48%. **What it proves:** the platform
does not just go red on growth — thresholds and severity bands move
in both directions, and cost-down shows green.

## Scenario 5 — Azure surge: does the ranking flip?

**Studio setup:** Reset, then custom: **Azure ×2** (leave everything
else at 1) → **Save & activate** → reload.

**Expected:**

- Overview total **$351,041.54**; MTD **$26,281.50**; forecast **$23,073**.
- Provider ranking flips: Azure **$172,268.78** is now first, ahead
  of AWS $120,744.80 and GCP $55,341.60. Top service is Virtual
  Machines at **$126,017.54**, ahead of EC2 ($87,081.81).
- Anomaly unchanged: March EC2 $6,525 vs $4,395 (Azure scaling does
  not touch EC2).

**Pass if:** the donut, provider split and Top services reorder, while
AWS/GCP figures and the EC2 anomaly are unchanged.
**What it proves:** provider-level control and chart re-ranking.

**Read the Budgets page with care here:** AWS and Engineering budgets
show Triggered in this scenario too, because those two rows are
proportional estimates of the *total* (see "Reading the numbers").
That is the documented simplification, not proof that Azure spend
raised AWS spend.

## Scenario 6 — Account disappears: does zero break anything?

**Studio setup:** Reset, then custom: **prod-aws ×0** → **Save &
activate** → reload.

**Expected:**

- Overview total **$146,032.31**; MTD **$10,849.88**; forecast **$10,390**.
- AWS collapses to staging-aws only (**$3,255.08**). Top accounts
  shows prod-aws at **$0**; EC2, S3 and RDS disappear from Top
  services (Virtual Machines, Compute Engine and SQL Database lead).
- Anomalies: **empty** — the page's "no anomalies at this severity"
  state should appear, not an error or a stale EC2 card.
- Budgets: all OK.

**Pass if:** a $0 account renders cleanly everywhere and no page
errors on the missing EC2 series. **What it proves:** zero/empty
handling across Overview, Explorer, Anomalies and Budgets.

**Optional extra check (Settings, not Studio):** Reset Studio, then
pause the AWS account in Settings → Connected accounts. In *this*
version, pausing affects `/api/query` totals only — the browser
dashboards compute from seeded rows on the client and do not yet
apply the pause filter there. Do not file that as a Studio failure;
it is a known scope gap, and the API check is the correct test for
pause behaviour.

## Scenario 7 — New account onboarded: does a brand-new fake account appear everywhere?

**Studio setup:** Reset, then in Studio's "Extra demo accounts" add:
provider **GCP**, sub-account **demo-acme-eu**, service
**Demo Compute**, monthly base **8000** → **Save & activate** →
reload.

**Expected:**

- Row count rises from 3,696 to **4,056** (360 new daily rows,
  1 Nov 2025 – 26 Oct 2026).
- Overview total **$357,482.05**; MTD **$26,590.73**; forecast **$25,835**.
- GCP becomes top provider (**$148,555.86**). Demo Compute becomes
  top service (**$93,214.26**), and demo-acme-eu is the second-largest
  account (**$93,214.26**).
- The March EC2 anomaly is unchanged ($6,525 vs $4,395).

**Pass if:** the new account appears in Overview Top accounts,
Explorer grouped by sub-account, and the provider donut — not just in
Studio's own preview. **What it proves:** extra accounts are real
rows in the dataset, not labels.

**Why $93,214.26, not $96,000:** $8,000 × 12 months would be $96,000
for full months, but October only runs to the 26th and daily rows
carry a weekend factor, so the 12-month figure is slightly lower.
If your check expects exactly $96,000, adjust the expectation, not
the code.

## Scenario 8 — Reset + restart: does the scenario survive, and can you clean up?

**Studio setup:** Save the Growth preset, then **stop the server
fully** (not just refresh the browser), start it again, and reload.

**Expected after restart:**

- Studio still shows "Growth story — spend up ~40%", Active on.
- Overview total is still **$369,974.89** and MTD **$27,788.18**.
- The scenario file exists on the presentation machine at
  `.ledger-data/demo-scenario.json` (gitignored — never commit it,
  and never share it: it contains no credentials, but it is local
  state, not source code).

**Then press Reset to original demo and reload.**

**Expected after reset:** Overview total back to **$264,267.79**,
MTD **$19,848.69**, forecast **$17,796**, Studio shows the original
seeded demo, Active off.

**Pass if:** both halves hold. **What it proves:** the scenario is
file-backed (it survives a restart, unlike the old in-memory account
store), and a presenter can hand the machine over clean.

**Warning that belongs in this scenario:** the scenario file does
*not* travel with `git pull`. A scenario saved on one machine will
not appear on the presentation machine until it is set up there.
Always run Scenario 8 on the machine you will present from.

---

## Full-platform checklist (tick as you go)

| Check | Where | Scenario(s) |
|---|---|---|
| Hero KPI, trend + forecast band, donut, Top services/accounts all move together | Overview | 2, 5, 7 |
| Group by provider / service / sub-account, CSV + JSON export totals match the screen | Cost Explorer | 1, 3, 7 |
| Anomaly found, amounts scale, severity band changes, empty state renders | Anomalies | 1, 3, 4, 6 |
| Budget flips OK ↔ Triggered, and over-amount vs threshold-only is distinguishable | Budgets | 2, 4 |
| Forecast band and month-end figure move with the scenario | Forecast | 2, 4, 7 |
| Allocated + untagged still equals the (new) source total | Allocation | 1, 2, 7 |
| Walkthrough step numbers (MTD, anomaly, forecast) match the active scenario | Demo walkthrough | 2, 7 |
| Scenario persists across a full restart; reset restores baseline | Demo Studio | 8 |
| Demo banner visible on every page in every scenario; Viewer cannot save | Every page / Studio | All |

## What Demo Studio does NOT test (do not over-claim)

- **Live provider data.** No scenario touches a real AWS/Azure/GCP
  account. Live testing needs `LEDGER_DATA_SOURCE=live` plus provider
  env vars on your own machine (`docs/REAL_ACCOUNTS.md`), and an
  unconfigured provider must show "Not connected", never fake numbers.
- **Recommendation / commitment savings.** Those lists are static
  demo lists and are deliberately not scaled by a scenario, so their
  dollar figures will not move in Scenarios 2–7. That is by design.
- **Month-specific spikes, budget scope accuracy, and pause on
  browser pages.** See the honest limits in Scenarios 3, 5 and 6.
- **Auth, roles beyond Studio saving, exports to PDF/XLSX, and
  multi-user concurrency.** Those need their own tests
  (`docs/SECURITY.md`, Settings → Team members); Studio scenarios
  do not cover them.
- **Presentation honesty.** A scenario makes demo data look
  lived-in; it does not make it real. In a talk, say "demo scenario"
  — the Demo banner on every page is there to keep that claim true.

## Troubleshooting

| Symptom | Most likely cause | Fix |
|---|---|---|
| Dashboard numbers do not change after saving | Dashboard tab was not reloaded | Reload the dashboard tab (Studio saves do not push to open tabs) |
| Save returns 403 | Signed in as Viewer (or demo Viewer) | Sign in as Owner/Admin/FinOps Manager, or change the role in Settings → Team members |
| Save returns 409 | Server is in live mode | This is the guard working. Run scenarios in demo mode only |
| Numbers match the *previous* scenario | Previous scenario was not reset, or a stale server is serving old code | Reset in Studio, kill stale servers (port 3000/3001), pull, restart, re-check `package.json` 1.5.0 |
| Scenario is gone after pulling on another machine | Scenario file is local to the old machine | Re-create it in Studio on the new machine (see Scenario 8) |
| Explorer total is $2,047 below the Overview total | October tax rows dated 28 Oct fall outside Explorer's default end date (26 Oct) | Expected — see "Reading the numbers". Change Explorer's end date to 31 Oct to include them |
| Overview shows a scenario banner you did not set | A previous scenario is still active | Studio → Reset to original demo → reload Overview |
