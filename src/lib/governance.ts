// Ledger — governance views (v1.10), adapted from the Metabase
// multi-cloud dashboard template (metabase.com/dashboards/multi-cloud-dashboard).
//
// What was adapted, and what was deliberately NOT:
//  - Adapted: governance-first hierarchy (KPIs -> "What needs attention"
//    narrative -> spend attribution -> tagging compliance), a month-over-month
//    change waterfall by provider, stacked monthly spend by provider, tagging
//    compliance by provider, and a top-services table with MoM movement.
//  - NOT adapted: egress as its own line (the seeded catalogue has no
//    data-transfer/egress service, so there is no egress cost to show —
//    inventing one would be fabrication), and utilization / SLA cards (Ledger
//    holds billing rows, not monitoring snapshots or uptime probes).
//  - Honesty guardrails carried over from the Metabase page's own cautions:
//    axes are NOT truncated (tagging compliance is drawn on a full 0–100%
//    scale), and every comparison names its months, because October is a
//    partial month (data as of Oct 26): MoM change uses the last two
//    *completed* months (Aug -> Sep), never partial-Oct vs full-Sep.
import type { CostRow, Provider } from "./types";
import { monthlyTotals } from "./data";

export const PROVIDERS: Provider[] = ["AWS", "Azure", "GCP"];
// Fixed provider colours, used identically in every chart (Metabase's device:
// one colour per provider so comparison needs no re-reading of legends).
export const PROVIDER_COLORS: Record<Provider, string> = {
  AWS: "#0072B2", // blue
  GCP: "#009E73", // green
  Azure: "#2A9D8F", // teal
};

const round = (n: number) => Math.round(n * 100) / 100;
export function monthTotal(rows: CostRow[], ym: string): number {
  return round(rows.filter((r) => r.billingPeriod === ym).reduce((a, r) => a + r.billedCost, 0));
}

/** Monthly spend split by provider, oldest first. */
export function monthlySpendByProvider(rows: CostRow[]): { month: string; AWS: number; Azure: number; GCP: number; total: number }[] {
  const months = monthlyTotals(rows).map((m) => m.month);
  return months.map((month) => {
    const out: { month: string; AWS: number; Azure: number; GCP: number; total: number } = { month, AWS: 0, Azure: 0, GCP: 0, total: 0 };
    for (const p of PROVIDERS) out[p] = monthTotal(rows.filter((r) => r.provider === p), month);
    out.total = round(out.AWS + out.Azure + out.GCP);
    return out;
  });
}

export interface ProviderChange { provider: Provider; prev: number; current: number; change: number; pct: number | null; }
/** Per-provider change between two (completed) months, largest increase first, plus the total. */
export function providerMoM(rows: CostRow[], prevMonth: string, curMonth: string): { changes: ProviderChange[]; total: ProviderChange } {
  const changes: ProviderChange[] = PROVIDERS.map((p) => {
    const sub = rows.filter((r) => r.provider === p);
    const prev = monthTotal(sub, prevMonth);
    const current = monthTotal(sub, curMonth);
    const change = round(current - prev);
    return { provider: p, prev, current, change, pct: prev ? round((change / prev) * 100) : null };
  }).sort((a, b) => b.change - a.change);
  const totalPrev = changes.reduce((a, c) => a + c.prev, 0);
  const totalCur = changes.reduce((a, c) => a + c.current, 0);
  const totalChange = round(totalCur - totalPrev);
  return { changes, total: { provider: "AWS", prev: round(totalPrev), current: round(totalCur), change: totalChange, pct: totalPrev ? round((totalChange / totalPrev) * 100) : null } };
}

/** A row counts as tagged when its team tag is non-empty after the same
 *  normalisation the allocation rules use (trim + lowercase). Cost-weighted:
 *  a $10k untagged row matters more than ten $1 tagged rows. */
