"use client";
import { useMemo, useState } from "react";
import { allRows } from "../../lib/data";
import { detectAnomalies } from "../../lib/insights";
import AnomalyCard from "../../components/AnomalyCard";
export default function Anomalies() {
  const [filter, setFilter] = useState("All");
  const all = useMemo(() => detectAnomalies(allRows()), []);
  const list = filter === "All" ? all : all.filter((a) => a.severity === filter);
  return (
    <div>
      <h1>Anomalies</h1>
      <p className="muted">Seasonality-aware median/MAD baseline per series (account, service, top account-by-service pairs). Requires both a minimum absolute amount ($500) and a minimum percentage change (25%). Marking an anomaly “Expected” or “Not useful” suppresses and tunes future detection.</p>
      <label className="small">Severity <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></label>
      <div className="grid grid-2" style={{ marginTop: 16 }}>{list.map((a) => <AnomalyCard key={a.id} a={a} />)}</div>
      {list.length === 0 && <p className="muted">No anomalies at this severity. Cold start (under 28 days of history) uses simple rules.</p>}
    </div>
  );
}
