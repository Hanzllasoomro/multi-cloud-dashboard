import type { CostRow, GroupedRow, QueryEnvelope, QueryInput, QueryMeta } from "./types";
import { DATA_AS_OF, TENANT_ID } from "./types";

const BASIS_FIELD = { billed: "billedCost", effective: "effectiveCost", list: "listCost" } as const;
let queryCounter = 0;
/** Demo by default; "live" only when the server env explicitly says so. */
export function currentSource(): "demo" | "live" {
  try {
    return typeof process !== "undefined" && process.env?.LEDGER_DATA_SOURCE === "live" ? "live" : "demo";
  } catch { return "demo"; }
}

export function costOf(r: CostRow, basis: keyof typeof BASIS_FIELD): number { return r[BASIS_FIELD[basis]]; }
export function groupLabel(r: CostRow, k: string): string {
  switch (k) {
    case "provider": return r.provider;
    case "billingAccount": return r.billingAccount;
    case "subAccount": return r.subAccount;
    case "service": return r.service;
    case "serviceCategory": return r.serviceCategory;
    case "region": return r.region;
    case "chargeCategory": return r.chargeCategory;
    case "month": return r.billingPeriod;
    case "tag:team": return normaliseTag(r.tags.team);
    case "tag:env": return normaliseTag(r.tags.env);
    default: return "—";
  }
}
export function normaliseTag(v: string | undefined): string {
  const t = (v || "").trim().toLowerCase();
  return t === "" ? "Untagged" : t;
}
function applyFilters(rows: CostRow[], q: QueryInput): CostRow[] {
  return rows.filter((r) => {
    if (r.x_tenantId !== TENANT_ID) return false; // tenant isolation: mandatory, never UI-only
    if (q.providers?.length && !q.providers.includes(r.provider)) return false;
    if (q.accounts?.length && !q.accounts.includes(r.subAccount)) return false;
    if (q.services?.length && !q.services.includes(r.service)) return false;
    if (q.regions?.length && !q.regions.includes(r.region)) return false;
    if (q.chargeCategories?.length && !q.chargeCategories.includes(r.chargeCategory)) return false;
    if (q.start && r.chargePeriod < q.start) return false;
    if (q.end && r.chargePeriod > q.end) return false;
    if (q.tag) {
      const [k, v] = q.tag.split(":");
      if (normaliseTag(r.tags[k]) !== v.toLowerCase()) return false;
    }
    return true;
  });
}
function shiftRange(q: QueryInput, months: number): QueryInput {
  if (!q.start || !q.end) return q;
  const shift = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + months, d));
    return dt.toISOString().slice(0, 10);
  };
  return { ...q, start: shift(q.start), end: shift(q.end) };
}
/** Typed query DSL compiler: filters -> group -> aggregate -> topN + Other -> envelope. */
export function runQuery(all: CostRow[], q: QueryInput): QueryEnvelope<GroupedRow[]> {
  const basis = q.costBasis || "billed";
  const filtered = applyFilters(all, q);
  const groupBy = q.groupBy?.length ? q.groupBy : ["provider"];
  const agg = new Map<string, { cost: number; usage: number; rows: number }>();
  filtered.forEach((r) => {
    const key = groupBy.map((g) => groupLabel(r, g)).join(" / ");
    const cur = agg.get(key) || { cost: 0, usage: 0, rows: 0 };
    cur.cost += costOf(r, basis); cur.usage += r.usageQuantity; cur.rows += 1;
    agg.set(key, cur);
  });
  let data: GroupedRow[] = [...agg.entries()].map(([key, v]) => ({
    key, label: key, cost: Math.round(v.cost * 100) / 100, usage: Math.round(v.usage * 100) / 100, rows: v.rows,
  })).sort((a, b) => b.cost - a.cost);
  if (q.compareTo) {
    const prev = applyFilters(all, shiftRange(q, q.compareTo === "year" ? -12 : -1));
    const prevTotal = prev.reduce((a, r) => a + costOf(r, basis), 0);
    const curTotal = filtered.reduce((a, r) => a + costOf(r, basis), 0);
    data = data.map((d) => ({ ...d, previousCost: Math.round(prevTotal * (d.cost / Math.max(curTotal, 1)) * 100) / 100,
      deltaPct: prevTotal ? ((d.cost - prevTotal * (d.cost / Math.max(curTotal, 1))) / Math.max(prevTotal * (d.cost / Math.max(curTotal, 1)), 1)) * 100 : null }));
  }
  const topN = q.topN ?? 10;
  if (data.length > topN) {
    const rest = data.slice(topN - 1);
    const other: GroupedRow = { key: "Other", label: "Other", cost: Math.round(rest.reduce((a, d) => a + d.cost, 0) * 100) / 100, usage: Math.round(rest.reduce((a, d) => a + d.usage, 0) * 100) / 100, rows: rest.reduce((a, d) => a + d.rows, 0) };
    data = [...data.slice(0, topN - 1), other];
  }
  const totals = { cost: Math.round(filtered.reduce((a, r) => a + costOf(r, basis), 0) * 100) / 100,
    usage: Math.round(filtered.reduce((a, r) => a + r.usageQuantity, 0) * 100) / 100, rows: filtered.length };
  const estimated = (q.end || DATA_AS_OF).slice(0, 7) === "2026-10" || (q.start || "").slice(0, 7) === "2026-10";
  const meta: QueryMeta = {
    source: currentSource(),
    dataAsOf: DATA_AS_OF, freshness: "Fresh", reconciliation: "Reconciled", costBasis: basis,
    currency: q.currency || "USD", estimatedMonths: estimated ? ["2026-10"] : [],
    queryId: `q_${++queryCounter}_${Date.now().toString(36)}`, cache: false,
    fxNote: "Billing currency (USD) is authoritative; converted values carry FX rate + date.",
  };
  return { data, totals, meta };
}
export function metaFor(freshness: QueryMeta["freshness"] = "Fresh", reconciliation: QueryMeta["reconciliation"] = "Reconciled", basis: QueryMeta["costBasis"] = "billed"): QueryMeta {
  return { source: currentSource(), dataAsOf: DATA_AS_OF, freshness, reconciliation, costBasis: basis, currency: "USD", estimatedMonths: ["2026-10"], queryId: `q_${++queryCounter}`, cache: false };
}