export function isTagged(r: CostRow): boolean {
  const t = (r.tags?.team ?? "").trim().toLowerCase();
  return t.length > 0;
}
export interface TaggingCompliance { provider: Provider; taggedCost: number; totalCost: number; taggedPct: number; untaggedPct: number; }
export function taggingCompliance(rows: CostRow[]): { byProvider: TaggingCompliance[]; overall: TaggingCompliance } {
  const byProvider: TaggingCompliance[] = PROVIDERS.map((p) => {
    const sub = rows.filter((r) => r.provider === p);
    const totalCost = round(sub.reduce((a, r) => a + r.billedCost, 0));
    const taggedCost = round(sub.filter(isTagged).reduce((a, r) => a + r.billedCost, 0));
    const taggedPct = totalCost ? round((taggedCost / totalCost) * 100) : 100;
    return { provider: p, taggedCost, totalCost, taggedPct, untaggedPct: round(100 - taggedPct) };
  }).sort((a, b) => a.taggedPct - b.taggedPct); // worst first — the laggard is the story
  const totalCost = byProvider.reduce((a, c) => a + c.totalCost, 0);
  const taggedCost = byProvider.reduce((a, c) => a + c.taggedCost, 0);
  const taggedPct = totalCost ? round((taggedCost / totalCost) * 100) : 100;
  return { byProvider, overall: { provider: "AWS", taggedCost: round(taggedCost), totalCost: round(totalCost), taggedPct, untaggedPct: round(100 - taggedPct) } };
}

export interface AttentionInput {
  prevMonth: string; curMonth: string; // last two completed months, e.g. "2026-08" -> "2026-09"
  openMonth: string; openMonthForecast: number; openMonthActual: number; // e.g. Oct 2026
  topAnomaly: { service: string; provider: Provider; month: string; actual: number; expected: number; deltaPct: number } | null;
  triggeredBudgets: string[];
}
/** Plain-language "What needs attention" bullets, computed from real figures —
 *  the Metabase pattern: name the driver, the laggard provider, and the
 *  workload behind the move. Every bullet names its months. */
export function attentionBullets(rows: CostRow[], input: AttentionInput): string[] {
  const { changes, total } = providerMoM(rows, input.prevMonth, input.curMonth);
  const tagging = taggingCompliance(rows);
  const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  const fmtMonth = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const bullets: string[] = [];
  const dir = total.change >= 0 ? "up" : "down";
  const top = changes[0];
  const topPart = top && top.change !== 0
    ? ` — ${top.provider} contributed ${top.change >= 0 ? "+" : "−"}${fmt(top.change)} of the move`
    : "";
  bullets.push(`${fmtMonth(input.curMonth)} spend reached ${fmt(total.current)}, ${dir} ${fmt(total.change)} month over month${topPart}.`);
  const fcDir = input.openMonthForecast >= total.current ? "above" : "below";
  bullets.push(`${fmtMonth(input.openMonth)} is tracking at ${fmt(input.openMonthForecast)} (forecast) — ${fcDir} ${fmtMonth(input.curMonth)}'s ${fmt(total.current)} — on ${fmt(input.openMonthActual)} actual-to-date.`);
  const worst = tagging.byProvider[0];
  if (worst && worst.untaggedPct > 0) {
    const best = tagging.byProvider[tagging.byProvider.length - 1];
    bullets.push(`Untagged spend sits at ${tagging.overall.untaggedPct.toFixed(1)}% overall — ${worst.provider} is the laggard at ${worst.untaggedPct.toFixed(1)}% untagged, versus ${best.taggedPct.toFixed(1)}% tagged on ${best.provider}.`);
  }
  if (input.topAnomaly) {
    const a = input.topAnomaly;
    bullets.push(`${a.service} spiked in ${fmtMonth(a.month)}: ${fmt(a.actual)} against ${fmt(a.expected)} expected (+${a.deltaPct}%) — the largest anomaly on record.`);
  }
  if (input.triggeredBudgets.length) {
    bullets.push(`Budgets triggered: ${input.triggeredBudgets.join(", ")} — each past the 80% warning threshold.`);
  }
  return bullets;
}
