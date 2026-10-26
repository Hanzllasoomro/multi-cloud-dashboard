import type { Anomaly } from "../lib/types";
import { fmtMoneyFull } from "../lib/format";
import Badge from "./Badge";
export default function AnomalyCard({ a }: { a: Anomaly }) {
  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h3>{a.series}</h3>
        <Badge tone={a.severity === "High" ? "danger" : a.severity === "Medium" ? "warning" : "info"}>{a.severity} severity</Badge>
      </div>
      <p>Actual {fmtMoneyFull(a.actual)} vs expected {fmtMoneyFull(a.expected)} — <strong>{fmtMoneyFull(a.delta)} (+{a.deltaPct}%)</strong> on {a.date}. Status: {a.status}.</p>
      <p className="small muted">Top contributors (root-cause decomposition):</p>
      <ul>{a.contributors.map((c) => <li key={c.label} className="small">{c.label}: {fmtMoneyFull(c.amount)}</li>)}</ul>
      <p className="caption">Method: median/MAD baseline, min $500 and 25% thresholds; Purchase charges excluded so commitment buys never look like spikes.</p>
    </article>
  );
}
