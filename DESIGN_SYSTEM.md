# Design System — Ledger

> **v1.4 UI refresh (2026-10-27):** inspired by the Dribbble "Task Management Dashboard" shot the user linked — pale warm-gray canvas, one white rounded (24px) frame, grouped sidebar (Menu / General) with a green active indicator, pill buttons, 20px cards, capsule chart bars with a hatched "remaining" track, a deep-forest hero stat card, and a dark cost-per-day card. Adapted, not copied: no Donezo branding, names, or sample tasks; Ledger data, routes, and cost-up-red / cost-down-green rules are unchanged. Primary action colour moved from Ledger blue #2756D6 to deep forest green #175E3B; Okabe-Ito chart series are unchanged.

Working name: **Ledger**. Numbers first; trust visible; calm density; one way to do
one thing; never colour alone; provider-neutral; explain, don't just show;
accessible by construction. Implemented in `src/app/globals.css` as CSS variables;
product code consumes semantic tokens only (a lint rule should reject raw values).

## Tokens

Three tiers: **primitive** (raw values, never used directly) → **semantic**
(bg/surface/text/border/action/status) → **component** (inside component styles
only). Naming: `category.property.role.variant.state`
(e.g. `color.border.control.default`). Modes: light, dark (`[data-theme="dark"]`),
high contrast (future); density comfortable/default/compact (future setting);
optional organisation accent for white-label customers.

### Primitives — neutrals

| Step | Value |
|---|---|
| 0 / 25 / 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900 / 950 | #FFFFFF / #FAFBFC / #F5F7FA / #EBEEF3 / #DDE2EA / #C5CCD8 / #9AA4B5 / #707B8E / #546073 / #3F4A5C / #2A3342 / #1A212D / #0F141C |

### Primitives — brand & status scales

- **Blue (brand, action):** 50 #EEF4FF · 100 #DCE8FF · 200 #BAD1FF · 300 #8CB1FF · 400 #5C8EFA · 500 #3B6FEF · **600 #2756D6** · 700 #1F44AD · 800 #1D3A8A · 900 #1B3269
- **Green (success, cost down):** 50 #ECFDF3 · 100 #D1FADF · 200 #ABEFC6 · 300 #75E0A7 · 500 #12B76A · 600 #079455 · **700 #067647** · 800 #085D3A
- **Amber (warning):** 50 #FFFAEB · 100 #FEF0C7 · 200 #FEDF89 · 300 #FEC84B · 500 #F79009 · 600 #DC6803 · **700 #B54708** · 800 #93370D
- **Red (danger, cost up):** 50 #FEF3F2 · 100 #FEE4E2 · 200 #FECDCA · 300 #FDA29B · 500 #F04438 · 600 #D92D20 · **700 #B42318** · 800 #912018
- **Sky (info):** 50 #F0F9FF · 100 #E0F2FE · 200 #BAE6FD · 300 #7DD3FC · 500 #0EA5E9 · 600 #0284C7 · **700 #0369A1**

### Contrast rules (computed on white)

Blue-600 ≈ 6.2:1 · neutral-600 ≈ 6.4:1 · green-700 ≈ 5.7:1 · amber-700 ≈ 5.4:1 ·
red-700 ≈ 6.6:1 · sky-700 ≈ 5.9:1. By contrast green-600 ≈ 3.9:1, red-600 ≈ 4.8:1,
neutral-500 ≈ 4.3:1. **Therefore: status text uses the 700 step; 600/500 steps are
for fills and icons only; neutral-500 is for control borders and icons, never body
text.** Automated tests must fail the build when any text token pair misses its
contrast requirement in any mode.

### Semantic tokens (light → dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.canvas` | neutral-50 | neutral-950 | Page background |
| `bg.surface` | neutral-0 | neutral-900 | Cards, tables, panels |
| `bg.raised` | neutral-0 + shadow | neutral-800 | Menus, popovers, dialogs |
| `bg.sunken` | neutral-100 | neutral-950 | Inset areas, table headers, code |
| `bg.hover` | neutral-100 | neutral-800 | Row/item hover |
| `bg.selected` | blue-50 | blue-900 at 40% | Selected row/item |
| `text.primary` | neutral-900 | neutral-50 | Body, headings |
| `text.secondary` | neutral-700 | neutral-300 | Supporting text |
| `text.tertiary` | neutral-600 | neutral-400 | Captions, placeholders |
| `text.link` | blue-700 | blue-300 | Links |
| `border.default` / `border.strong` | neutral-200 / neutral-300 | neutral-800 / neutral-700 | Borders |

