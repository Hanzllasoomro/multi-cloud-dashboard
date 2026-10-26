import type { Freshness, MonthState, Reconciliation } from "../lib/types";
import Badge from "./Badge";
const tone: Record<Freshness, "success" | "warning" | "danger"> = { Fresh: "success", Delayed: "warning", Stale: "danger", Failed: "danger" };
export default function FreshnessIndicator({ freshness, monthState, reconciliation, dataAsOf }: { freshness: Freshness; monthState: MonthState; reconciliation: Reconciliation; dataAsOf: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} aria-label={`Data as of ${dataAsOf}, ${freshness}, ${monthState}, ${reconciliation}`}>
      <Badge tone={tone[freshness]}>{freshness}</Badge>
      <Badge tone={monthState === "Final" ? "success" : monthState === "Provisional" ? "info" : "warning"}>{monthState}</Badge>
      <Badge tone={reconciliation === "Reconciled" ? "success" : reconciliation === "Variance" ? "warning" : "neutral"}>{reconciliation}</Badge>
      <span className="small muted">Data as of {dataAsOf}</span>
    </span>
  );
}
