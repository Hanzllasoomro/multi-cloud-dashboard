# Demo Studio (v1.5) — external control panel for demo data

Open **Demo Studio** in the sidebar (General) or at `/demo-studio`. It is a
separate control surface from the dashboards: change the demo story there,
save, reload a dashboard tab, and the new story is live.

## What it changes

- **Global / provider / fake-account / service multipliers** (0–10, combine
  by multiplication). 0 makes that slice $0.
- **Presets:** Original seeded demo, Growth story (×1.4), EC2 spike story
  (Amazon EC2 ×2), Savings story (×0.7).
- **Extra demo accounts** (up to 5): a provider, a sub-account name, a
  service and a monthly base. Each gets ~12 months of daily demo rows, so
  it appears in Top accounts, provider split, totals, budgets and forecasts.

Multipliers scale cost *and* usage together and keep every row's date,
service, account, tags and lineage, so charts, tables, budgets, forecasts
and anomalies stay internally consistent.

## What it does NOT change

- **Live provider data, ever.** Saving a scenario is blocked (409) while
  `LEDGER_DATA_SOURCE=live`. Live pages show provider data only.
- **Recommendation and commitment lists.** They are static demo lists and
  are deliberately not scaled, so a scenario never invents savings.
- **Managed accounts in Settings.** Renaming/pausing accounts is still
  done there; Demo Studio only scales spend. Pausing a managed account
  whose scope covers an extra account's sub-account name still excludes
  it from `/api/query` totals.
- **The seeded dataset itself.** Reset (DELETE `/api/demo-scenario`, or
  the Reset button) returns to the original seeded demo in one click.

## Where it reflects

Overview, Cost Explorer, Budgets, Anomalies, Forecast, Allocation and the
Demo walkthrough (browser pages, via `/api/demo-scenario`), plus the
server APIs `/api/query`, `/api/budgets`, `/api/anomalies` and
`/api/forecast` in demo mode.

## Persistence (presentation-machine warning)

The scenario is saved to `.ledger-data/demo-scenario.json` on the machine
running the server (gitignored, never committed, no credentials inside),
so it **survives a server restart** — but it does **not** travel with a
`git pull` to another machine. Set the scenario up on the presentation
machine itself, and verify it there before presenting (see below).

## Roles

Reading the scenario: any signed-in user. Saving/resetting: Owner, Admin
or FinOps Manager only (`manageConnections` permission, enforced server-side).

## Presentation run (tomorrow)

1. On the presentation machine: kill stale servers first
   (`netstat -ano | findstr :3000` / `:3001`, then `taskkill /PID <pid> /F`
   on Windows), then `git pull origin main`, `npm install`, `npm run dev`.
2. Register/sign in, open Demo Studio in a second tab, pick a preset or
   set multipliers, press **Save & activate**.
3. Reload the dashboard tab and confirm the Overview banner names your
   scenario and the totals match the Studio preview.
4. Mid-talk, switch presets from the Studio tab and reload the dashboard.
5. Afterwards, press **Reset to original demo** so the next run starts
   from the seeded story.

## Honesty note for the talk

The Demo banner stays on every page while a scenario is active, and
Overview names the active scenario. Present it as a *demo scenario* —
"here is what the platform looks like with a growth story / a spike" —
not as live billing from a real cloud account.
