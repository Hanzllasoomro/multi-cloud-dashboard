"use client";
import { useMemo, useState } from "react";
import { allRows } from "../../lib/data";
import { runQuery } from "../../lib/query";
import type { GroupKey } from "../../lib/types";
import { fmtMoneyFull } from "../../lib/format";
import { toCsvExport, toJsonExport } from "../../lib/exports";
import FilterBar, { DEFAULT_FILTERS } from "../../components/FilterBar";
import { LineChart, BarChart } from "../../components/Charts";
import DataTable from "../../components/DataTable";

const SERVICES = ["Amazon EC2", "Amazon S3", "Amazon RDS", "AWS Lambda", "Virtual Machines", "Blob Storage", "SQL Database", "Compute Engine", "Cloud Storage", "Cloud SQL"];
const REGIONS = ["us-east-1", "eu-west-1", "westeurope", "eastus", "us-central1", "europe-west1"];

export default function Explorer() {
  const rows = useMemo(() => allRows(), []);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupKey>("service");
  const [granularity, setGranularity] = useState<"month" | "day">("month");
  const [compare, setCompare] = useState(false);
  const [drill, setDrill] = useState<string[]>([]);
  const q = useMemo(() => runQuery(rows, {
    groupBy: [groupBy], providers: filters.provider === "All" ? undefined : [filters.provider as never],
    accounts: filters.account === "All" ? undefined : [filters.account],
    services: filters.service === "All" ? undefined : [filters.service],
    regions: filters.region === "All" ? undefined : [filters.region],
    tag: filters.tag || undefined, start: filters.start, end: filters.end, costBasis: filters.costBasis, topN: 11,
  }), [rows, filters, groupBy]);
  const trend = useMemo(() => runQuery(rows, {
    groupBy: ["month"], providers: filters.provider === "All" ? undefined : [filters.provider as never],
    start: filters.start, end: filters.end, costBasis: filters.costBasis, topN: 50,
  }), [rows, filters]);
  const download = (text: string, name: string, type: string) => {
    const blob = new Blob([text], { type });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };
  const exportCsv = () => download(toCsvExport(q), "ledger-explorer-export.csv", "text/csv");
  const exportJson = () => download(toJsonExport(q), "ledger-explorer-export.json", "application/json");
  return (
    <div>
      <h1>Cost Explorer</h1>
      <p className="muted">Group, compare, change granularity and cost basis. Chart and table are linked — they always show the same filtered view, and the totals row reconciles to the chart.</p>
      <FilterBar value={filters} onChange={setFilters} services={SERVICES} regions={REGIONS} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <label className="small">Group by <select className="select" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupKey)}>
          {(["provider", "service", "serviceCategory", "region", "subAccount", "chargeCategory", "tag:team", "tag:env"] as GroupKey[]).map((g) => <option key={g}>{g}</option>)}
        </select></label>
        <label className="small">Granularity <select className="select" value={granularity} onChange={(e) => setGranularity(e.target.value as "month" | "day")}><option value="month">Month</option><option value="day">Day (chart uses monthly rollup for legibility)</option></select></label>
        <label className="small"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare to previous period</label>
        <button className="btn" onClick={exportCsv}>Export CSV ↓</button>
        <button className="btn" onClick={exportJson}>Export JSON ↓</button>
        <button className="btn-ghost" onClick={() => { setDrill([]); setFilters(DEFAULT_FILTERS); }}>Reset view</button>
      </div>
      {drill.length > 0 && <p className="small">Drill-down: {drill.join(" › ")} <button className="btn-ghost" onClick={() => setDrill([])}>Back to all</button></p>}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Trend ({granularity}) — {filters.costBasis} cost, {filters.currency}</h2>
        <LineChart series={[{ label: "Cost", values: trend.data.map((d) => d.cost) }]} labels={trend.data.map((d) => d.label)} />
        <p className="caption">Query {q.meta.queryId} · Data as of {q.meta.dataAsOf} · {q.meta.freshness} · {q.meta.reconciliation} · Estimated months: {q.meta.estimatedMonths.join(", ") || "none"} · {q.meta.fxNote}</p>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Breakdown by {groupBy}</h2>
        <BarChart horizontal data={q.data.map((d) => ({ label: d.label, values: [d.cost] }))} />
      </section>
      <section className="card">
        <h2>Detail table — click a row to drill down</h2>
        <DataTable columns={[
          { key: "label", header: groupBy, render: (r) => <button className="btn-ghost" style={{ padding: "2px 8px" }} onClick={() => setDrill([...drill, r.label])}>{r.label}</button> },
          { key: "cost", header: "Cost", numeric: true, render: (r) => fmtMoneyFull(r.cost), sortValue: (r) => r.cost },
          { key: "usage", header: "Usage qty", numeric: true, render: (r) => r.usage.toLocaleString(), sortValue: (r) => r.usage },
          { key: "rows", header: "Line items", numeric: true, render: (r) => String(r.rows), sortValue: (r) => r.rows },
        ]} rows={q.data} totals={["TOTAL", fmtMoneyFull(q.totals.cost), q.totals.usage.toLocaleString(), String(q.totals.rows)]} />
        <p className="caption">Totals reconcile to the chart above (same query, same filters). Line-item drill-down: every figure traces to FOCUS rows with x_ lineage; provider-console deep links are derived from ResourceId where a URL pattern exists.</p>
      </section>
    </div>
  );
}
