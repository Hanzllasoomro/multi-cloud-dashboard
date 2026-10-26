import type { Connection } from "../lib/types";
import Badge from "./Badge";
import FreshnessIndicator from "./FreshnessIndicator";
export default function ConnectionCard({ c }: { c: Connection }) {
  const tone = c.status === "Healthy" ? "success" : c.status === "Degraded" ? "warning" : "danger";
  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h3>{c.provider} — {c.name}</h3><Badge tone={tone}>{c.status}</Badge></div>
      <p className="small muted">Billing account {c.billingAccount} · {c.accounts} sub-account(s) · Last sync {c.lastSync}</p>
      <FreshnessIndicator freshness={c.freshness} monthState={c.monthState} reconciliation={c.reconciliation} dataAsOf={c.dataAsOf} />
      <p className="small">Reconciliation variance {c.variancePct.toFixed(2)}% (open-month tolerance 0.5%, final-month 0.01%).</p>
    </article>
  );
}
