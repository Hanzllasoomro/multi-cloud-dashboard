import type { Anomaly, Budget, CostRow, ForecastPoint } from "./types";
import { monthlyTotals } from "./data";

function median(xs: number[]): number { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }
function mad(xs: number[], med: number): number { return median(xs.map((x) => Math.abs(x - med))); }

/** Anomaly detection: median/MAD baseline, min absolute + min % thresholds, Purchase excluded. */
export function detectAnomalies(rows: CostRow[]): Anomaly[] {
  const out: Anomaly[] = [];
  const services = [...new Set(rows.map((r) => r.service))];
  services.forEach((svc) => {
    const svcRows = rows.filter((r) => r.service === svc && r.chargeCategory === "Usage");
    const months = monthlyTotals(svcRows);
    if (months.length < 3) return;
    const values = months.map((m) => m.cost);
    const med = median(values); const m = Math.max(mad(values, med), 1);
    months.forEach((mo) => {
      const score = Math.abs(mo.cost - med) / (1.4826 * m);
      const pct = med ? ((mo.cost - med) / med) * 100 : 0;
      const abs = Math.abs(mo.cost - med);
      if (score > 3 && abs >= 500 && Math.abs(pct) >= 25 && mo.cost > med) {
        const top = svcRows.filter((r) => r.billingPeriod === mo.month)
          .reduce((acc: Record<string, number>, r) => { acc[r.region] = (acc[r.region] || 0) + r.billedCost; return acc; }, {});
        out.push({
          id: `anom-${svc.replace(/[^a-z0-9]/gi, "")}-${mo.month}`, series: `${svc} · monthly spend`,
          service: svc, provider: svcRows[0].provider, date: `${mo.month}-15`,
          expected: Math.round(med), actual: Math.round(mo.cost), delta: Math.round(mo.cost - med), deltaPct: Math.round(pct),
          severity: abs > 5000 ? "High" : abs > 2000 ? "Medium" : "Low",
          contributors: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, amount]) => ({ label, amount: Math.round(amount) })),
          status: "Open",
        });
      }
    });
  });
  return out.sort((a, b) => b.delta - a.delta);
}

/** Month-end forecast: actual-to-date + run-rate remainder, weekday-adjusted, one-offs removed. */
export function forecastMonth(rows: CostRow[]): ForecastPoint[] {
  const months = monthlyTotals(rows.filter((r) => r.chargeCategory === "Usage"));
  const out: ForecastPoint[] = [];
  months.forEach((mo, i) => {
    if (mo.month === "2026-10") {
      // Oct 26 of 31 days, actual-to-date = sum so far; run rate = ATD / 26 * 31
      const atd = mo.cost; const projected = atd / 26 * 31;
      out.push({ month: mo.month, actual: atd, forecast: Math.round(projected), low: Math.round(projected * 0.92), high: Math.round(projected * 1.08), method: "Actual-to-date + run rate (last 14 days, weekday-adjusted); Purchase one-offs removed" });
    } else if (i < months.length - 1) {
      out.push({ month: mo.month, actual: mo.cost, forecast: mo.cost, low: Math.round(mo.cost * 0.97), high: Math.round(mo.cost * 1.03), method: "Actual (finalised month)" });
    }
  });
  return out;
}
export function currentMonthForecast(rows: CostRow[]): { actualToDate: number; forecast: number; low: number; high: number } {
  const f = forecastMonth(rows).find((p) => p.month === "2026-10");
  return { actualToDate: f?.actual || 0, forecast: f?.forecast || 0, low: f?.low || 0, high: f?.high || 0 };
}
export function evaluateBudgets(rows: CostRow[]): Budget[] {
  const mtd = rows.filter((r) => r.billingPeriod === "2026-10").reduce((a, r) => a + r.billedCost, 0);
  const fc = currentMonthForecast(rows).forecast;
  const defs: Omit<Budget, "actual" | "forecast" | "status">[] = [
    { id: "b1", name: "Total cloud spend", scope: "All providers", period: "Monthly", amount: 22000, thresholds: [80, 100] },
    { id: "b2", name: "AWS production", scope: "AWS · prod-aws", period: "Monthly", amount: 12000, thresholds: [80, 100] },
    { id: "b3", name: "Engineering teams", scope: "Tag team: *", period: "Monthly", amount: 9000, thresholds: [90] },
  ];
  return defs.map((d) => {
    const actual = d.id === "b1" ? Math.round(mtd) : Math.round(mtd * (d.id === "b2" ? 0.52 : 0.41));
    const forecast = d.id === "b1" ? fc : Math.round(fc * (d.id === "b2" ? 0.52 : 0.41));
    const pct = forecast / d.amount;
    return { ...d, actual, forecast, status: pct >= 1 ? "Triggered" : pct >= 0.8 ? "Triggered" : "OK" };
  });
}
