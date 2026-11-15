"use client";
import { useMemo } from "react";
import Link from "next/link";
import { allRows, CONNECTIONS, monthCost, monthlyTotals, RECOMMENDATIONS } from "../../lib/data";
import { runQuery } from "../../lib/query";
import { currentMonthForecast, detectAnomalies, evaluateBudgets } from "../../lib/insights";
import { fmtMoneyCompact, fmtMoneyFull, fmtMonth } from "../../lib/format";
import KpiCard from "../../components/KpiCard";
import { LineChart, DonutChart, BarChart, StackedBarChart, WaterfallChart, PROVIDER_COLORS } from "../../components/Charts";
import { attentionBullets, monthlySpendByProvider, providerMoM, taggingCompliance } from "../../lib/governance";
import DataTable from "../../components/DataTable";
import AnomalyCard from "../../components/AnomalyCard";
import BudgetMeter from "../../components/BudgetMeter";
import { useScenarioRows } from "../../components/useScenarioRows";

export default function Overview() {
  const baseRows = useMemo(() => allRows(), []);
  const { rows, scenario, updatedAt } = useScenarioRows(baseRows);
  const months = useMemo(() => monthlyTotals(rows), [rows]);
  const mtd = monthCost(rows, "2026-10");
  const last = monthCost(rows, "2026-09");
  const fc = currentMonthForecast(rows);
  const anomalies = useMemo(() => detectAnomalies(rows), [rows]);
  const budgets = useMemo(() => evaluateBudgets(rows), [rows]);
  const savings = RECOMMENDATIONS.filter((r) => r.status === "Open").reduce((a, r) => a + r.monthlySavings, 0);
  const byProvider = runQuery(rows, { groupBy: ["provider"], start: "2025-11-01", end: "2026-10-26", topN: 10 }).data;
  const byService = runQuery(rows, { groupBy: ["service"], start: "2025-11-01", end: "2026-10-26", topN: 6 }).data;
  const byAccount = runQuery(rows, { groupBy: ["subAccount"], start: "2025-11-01", end: "2026-10-26", topN: 6 }).data;
  const delta = last ? ((mtd - last) / last) * 100 : null;
  // Governance views (v1.10, Metabase pattern): MoM uses the last two
  // *completed* months (Aug -> Sep) — October is partial (data as of Oct 26).
  const mom = providerMoM(rows, "2026-08", "2026-09");
  const tagging = taggingCompliance(rows);
  const bullets = attentionBullets(rows, {
    prevMonth: "2026-08", curMonth: "2026-09", openMonth: "2026-10",
    openMonthForecast: fc.forecast, openMonthActual: mtd,
    topAnomaly: anomalies[0] ? { service: anomalies[0].service, provider: anomalies[0].provider, month: anomalies[0].date.slice(0, 7), actual: anomalies[0].actual, expected: anomalies[0].expected, deltaPct: anomalies[0].deltaPct } : null,
    triggeredBudgets: budgets.filter((b) => b.status === "Triggered").map((b) => b.name),
  });
  const topServices = useMemo(() => {
    const svcs = [...new Set(rows.map((r) => r.service))];
    return svcs.map((svc) => {
      const sub = rows.filter((r) => r.service === svc);
      const oct = monthCost(sub, "2026-10");
      const sep = monthCost(sub, "2026-09");
      return { service: svc, provider: sub[0].provider, oct, sep, pct: sep ? ((oct - sep) / sep) * 100 : null };
    }).sort((a, b) => b.oct - a.oct).slice(0, 6);
  }, [rows]);
  const fcSeries = months.map((m) => m.month === "2026-10" ? fc.forecast : m.cost);
  // Unit economics: total 12-month cost / days in range.
  const total12 = months.reduce((a, m) => a + m.cost, 0);
  const daysInRange = Math.round((new Date(2026, 9, 26).getTime() - new Date(2025, 10, 1).getTime()) / 86400000) + 1;
  const costPerDay = total12 / daysInRange;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted" style={{ margin: 0 }}>Spend, forecast, budgets and savings — across AWS, Azure and GCP.</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            <span style={{ color: "#175E3B" }}>● Live</span>
            {scenario?.active ? " — demo scenario active, updates automatically" : " — updates automatically when Demo Studio saves"}
            {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/explorer" className="btn">+ Explore costs</Link>
          <Link href="/demo" className="btn-ghost">Judge walkthrough</Link>
        </div>
      </div>
      <h2>1 · Governance at a glance</h2>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <KpiCard tone="hero" label="Month-to-date spend (Oct 2026)" value={fmtMoneyFull(mtd)} deltaPct={delta} href="/explorer" spark={months.slice(-6).map((m) => m.cost)} estimated />
        <KpiCard label="Month-end forecast" value={fmtMoneyFull(fc.forecast)} kind="plain" href="/forecast" spark={months.slice(-6).map((m) => m.cost)} estimated caption="Estimated month-end" />
        <KpiCard label="Potential savings / month" value={fmtMoneyCompact(savings)} kind="plain" href="/recommendations" caption="Open recommendations" />
        <KpiCard label="Open anomalies" value={String(anomalies.length)} kind="plain" href="/anomalies" caption="Needs review" />
      </div>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>📌 What needs attention</h2>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
          {bullets.map((b) => <li key={b.slice(0, 40)}>{b}</li>)}
        </ul>
        <p className="caption">Generated from the same rows as the charts below — month-over-month change uses Aug → Sep (the last two completed months); October is partial.</p>
      </section>
      <section className="dark-card" style={{ marginBottom: 16 }}>
        <h2 style={{ color: "#fff" }}>Cost per day</h2>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "6px 0" }} className="tnum">{fmtMoneyFull(costPerDay)} / day</p>
        <p>{fmtMoneyFull(total12)} over {daysInRange} days (Nov 2025 – Oct 2026, all providers).</p>
      </section>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card"><h2>Trend + forecast band</h2>
          <LineChart series={[{ label: "Monthly spend", values: months.map((m) => m.cost) }, { label: "Forecast", values: fcSeries }]} labels={months.map((m) => fmtMonth(m.month))} band={{ low: months.map((m) => m.month === "2026-10" ? fc.low : m.cost * 0.97), high: months.map((m) => m.month === "2026-10" ? fc.high : m.cost * 1.03) }} />
          <p className="caption">October is Estimated (actual-to-date + run rate). Band: ±8% for the open month. Forecast range {fmtMoneyFull(fc.low)} – {fmtMoneyFull(fc.high)}.</p>
        </section>
        <section className="card"><h2>Provider split (12 months)</h2><DonutChart data={byProvider.map((d) => ({ label: d.label, value: d.cost }))} /></section>
      </div>
      <h2>2 · Spend by provider</h2>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card"><h2>Monthly spend by provider</h2><StackedBarChart data={monthlySpendByProvider(rows).slice(-6)} /></section>
        <section className="card"><h2>Aug → Sep spend change by provider</h2><WaterfallChart data={[...mom.changes.map((c) => ({ label: c.provider, value: c.change, color: PROVIDER_COLORS[c.provider] })), { label: "Total", value: mom.total.change, color: "#2A3342" }]} /><p className="caption">Who caused the {mom.total.change >= 0 ? "increase" : "decrease"}? {mom.changes[0].provider} moved most ({mom.changes[0].change >= 0 ? "+" : "−"}${Math.abs(Math.round(mom.changes[0].change)).toLocaleString()}).</p></section>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card"><h2>Top services</h2><BarChart horizontal data={byService.map((d) => ({ label: d.label, values: [d.cost] }))} /></section>
        <section className="card"><h2>Top accounts</h2><BarChart horizontal data={byAccount.map((d) => ({ label: d.label, values: [d.cost] }))} /></section>
      </div>
      <h2>3 · Tagging &amp; services</h2>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card"><h2>Tagging compliance by provider</h2>
          <p className="muted" style={{ marginTop: 0 }}>Share of spend carrying a team tag — {tagging.overall.taggedPct.toFixed(1)}% tagged overall, {tagging.overall.untaggedPct.toFixed(1)}% untagged. Above 90% is a realistic steady state; 100% is not, because some spend cannot carry a team tag.</p>
          {tagging.byProvider.map((c) => (
            <div key={c.provider} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span><span style={{ color: PROVIDER_COLORS[c.provider] }}>■</span> {c.provider}</span><strong>{c.taggedPct.toFixed(1)}% tagged</strong></div>
              <div style={{ height: 20, borderRadius: 999, background: "var(--n-100)", overflow: "hidden", marginTop: 4 }} title={`${c.provider}: ${c.taggedPct.toFixed(1)}% of $${Math.round(c.totalCost).toLocaleString()} tagged`}>
                <div style={{ width: `${c.taggedPct}%`, height: "100%", background: PROVIDER_COLORS[c.provider] }} />
              </div>
            </div>
          ))}
          <p className="caption">Full 0–100% scale — small differences are not exaggerated. Tags are normalised (trim + lowercase) before counting; blank team tags count as untagged.</p>
        </section>
        <section className="card"><h2>Top services by spend (Oct)</h2>
          <DataTable columns={[
            { key: "service", header: "Service", render: (r: (typeof topServices)[number]) => r.service },
            { key: "provider", header: "Provider", render: (r: (typeof topServices)[number]) => r.provider },
            { key: "oct", header: "Oct spend", numeric: true, render: (r: (typeof topServices)[number]) => fmtMoneyFull(r.oct), sortValue: (r) => r.oct },
            { key: "mom", header: "MoM", numeric: true, render: (r: (typeof topServices)[number]) => r.pct === null ? "—" : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%`, sortValue: (r) => r.pct ?? 0 },
          ]} rows={topServices} />
          <p className="caption">October is partial (data as of Oct 26), so MoM compares a partial month against full September — treat the % as indicative, not final.</p>
        </section>
      </div>
      <h2>Budget status</h2>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>{budgets.map((b) => <BudgetMeter key={b.id} name={b.name} scope={b.scope} amount={b.amount} actual={b.actual} forecast={b.forecast} />)}</div>
      <h2>Latest anomalies</h2>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>{anomalies.slice(0, 2).map((a) => <AnomalyCard key={a.id} a={a} />)}</div>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Data health</h2>
        <DataTable columns={[
          { key: "p", header: "Provider", render: (r: typeof CONNECTIONS[number]) => r.provider },
          { key: "s", header: "Status", render: (r: typeof CONNECTIONS[number]) => r.status },
          { key: "f", header: "Freshness", render: (r: typeof CONNECTIONS[number]) => r.freshness },
          { key: "v", header: "Variance %", numeric: true, render: (r: typeof CONNECTIONS[number]) => `${r.variancePct.toFixed(2)}%`, sortValue: (r) => r.variancePct },
        ]} rows={CONNECTIONS} />
        <p className="caption">Azure is Degraded / Delayed with 0.68% variance — above the 0.5% open-month tolerance, so it shows as Variance. See <a href="/data-health">Data Health</a>.</p>
      </section>
    </div>
  );
}
