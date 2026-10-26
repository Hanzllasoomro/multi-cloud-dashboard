# Implementation Plan (condensed, WS-01 – WS-23)

Source: the uploaded plan (Draft v1, Oct 26, 2026). This file condenses it; the
full plan's "done when" criteria are the acceptance tests for each workstream.

## Dependency order — one provider end-to-end first

```
WS-01 Identity/tenancy
  → WS-02 Connections
    → WS-03 Ingestion → WS-04 Normalisation → WS-05 Reconciliation (publish gate)
      → WS-07 Analytics store → WS-08 Query API (typed DSL)
        → WS-09 Web app
          → WS-10 Allocation · WS-11 Budgets/alerts · WS-12 Anomaly/forecast
            · WS-13 Commitments/recommendations · WS-14 Reports/exports
        → WS-15 Extended sources (connector + mapping only, UI unchanged)
        → WS-16 AI assistant (query-API only, never raw SQL)
WS-17 Security · WS-18 Infra/CI-CD · WS-19 Observability · WS-20 Quality:
  start immediately, in parallel — they gate any real customer data.
WS-21 Plans/billing (after WS-01) · WS-22 Docs (alongside every workstream)
WS-23 Write actions: only after everything above is stable, separately gated.
```

## Workstreams

| WS | Build | Done when |
|---|---|---|
| WS-01 Tenancy, identity, access | Org + optional parent org, teams/scopes, email+Google/Microsoft sign-in, MFA (TOTP/WebAuthn), SAML/OIDC SSO, SCIM, httpOnly sessions, RBAC matrix (Owner/Admin/FinOps/Analyst/Viewer/Auditor/Billing Admin), hashed API keys, append-only audit, Postgres RLS | Permission tests pass per role × endpoint; cross-tenant isolation suite green; SSO with ≥2 IdPs; every sensitive action audited |
| WS-02 Connections | Per-provider wizard generating IaC (CloudFormation/Bicep/gcloud) with exact least-privilege permissions + reason each; per-permission test; states Pending→…→Healthy, Degraded/Broken/Revoked; credential vault (KMS envelope, federation first) | New user connects AWS+Azure+GCP unaided; every missing permission named with fix; revoke → Broken within one health-check interval; no secret in logs |
| WS-03 Ingestion | One connector interface (validate/discover/fetch/checkpoint); partition = connection × scope × period × version; manifest-driven, idempotent, restatement-safe, immutable raw landing zone, backoff/jitter, circuit breaker, DLQ, quarantine | 10× replay changes nothing; restated month fully replaces; mid-run kill resumes without duplicates |
| WS-04 Normalisation | Declarative per-provider mappings to FOCUS + `x_` extensions; golden files; tag normalisation (case/whitespace/alias) keeping originals; billing-period timezones; billing-currency authoritative, converted values carry FX rate+date; nothing dropped silently | BilledCost per billing account per period identical before/after normalisation; golden outputs stable across releases |
| WS-05 Reconciliation | Completeness, arithmetic vs independent source, cross-version diff, distribution checks; variance engine (Reconciled/Variance/Unable to verify); freshness Fresh/Delayed/Stale/Failed; month lifecycle Estimated→Provisional→Final; publish gate | Corrupted/day-missing partitions blocked or flagged; pilot accounts within tolerance; every response carries `data_as_of` + reconciliation |
| WS-06 Usage & inventory | Billing usage (always) vs resource utilisation (only where needed, golden metrics, per-tenant monitoring budget); inventory sync (Resource Explorer / Resource Graph / Cloud Asset Inventory); rule-based waste detection | Resource page shows cost + utilisation + tags; monitoring spend under budget; revoking monitoring role leaves cost views untouched |
| WS-07 Analytics store | Postgres control plane; ClickHouse facts + rollups (partition by month, order tenant/account/date/provider); tags as map + promoted columns; pinned `data_version` reads; rebuild from raw tested | p95 explorer queries <2s on 12mo/50M-row tenant; rollups reproduce raw totals exactly |
| WS-08 Query API | Dimensions, metrics, time grains; typed DSL (metrics, group-by, filters, range, granularity, compare-to, cost basis, currency, top-N + Other); compiler parameterises SQL + injects scopes; envelope on every call; cache keyed by tenant+query+version+scope; REST/OpenAPI, idempotency keys, one error shape | Every UI view expressible in DSL; fuzzing cannot escape tenant scope; contract tests pin OpenAPI |
| WS-09 Web app | Shell (56px top bar, 240px nav, breadcrumbs), URL-stored global filters, Overview, Explorer, Dashboards, Allocation, Budgets, Anomalies, Forecast, Commitments, Recommendations, Reports, Data Health, Connections, Settings; skeletons/empty/error/partial/permission states; WCAG 2.2 AA; LCP <2.5s, INP <200ms | Every screen + state exists; vitals budgets pass in CI; 5 target users complete onboarding + "why did my bill go up" unaided |
| WS-10 Allocation | Org→BU→team→project; rules (account/tag/service/pattern/hierarchy/% splits); shared-cost distribution (fixed/proportional/even); preview before save; versioned rule sets; deterministic re-allocation | Allocated totals = source totals always; untagged spend reported, not hidden |
| WS-11 Budgets & alerts | Scope/period/amount/thresholds (actual + forecast); state OK→Triggered→Acknowledged→Resolved (+Snoozed); dedup/cooldown/quiet hours/escalation; email/Slack/Teams/signed webhooks; test-send + delivery tracking | Breach fires within defined time of publish; no duplicate storm; failed deliveries retried + visible |
| WS-12 Anomaly & forecast | Median/MAD or STL baseline, weekday seasonality, Purchase excluded, min absolute + % thresholds, severity = impact × confidence, contributor decomposition, feedback loop; forecast = ATD + run-rate remainder, band, per-series backtested method, plain-words method | Seeded spike detected with correct attribution, no storm on normal seasonality; forecast error tracked per series |
| WS-13 Commitments & recommendations | Normalised commitment entity (utilisation/coverage/savings rate/unused/expiry); provider-native recommendations + own waste rules; owners, tickets, realised-savings verification | Utilisation matches provider consoles for pilots; every recommendation links to resource + evidence |
| WS-14 Reports & exports | Executive/showback/saved-view/budget/commitment/anomaly reports; PDF (print stylesheet)/CSV/XLSX; scheduled email/Slack/expiring link; white-label; async jobs; FOCUS re-export; formula-injection neutralisation | Scheduled report arrives correct + on time; exported totals = on-screen totals; injection tests pass |
| WS-15 Extended sources | Kubernetes (OpenCost), SaaS/AI spend, unit economics, carbon, more clouds — each a connector + mapping, no UI-core change | New source appears in every existing view with golden-file tests |
| WS-16 AI assistant | NL → typed query API with caller's permissions; explain/compare/drivers/draft budget (confirm first)/saved views/report summaries; grounding links + `data_as_of` + cost basis on every answer; tag text treated as data, never instructions | Evaluation set meets accuracy threshold; adversarial tag prompts cannot change behaviour or leak tenants |
| WS-17 Security | STRIDE threat model; TLS 1.2+, KMS envelope (optional per-tenant keys), secrets manager, CSP/headers, SBOM + pinned deps + scans, break-glass audited, unique ExternalId per connection, privacy/residency, SOC 2 path | Critical/high pen-test findings closed; isolation suite green; evidence collected automatically |
| WS-18 Infra/CI-CD | Terraform, multi-AZ, Postgres PITR, ClickHouse backups, object lifecycle; CI (lint/type/unit/integration/contract/security/SBOM); trunk-based, gated canary/blue-green + auto-rollback; expand-then-contract migrations; feature flags; preview envs; DR RPO 15min / RTO 4h (control plane) | Whole environment rebuilds from code; restore drill meets RPO/RTO; rollback rehearsed |
| WS-19 Observability | Structured logs (tenant/connection/run/request ids, no secrets), OpenTelemetry, ingestion-lag / failure / variance / latency / cache metrics; SLOs: API 99.9%, dashboard p95 <2s, publish <1h after provider delivery, alerts <5min; status page; admin console; runbooks | On-call resolves top-10 failure modes from runbooks; synthetic canary tenant pages on failure |
| WS-20 Quality | Synthetic generator (credits, commitments, marketplace, tax, restatements, messy tags, mixed currencies); unit/golden/property/contract/integration/tenancy/permission/fuzz/load/chaos/component/visual/E2E/a11y/backtest layers; pilot programme (3–5 real orgs) | CI gates block merges on invariant/isolation/a11y failures; every pilot variance case is a regression test |
| WS-21 Plans & metering | Entitlements (accounts, seats, retention, hourly grain, AI queries, exports, SSO) enforced identically in API + UI; metered managed spend + accounts; subscription billing via payments provider | Limits enforced consistently; metered figures match internal data; billing events idempotent |
| WS-22 Docs & onboarding | In-app help + checklist; docs site (concepts, per-provider guides with IaC, "why numbers differ" guide, API reference, changelog, security/privacy, glossary); error-code → fix troubleshooting library | Every error code has a documented fix; links + samples tested in CI |
| WS-23 Write actions (optional, gated) | Stop/start non-prod, tag remediation, unattached-resource deletion — only with separate opt-in role, dry-run preview, approval workflow, blast-radius limits, rollback plan, audit, kill switch, per-tenant flag | Every action has dry run + approval + audit + tested rollback |

## Risks (top)

Totals ≠ invoices (credits/tax/marketplace/timing/restatements) → reconciliation layer
+ month states + golden datasets + pilots. Cross-tenant exposure → RLS + mandatory
scope injection + isolation suite + pen test. Credential compromise / confused deputy
→ unique ExternalId, federation, least privilege, KMS. Provider schema drift →
versioned mappings + drift alerts + contract tests. GCP late export enablement →
"history starts on" labelling. Noisy anomalies → thresholds + feedback + digests.

## What this demo implements vs defers

Implemented now: the full UI surface, query DSL + envelope, synthetic data with all
the messy realities above, anomaly/forecast/budget engines, allocation reconciliation,
IaC snippets + permission checklists, roles matrix + audit table, and all 8 API routes.
Deferred to production: real provider ingestion, Postgres/ClickHouse, auth/SSO,
Temporal workers, notifications delivery, PDF/XLSX generation (CSV works now).
