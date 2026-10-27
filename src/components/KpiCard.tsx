import Link from "next/link";
import { fmtMoneyCompact } from "../lib/format";
// Cost up = red, cost down = green; usage change = neutral (never colour alone: arrow + text).
// v1.4: rounded stat card with a circled arrow, pill delta, and an optional dark hero tone.
export default function KpiCard({ label, value, deltaPct, kind = "cost", href, spark, estimated, tone, caption }: {
  label: string; value: string; deltaPct?: number | null; kind?: "cost" | "usage" | "plain"; href?: string; spark?: number[]; estimated?: boolean; tone?: "hero"; caption?: string;
}) {
  const hero = tone === "hero";
  const colour = kind === "cost" ? (deltaPct && deltaPct > 0 ? "var(--status-danger-text)" : "var(--status-success-text)") : "var(--text-secondary)";
  const sparkPath = spark && spark.length > 1 ? spark.map((v, i) => `${(i / (spark.length - 1)) * 100},${28 - (v / Math.max(...spark)) * 24}`).join(" ") : "";
  return (
    <div className={`card kpi-card${hero ? " stat-hero" : ""}`} aria-label={`${label}: ${value}`}>
      <div className="kpi-top">
        <div className="small muted">{label} {estimated && <span>· Est.</span>}</div>
        <span className="kpi-arrow" aria-hidden="true">↗</span>
      </div>
      <div className="kpi-value tnum">{value}</div>
      {deltaPct !== undefined && deltaPct !== null && (
        <div><span className="kpi-delta" style={hero ? undefined : { color: colour, background: kind === "cost" && deltaPct > 0 ? "var(--status-danger-bg)" : "var(--status-success-bg)" }}>{deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}% vs last month</span></div>
      )}
      {caption && <div className="small muted">{caption}</div>}
      {spark && <svg viewBox="0 0 100 30" width="100%" height="30" role="img" aria-label="Trend sparkline"><polyline points={sparkPath} fill="none" stroke={hero ? "#8CC4A3" : "var(--brand-500)"} strokeWidth="2" strokeLinecap="round" /></svg>}
      {href && <div><Link href={href}>View in Explorer →</Link></div>}
    </div>
  );
}
export { fmtMoneyCompact };
