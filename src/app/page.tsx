"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { allRows, CONNECTIONS, monthCost, monthlyTotals, RECOMMENDATIONS } from "../lib/data";
import { runQuery } from "../lib/query";
import { currentMonthForecast, detectAnomalies, evaluateBudgets } from "../lib/insights";
import { fmtMoneyCompact, fmtMoneyFull, fmtMonth } from "../lib/format";
import KpiCard from "../components/KpiCard";
import { LineChart, DonutChart, BarChart } from "../components/Charts";
import DataTable from "../components/DataTable";
import AnomalyCard from "../components/AnomalyCard";
import BudgetMeter from "../components/BudgetMeter";

export default function Overview() {
  const rows = useMemo(() => allRows(), []);
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
  const fcSeries = months.map((m) => m.month === "2026-10" ? fc.forecast : m.cost);
  // Unit economics (labelled): total 12-month cost / days in the demo range.
  const [accounts, setAccounts] = useState<{ displayName: string; status: string }[] | null>(null);
  useEffect(() => { fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.data)).catch(() => undefined); }, []);
  const flagged = (accounts || []).filter((a) => a.status === "Paused" || a.status === "Broken");
  const total12 = months.reduce((a, m) => a + m.cost, 0);
  const daysInRange = Math.round((new Date(2026, 9, 26).getTime() - new Date(2025, 10, 1).getTime()) / 86400000) + 1;
  const costPerDay = total12 / daysInRange;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted" style={{ margin: 0 }}>Spend, forecast, budgets and savings — across AWS, Azure and GCP.</p>
        </div>
        <div className="page-actions">
          <Link href="/explorer" className="btn">+ Explore costs</Link>
          <Link href="/demo" className="btn-ghost">Judge walkthrough</Link>
        </div>
      </div>
      {accounts && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>Connected accounts</h2>
          <p><strong>{accounts.length}</strong> connected · <strong>{accounts.filter((a) => a.status !== "Paused").length}</strong> active
            {flagged.length > 0 && <> · ⚠ Paused / broken: {flagged.map((a) => a.displayName).join(", ")} — paused accounts are excluded from API query totals.</>}
            {" "}Manage them in <Link href="/settings">Settings › Connected accounts</Link>.</p>
        </section>
      )}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <KpiCard tone="hero" label="Month-to-date spend (Oct 2026)" value={fmtMoneyFull(mtd)} deltaPct={delta} href="/explorer" spark={months.slice(-6).map((m) => m.cost)} estimated />
        <KpiCard label="Month-end forecast" value={fmtMoneyFull(fc.forecast)} kind="plain" href="/forecast" spark={months.slice(-6).map((m) => m.cost)} estimated caption="Estimated month-end" />
        <KpiCard label="Potential savings / month" value={fmtMoneyCompact(savings)} kind="plain" href="/recommendations" caption="Open recommendations" />
        <KpiCard label="Open anomalies" value={String(anomalies.length)} kind="plain" href="/anomalies" caption="Needs review" />
      </div>
      <section className="dark-card" style={{ marginBottom: 16 }}>
        <h2 style={{ color: "#fff" }}>Cost per day — unit economics (labelled)</h2>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "6px 0" }} className="tnum">{fmtMoneyFull(costPerDay)} / day</p>
        <p>{fmtMoneyFull(total12)} over {daysInRange} days (Nov 2025 – Oct 2026, all providers). Use it as cost per day, then divide by your own unit (customers, requests, orders) for cost per unit; see docs/REAL_ACCOUNTS.md for the unit-economics extension. Budget vs forecast for the total is in <Link href="/budgets">Budget status</Link> below.</p>
      </section>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card"><h2>Trend + forecast band</h2>
          <LineChart series={[{ label: "Monthly spend", values: months.map((m) => m.cost) }, { label: "Forecast", values: fcSeries }]} labels={months.map((m) => fmtMonth(m.month))} band={{ low: months.map((m) => m.month === "2026-10" ? fc.low : m.cost * 0.97), high: months.map((m) => m.month === "2026-10" ? fc.high : m.cost * 1.03) }} />
          <p className="caption">October is Estimated (actual-to-date + run rate). Band: ±8% for the open month. Forecast range {fmtMoneyFull(fc.low)} – {fmtMoneyFull(fc.high)}.</p>
        </section>
        <section className="card"><h2>Provider split (12 months)</h2><DonutChart data={byProvider.map((d) => ({ label: d.label, value: d.cost }))} /></section>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card"><h2>Top services</h2><BarChart horizontal data={byService.map((d) => ({ label: d.label, values: [d.cost] }))} /></section>
        <section className="card"><h2>Top accounts</h2><BarChart horizontal data={byAccount.map((d) => ({ label: d.label, values: [d.cost] }))} /></section>
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
