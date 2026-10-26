import Link from "next/link";
import { fmtMoneyCompact } from "../lib/format";
// Cost up = red, cost down = green; usage change = neutral (never colour alone: arrow + text).
export default function KpiCard({ label, value, deltaPct, kind = "cost", href, spark, estimated }: {
  label: string; value: string; deltaPct?: number | null; kind?: "cost" | "usage" | "plain"; href?: string; spark?: number[]; estimated?: boolean;
}) {
  const colour = kind === "cost" ? (deltaPct && deltaPct > 0 ? "var(--status-danger-text)" : "var(--status-success-text)") : "var(--text-secondary)";
  const sparkPath = spark && spark.length > 1 ? spark.map((v, i) => `${(i / (spark.length - 1)) * 100},${28 - (v / Math.max(...spark)) * 24}`).join(" ") : "";
  return (
    <div className="card" aria-label={`${label}: ${value}`}>
      <div className="small muted">{label} {estimated && <span>· Est.</span>}</div>
      <div className="tnum" style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      {deltaPct !== undefined && deltaPct !== null && (
        <div style={{ color: colour, fontSize: 13, fontWeight: 600 }}>{deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}% vs last month</div>
      )}
      {spark && <svg viewBox="0 0 100 30" width="100%" height="30" role="img" aria-label="Trend sparkline"><polyline points={sparkPath} fill="none" stroke="var(--series-1)" strokeWidth="2" /></svg>}
      {href && <div><Link href={href}>View in Explorer →</Link></div>}
    </div>
  );
}
export { fmtMoneyCompact };
