// Formatting rules from the design system: true minus, $0.00 vs —, tabular numbers via CSS.
export function fmtMoneyFull(v: number | null | undefined, currency = "USD"): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtMoneyCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  const unit: [string, number] = a >= 1e6 ? ["M", a / 1e6] : a >= 1e3 ? ["K", a / 1e3] : ["", a];
  return `${sign}$${unit[1].toFixed(unit[0] ? 2 : 0)}${unit[0]}`;
}
export function fmtDelta(v: number | null | undefined, pct = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (v === 0) return pct ? "0.0%" : "$0.00";
  const arrow = v > 0 ? "▲" : "▼";
  const body = pct ? `${Math.abs(v).toFixed(1)}%` : fmtMoneyFull(Math.abs(v));
  return `${arrow} ${body}`;
}
export function fmtSignedPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}%`;
}
export function fmtDate(iso: string): string {
  // "2026-10-26" -> "Oct 26, 2026" (no Date parsing, so no timezone drift)
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[(m || 1) - 1]} ${d}, ${y}`;
}
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[(m || 1) - 1]} ${y}`;
}
export function fmtNumber(v: number): string { return v.toLocaleString("en-US"); }
export function escapeCsvCell(v: string): string {
  // Neutralise spreadsheet formula injection (WS-14): cells starting = + - @ get a leading apostrophe.
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
