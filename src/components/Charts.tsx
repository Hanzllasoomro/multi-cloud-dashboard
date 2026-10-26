// Internal chart adapter: all charts are hand-built SVG (no chart-library lock-in).
// Series colours use the Okabe-Ito palette; every series is labelled, never colour alone.
export const SERIES = ["#0072B2", "#C77700", "#009E73", "#CC79A7", "#7B5EA7", "#D55E00"];
function scalePts(values: number[], w: number, h: number, pad = 8) {
  const max = Math.max(...values, 1);
  return values.map((v, i) => `${pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)},${h - pad - (v / max) * (h - pad * 2)}`);
}
export function LineChart({ series, labels, height = 220, band }: { series: { label: string; values: number[]; color?: string }[]; labels: string[]; height?: number; band?: { low: number[]; high: number[] } }) {
  const W = 720, H = height;
  const all = [...series.flatMap((s) => s.values), ...(band ? [...band.low, ...band.high] : [])];
  const max = Math.max(...all, 1);
  const pts = (vals: number[]) => vals.map((v, i) => `${8 + (i / Math.max(vals.length - 1, 1)) * (W - 16)},${H - 24 - (v / max) * (H - 44)}`).join(" ");
  const bandPath = band ? `${pts(band.high)} L ${[...band.low].reverse().map((v, i) => { const idx = band.low.length - 1 - i; return `${8 + (idx / Math.max(band.low.length - 1, 1)) * (W - 16)},${H - 24 - (v / max) * (H - 44)}`; }).join(" ")} Z` : "";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Line chart">
        {band && <path d={bandPath} fill="var(--blue-100)" opacity={0.6} />}
        {series.map((s, i) => <polyline key={s.label} points={pts(s.values)} fill="none" stroke={s.color || SERIES[i % SERIES.length]} strokeWidth={2} strokeDasharray={s.label.includes("Forecast") ? "5 4" : undefined} />)}
      </svg>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>{series.map((s, i) => <span key={s.label} className="small"><span style={{ color: s.color || SERIES[i % SERIES.length] }}>■</span> {s.label}</span>)}{band && <span className="small">▨ Forecast band (low–high)</span>}</div>
      <div className="caption">{labels[0]} → {labels[labels.length - 1]}</div>
    </div>
  );
}
export function BarChart({ data, stacked, horizontal }: { data: { label: string; values: number[]; }[]; stacked?: boolean; horizontal?: boolean }) {
  const max = Math.max(...data.map((d) => d.values.reduce((a, b) => a + b, 0)), 1);
  if (horizontal) {
    return <div style={{ display: "grid", gap: 8 }}>{data.map((d) => (
      <div key={d.label} style={{ display: "grid", gridTemplateColumns: "160px 1fr 90px", gap: 8, alignItems: "center" }}>
        <span className="small">{d.label}</span>
        <div style={{ display: "flex", height: 18 }}>{d.values.map((v, i) => <div key={i} style={{ width: `${(v / max) * 100}%`, background: SERIES[i % SERIES.length] }} title={String(v)} />)}</div>
        <span className="small num">${Math.round(d.values.reduce((a, b) => a + b, 0)).toLocaleString()}</span>
      </div>))}</div>;
  }
  const W = 720, H = 220;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const x = 10 + i * ((W - 20) / data.length);
        const bw = Math.max(((W - 20) / data.length) * 0.6, 6);
        let y = H - 20;
        return d.values.map((v, j) => {
          const h = (v / max) * (H - 40); const rect = <rect key={j} x={x} y={y - h} width={bw} height={h} fill={SERIES[j % SERIES.length]}><title>{d.label}: ${Math.round(v).toLocaleString()}</title></rect>;
          y -= h; return rect;
        });
      })}
    </svg>
  );
}
export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  let acc = 0;
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
      <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label="Donut chart">
        {data.map((d, i) => {
          const frac = d.value / total; const dash = frac * C; const off = -acc * C; acc += frac;
          return <circle key={d.label} cx="85" cy="85" r={R} fill="none" stroke={SERIES[i % SERIES.length]} strokeWidth="26" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off} transform="rotate(-90 85 85)"><title>{d.label}: ${Math.round(d.value).toLocaleString()}</title></circle>;
        })}
        <text x="85" y="85" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">${(total / 1000).toFixed(0)}K</text>
      </svg>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{data.map((d, i) => <li key={d.label} className="small"><span style={{ color: SERIES[i % SERIES.length] }}>■</span> {d.label} — ${Math.round(d.value).toLocaleString()} ({((d.value / total) * 100).toFixed(1)}%)</li>)}</ul>
    </div>
  );
}
// Adapter: one component chooses the chart type so views never import a chart library.
export function Chart(props: { type: "line" | "bar" | "donut" | "hbar"; [k: string]: unknown }) {
  const { type, ...rest } = props;
  if (type === "line") return <LineChart {...(rest as unknown as React.ComponentProps<typeof LineChart>)} />;
  if (type === "donut") return <DonutChart {...(rest as unknown as React.ComponentProps<typeof DonutChart>)} />;
  if (type === "hbar") return <BarChart {...(rest as unknown as React.ComponentProps<typeof BarChart>)} horizontal />;
  return <BarChart {...(rest as unknown as React.ComponentProps<typeof BarChart>)} />;
}
export { scalePts };
