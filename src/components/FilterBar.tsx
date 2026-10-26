"use client";
export interface FilterState {
  provider: string; account: string; service: string; region: string; tag: string;
  costBasis: "billed" | "effective" | "list"; currency: string; start: string; end: string;
}
export const DEFAULT_FILTERS: FilterState = { provider: "All", account: "All", service: "All", region: "All", tag: "", costBasis: "billed", currency: "USD", start: "2025-11-01", end: "2026-10-26" };
export default function FilterBar({ value, onChange, services = [], regions = [] }: { value: FilterState; onChange: (f: FilterState) => void; services?: string[]; regions?: string[] }) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const chips: { label: string; clear: () => void }[] = [];
  if (value.provider !== "All") chips.push({ label: `Provider: ${value.provider}`, clear: () => set({ provider: "All" }) });
  if (value.account !== "All") chips.push({ label: `Account: ${value.account}`, clear: () => set({ account: "All" }) });
  if (value.service !== "All") chips.push({ label: `Service: ${value.service}`, clear: () => set({ service: "All" }) });
  if (value.region !== "All") chips.push({ label: `Region: ${value.region}`, clear: () => set({ region: "All" }) });
  if (value.tag) chips.push({ label: `Tag: ${value.tag}`, clear: () => set({ tag: "" }) });
  return (
    <div className="card" aria-label="Filters">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="small">From <input className="input" type="date" value={value.start} onChange={(e) => set({ start: e.target.value })} /></label>
        <label className="small">To <input className="input" type="date" value={value.end} onChange={(e) => set({ end: e.target.value })} /></label>
        <label className="small">Provider <select className="select" value={value.provider} onChange={(e) => set({ provider: e.target.value })}><option>All</option><option>AWS</option><option>Azure</option><option>GCP</option></select></label>
        <label className="small">Account <select className="select" value={value.account} onChange={(e) => set({ account: e.target.value })}><option>All</option><option>prod-aws</option><option>staging-aws</option><option>prod-azure-sub</option><option>prod-gcp-project</option></select></label>
        <label className="small">Service <select className="select" value={value.service} onChange={(e) => set({ service: e.target.value })}><option>All</option>{services.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="small">Region <select className="select" value={value.region} onChange={(e) => set({ region: e.target.value })}><option>All</option>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="small">Tag (team:platform) <input className="input" placeholder="team:platform" value={value.tag} onChange={(e) => set({ tag: e.target.value })} /></label>
        <label className="small">Cost basis <select className="select" value={value.costBasis} onChange={(e) => set({ costBasis: e.target.value as FilterState["costBasis"] })}><option value="billed">Billed (invoice)</option><option value="effective">Effective (amortised)</option><option value="list">List</option></select></label>
        <label className="small">Currency <select className="select" value={value.currency} onChange={(e) => set({ currency: e.target.value })}><option>USD</option><option>EUR</option><option>GBP</option></select></label>
        <button className="btn-ghost" onClick={() => onChange(DEFAULT_FILTERS)}>Clear all</button>
      </div>
      {chips.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>{chips.map((c) => <span key={c.label} className="chip">{c.label} <button aria-label={`Remove ${c.label}`} onClick={c.clear}>×</button></span>)}</div>}
      <p className="caption" style={{ margin: "8px 0 0" }}>Filters are reflected in the chart and table below; the same state is used by every view, so a view is shareable by copying its filter set. Currency conversion is labelled in the API envelope (FX rate + date) — demo data is USD only.</p>
    </div>
  );
}
