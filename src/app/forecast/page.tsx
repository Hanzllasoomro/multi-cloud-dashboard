"use client";
import { useMemo } from "react";
import { allRows } from "../../lib/data";
import { forecastMonth } from "../../lib/insights";
import { LineChart } from "../../components/Charts";
import { fmtMoneyFull, fmtMonth } from "../../lib/format";
import DataTable from "../../components/DataTable";
import { useScenarioRows } from "../../components/useScenarioRows";
export default function Forecast() {
  const baseRows = useMemo(() => allRows(), []);
  const { rows } = useScenarioRows(baseRows);
  const points = useMemo(() => forecastMonth(rows), [rows]);
  const oct = points.find((p) => p.month === "2026-10");
  return (
    <div>
      <h1>Forecast</h1>
      <p className="muted">Month-end forecast = actual-to-date + projected remainder (run rate, weekday-adjusted, fixed/scheduled charges added, one-offs removed). Method is chosen per series by backtest, with a linear fallback when data is thin — and always stated in plain words.</p>
      {oct && <section className="card" style={{ marginBottom: 16 }}><h2>October 2026 month-end</h2><p style={{ fontSize: 22, fontWeight: 700 }}>{fmtMoneyFull(oct.forecast)} <span className="small muted">range {fmtMoneyFull(oct.low)} – {fmtMoneyFull(oct.high)}</span></p><p className="small">{oct.method}</p></section>}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Actual vs forecast band</h2>
        <LineChart series={[{ label: "Actual / forecast", values: points.map((p) => p.actual ?? p.forecast) }]} labels={points.map((p) => fmtMonth(p.month))} band={{ low: points.map((p) => p.low), high: points.map((p) => p.high) }} />
      </section>
      <section className="card">
        <h2>Monthly forecast table</h2>
        <DataTable columns={[
          { key: "m", header: "Month", render: (r) => fmtMonth(r.month) },
          { key: "a", header: "Actual", numeric: true, render: (r) => r.actual !== null ? fmtMoneyFull(r.actual) : "—" },
          { key: "f", header: "Forecast", numeric: true, render: (r) => fmtMoneyFull(r.forecast), sortValue: (r) => r.forecast },
          { key: "b", header: "Band", render: (r) => `${fmtMoneyFull(r.low)} – ${fmtMoneyFull(r.high)}` },
          { key: "me", header: "Method", render: (r) => r.method },
        ]} rows={points} />
      </section>
    </div>
  );
}
