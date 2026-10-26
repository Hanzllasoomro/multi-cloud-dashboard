# Demo script — Ledger (3 minutes, for judges)

**Problem in one sentence:** a company's cloud bill is split across AWS, Azure
and GCP consoles that never agree, so nobody can answer "why did our bill go
up?" in one place.

## The walkthrough (also live at `/demo`)

1. **Connect (30s)** — `/connections`. Read-only, least-privilege roles;
   federation over static keys. No write access, no secrets in code.
2. **One number (30s)** — `/`. Month-to-date spend across all three clouds,
   Billed cost basis (ties to invoices), one currency, freshness + reconciliation
   on every figure.
3. **Find the spike (30s)** — `/anomalies`. The March 2026 EC2 spike: actual vs
   expected, % over a median/MAD baseline, top contributor region. Purchase
   charges are excluded so savings-plan buys never look like spikes.
4. **Budget breach, before it happens (30s)** — `/budgets`. Forecast breach
   fires on forecast, not after the money is spent.
5. **Savings (30s)** — `/recommendations`. Open recommendations summed as an
   estimated monthly total (labelled estimate); each links to its resource and
   evidence.
6. **Export and reconcile (30s)** — `/explorer`. CSV + JSON export of the exact
   filtered view; export totals equal on-screen totals.

## If a judge asks "is this real data?"

**Honest answer:** "By default, no — this build runs on deterministic demo data,
labelled on every page, so the demo is reproducible. The provider layer is real
code: AWS Cost Explorer, Azure Cost Management Query and GCP BigQuery billing
export, all read-only, all mapped to the same FOCUS-style rows, with recorded
fixtures and mapping tests. Set `LEDGER_DATA_SOURCE=live` plus the provider env
vars in `docs/REAL_ACCOUNTS.md` and the same UI shows live data; a provider you
haven't configured shows 'Not connected', never fake numbers. We didn't fake a
live test — live calls need real credentials, which we never ask for or store."

## If a judge asks "why does this win?"

- One canonical model (FOCUS + `x_` lineage) — provider quirks never leak into UI.
- Trust is visible: freshness, cost basis, currency, estimated/final, variance.
- Read-only by default, least privilege, tenant isolation in the data layer.
- Every number drills down to line items and reconciles to provider totals.