### Data series — Okabe-Ito (colour-blind safe)

`#0072B2` · `#C77700` · `#009E73` · `#CC79A7` · `#7B5EA7` · `#D55E00`.
Every series is also labelled (legend + `<title>`); colour is never the only carrier.

## Typography

- **Font:** Inter stack (`Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).
  Monospace only for keys/figures where specified.
- **Numbers:** tabular figures everywhere (`font-variant-numeric: tabular-nums`,
  class `.tnum`); currency right-aligned in tables.
- **Scale:** H1 24px · H2 17px · H3 15px · body 14px · small/caption 12px.
- **Formatting:** compact KPI `$1.24M`; full table `$1,234,567.89`; signed deltas
  `▲ $1,234.00` / `▼ $1,234.00`; true minus `−` (U+2212), never hyphen-minus;
  `$0.00` for a real zero vs `—` for missing; dates `Oct 26, 2026`.
- **Direction of change:** cost up = red, cost down = green; usage change = neutral
  (a usage rise is not inherently bad). Always arrow + text, never colour alone.

## Spacing, radius, elevation, focus

- Spacing: 4 / 8 / 12 / 16 / 24 / 32px scale.
- Radius: 2 / 4 / 6 / 8 / 12 / 999px (999 = pills/chips).
- Elevation: `sm` 0 1px 2px rgba(15,20,28,.06) · `md` 0 4px 16px rgba(15,20,28,.10).
- Focus ring: **2px #2756D6** (`:focus-visible`, no outline suppression without it).

## Components

| Component | Rules |
|---|---|
| AppShell | Top bar 56px (org switcher, freshness indicator, theme toggle, user menu); nav 240px; breadcrumbs; demo-data banner on every page |
| KpiCard | Label, value, delta (cost/usage rule above), sparkline, `Est.` badge when estimated, link to Explorer, `aria-label` with value |
| FreshnessIndicator | Fresh/Delayed/Stale/Failed + Estimated/Provisional/Final + Reconciled/Variance/Unable to verify + "Data as of" — always together |
| DataTable | Sortable headers with `aria-sort`, totals row reconciled to the chart, right-aligned tabular currency, empty state with next action, error state with request id |
| FilterBar | Date range, provider, account, service, region, tag, cost basis, currency; active filters as removable chips; "Clear all" |
| Chart adapter | `Chart type="line"\|"bar"\|"hbar"\|"donut"` — views never import a chart library; SVG only, labelled series, forecast band, dashed forecast line |
| Badge | Icon + text + 700-step text on tinted bg; tones success/warning/danger/info/neutral |
| BudgetMeter | Progress bar with `role="progressbar"` + `aria-valuenow`; 80% amber, 100% red thresholds |
| AnomalyCard | Severity badge, actual vs expected, delta, top contributors, method in plain words |
| RecommendationCard | Savings badge (provider estimate, labelled), effort/risk/status, "no automatic action" note |
| ConnectionCard | Status badge + freshness trio + variance % + tolerance |

## Chart rules

- Long series are downsampled before drawing; tables are virtualised in production.
- Forecast is a dashed line + shaded band (low–high), labelled as a band, never as a single point.
- Donut centre shows the total; legend shows label + value + share %.
- Stacked bars keep series order stable across views; "Other" bucket is always last and labelled.

## State matrix (every component, every view)

Loading skeleton · Empty (with next action) · Error (with request id) · Partial data
· Stale data (banner, not silent) · Permission denied · Onboarding (checklist).
Print stylesheet: same tokens, charts as static SVG, no navigation.

## Theming & i18n

Light + dark via `[data-theme]`; high-contrast mode follows the same token pipeline.
Strings are kept out of components where practical; RTL readiness is a layout
requirement (no hard-coded left/right positioning in new components).
