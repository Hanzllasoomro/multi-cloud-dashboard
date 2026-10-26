import type { Recommendation } from "../lib/types";
import { fmtMoneyFull } from "../lib/format";
import Badge from "./Badge";
export default function RecommendationCard({ r }: { r: Recommendation }) {
  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h3>{r.title}</h3><Badge tone="success">Save {fmtMoneyFull(r.monthlySavings)}/mo</Badge></div>
      <p className="small muted">{r.category} · {r.provider} · {r.resource} · Source: {r.source} (provider estimate, labelled as such)</p>
      <p className="small">Effort: {r.effort} · Risk: {r.risk} · Status: {r.status}</p>
      <p className="caption">No action is taken automatically. Accepting a recommendation only records the decision; write actions are a separately gated workstream (WS-23).</p>
    </article>
  );
}
