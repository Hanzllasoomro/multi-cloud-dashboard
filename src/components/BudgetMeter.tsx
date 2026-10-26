import { fmtMoneyFull } from "../lib/format";
export default function BudgetMeter({ name, scope, amount, actual, forecast }: { name: string; scope: string; amount: number; actual: number; forecast: number }) {
  const pct = Math.min(100, (forecast / amount) * 100);
  const tone = pct >= 100 ? "var(--red-600)" : pct >= 80 ? "var(--amber-600)" : "var(--green-600)";
  return (
    <div className="card">
      <h3>{name}</h3><p className="muted small">{scope}</p>
      <div style={{ height: 12, background: "var(--bg-sunken)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${name} forecast ${Math.round(pct)}% of budget`} />
      </div>
      <p className="small">Actual {fmtMoneyFull(actual)} · Forecast {fmtMoneyFull(forecast)} of {fmtMoneyFull(amount)} ({pct.toFixed(0)}% of budget)</p>
    </div>
  );
}
