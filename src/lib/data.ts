import type { Commitment, Connection, CostRow, Provider, Recommendation } from "./types";
import { DATA_AS_OF, TENANT_ID } from "./types";

// Deterministic PRNG (mulberry32) — the same seed always yields the same demo dataset.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
interface Svc { provider: Provider; service: string; category: string; account: string; accountId: string; region: string; base: number; unit: string; unitPrice: number; growth: number; }
const SERVICES: Svc[] = [
  { provider: "AWS", service: "Amazon EC2", category: "Compute", account: "prod-aws", accountId: "123456789012", region: "us-east-1", base: 4200, unit: "Hrs", unitPrice: 0.42, growth: 0.018 },
  { provider: "AWS", service: "Amazon S3", category: "Storage", account: "prod-aws", accountId: "123456789012", region: "us-east-1", base: 620, unit: "GB-Mo", unitPrice: 0.023, growth: 0.022 },
  { provider: "AWS", service: "Amazon RDS", category: "Database", account: "prod-aws", accountId: "123456789012", region: "eu-west-1", base: 1850, unit: "Hrs", unitPrice: 0.55, growth: 0.012 },
  { provider: "AWS", service: "AWS Lambda", category: "Compute", account: "staging-aws", accountId: "210987654321", region: "us-east-1", base: 240, unit: "Requests", unitPrice: 0.00002, growth: 0.03 },
  { provider: "Azure", service: "Virtual Machines", category: "Compute", account: "prod-azure-sub", accountId: "sub-9f21-azure", region: "westeurope", base: 3100, unit: "Hrs", unitPrice: 0.38, growth: 0.015 },
  { provider: "Azure", service: "Blob Storage", category: "Storage", account: "prod-azure-sub", accountId: "sub-9f21-azure", region: "westeurope", base: 480, unit: "GB-Mo", unitPrice: 0.021, growth: 0.02 },
  { provider: "Azure", service: "SQL Database", category: "Database", account: "prod-azure-sub", accountId: "sub-9f21-azure", region: "eastus", base: 1420, unit: "DTU-Hrs", unitPrice: 0.31, growth: 0.01 },
  { provider: "GCP", service: "Compute Engine", category: "Compute", account: "prod-gcp-project", accountId: "proj-ledger-4412", region: "us-central1", base: 2650, unit: "Hrs", unitPrice: 0.35, growth: 0.02 },
  { provider: "GCP", service: "Cloud Storage", category: "Storage", account: "prod-gcp-project", accountId: "proj-ledger-4412", region: "us-central1", base: 390, unit: "GB-Mo", unitPrice: 0.02, growth: 0.025 },
  { provider: "GCP", service: "Cloud SQL", category: "Database", account: "prod-gcp-project", accountId: "proj-ledger-4412", region: "europe-west1", base: 1180, unit: "Hrs", unitPrice: 0.4, growth: 0.014 },
];
const TEAMS = ["platform", "data", "web", "ml"];
const ENVS = ["prod", "staging", "dev"];
let cache: CostRow[] | null = null;

export function allRows(): CostRow[] {
  if (cache) return cache;
  const rng = mulberry32(20261026);
  const rows: CostRow[] = [];
  const days: string[] = [];
  for (let d = new Date(Date.UTC(2025, 10, 1)); d <= new Date(Date.UTC(2026, 9, 26)); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const monthIndex = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    return (y - 2025) * 12 + (m - 1) - 10; // Nov 2025 = 0
  };
  SERVICES.forEach((s, si) => {
    days.forEach((day, di) => {
      const mi = monthIndex(day);
      const dow = new Date(day + "T00:00:00Z").getUTCDay();
      const weekend = dow === 0 || dow === 6 ? 0.82 : 1.0;
      const seasonal = 1 + 0.08 * Math.sin(mi / 2.1);
      const noise = 0.86 + rng() * 0.28;
      // Seeded spike: EC2 in Mar 2026 (anomaly demo) and a Jul restatement note.
      let spike = 1;
      if (s.service === "Amazon EC2" && day >= "2026-03-09" && day <= "2026-03-15") spike = 2.6;
      if (s.service === "Virtual Machines" && day >= "2026-07-20" && day <= "2026-07-22") spike = 1.7;
      const daily = (s.base / 30) * Math.pow(1 + s.growth, mi) * weekend * seasonal * noise * spike;
      const team = TEAMS[Math.floor(rng() * TEAMS.length)];
      const envRaw = ENVS[Math.floor(rng() * ENVS.length)];
      // Messy tags, exactly as real exports arrive: case/whitespace variants + occasional blanks.
      const env = rng() < 0.08 ? "" : rng() < 0.12 ? envRaw.toUpperCase() : rng() < 0.12 ? ` ${envRaw} ` : envRaw;
      const teamTag = rng() < 0.08 ? "" : rng() < 0.1 ? team.charAt(0).toUpperCase() + team.slice(1) : team;
      rows.push({
        provider: s.provider, billingAccount: `${s.provider.toLowerCase()}-billing-01`, billingAccountId: `${s.provider}-BILL-01`,
        subAccount: s.account, subAccountId: s.accountId, service: s.service, serviceCategory: s.category,
        region: s.region, resourceId: `${s.provider.toLowerCase()}-${si}-${Math.floor(rng() * 40)}`, skuId: `SKU-${si}`,
        chargeCategory: "Usage", chargePeriod: day, billingPeriod: day.slice(0, 7),
        billedCost: round(daily), effectiveCost: round(daily * 0.88), listCost: round(daily / 0.82), contractedCost: round(daily * 0.94),
        usageQuantity: round(daily / s.unitPrice), usageUnit: s.unit, currency: "USD",
        tags: { team: teamTag, env, ...(rng() < 0.9 ? { project: "ledger" } : {}) },
        commitmentId: s.service === "Amazon EC2" ? "sp-ec2-3yr" : undefined,
        x_sourceFile: `raw/${TENANT_ID}/${s.provider.toLowerCase()}/${day.slice(0, 7)}/v1.parquet`,
        x_sourceVersion: "FOCUS-1.2", x_ingestedAt: DATA_AS_OF, x_tenantId: TENANT_ID,
        x_connectionId: `conn-${s.provider.toLowerCase()}`, x_rawServiceCode: s.service.toUpperCase().replace(/[^A-Z]/g, ""),
        x_normalizerVersion: "1.4.0",
        ...(s.service === "Amazon EC2" && day.startsWith("2026-07") ? { x_restatementNote: "Jul 2026 EC2 restated: provider corrected metering (+0.4%); prior version retained for audit." } : {}),
      });
      void di;
    });
    // Monthly Savings-Plan / reservation purchases (Purchase, excluded from anomaly baselines)
    for (let mi = 0; mi < 12; mi++) {
      const ym = new Date(Date.UTC(2025, 10 + mi, 1)).toISOString().slice(0, 7);
      if (s.service === "Amazon EC2" || s.service === "Virtual Machines") {
        rows.push({ ...baseMonthly(s, ym, "Purchase", s.base * 0.6, rng), chargePeriod: `${ym}-01` });
      }
    }
  });
  // Monthly credits + tax per billing account (12 months x 3 providers)
  ["AWS", "Azure", "GCP"].forEach((p) => {
    for (let mi = 0; mi < 12; mi++) {
      const ym = new Date(Date.UTC(2025, 10 + mi, 1)).toISOString().slice(0, 7);
      const acct = SERVICES.find((s) => s.provider === p)!;
      rows.push({ ...baseMonthly(acct, ym, "Credit", -420 - rng() * 180, rng), chargePeriod: `${ym}-05` });
      rows.push({ ...baseMonthly(acct, ym, "Tax", 620 + rng() * 240, rng), chargePeriod: `${ym}-28` });
    }
  });
  cache = rows;
  return rows;
}
function baseMonthly(s: Svc, ym: string, cat: CostRow["chargeCategory"], amt: number, rng: () => number): Omit<CostRow, "chargePeriod"> & { chargePeriod?: string } {
  return {
    provider: s.provider, billingAccount: `${s.provider.toLowerCase()}-billing-01`, billingAccountId: `${s.provider}-BILL-01`,
    subAccount: s.account, subAccountId: s.accountId, service: s.service, serviceCategory: s.category, region: s.region,
    resourceId: "—", skuId: `SKU-MONTHLY`, chargeCategory: cat, billingPeriod: ym,
    billedCost: round(amt), effectiveCost: round(amt), listCost: round(amt), contractedCost: round(amt),
    usageQuantity: 0, usageUnit: "—", currency: "USD", tags: { team: "platform", env: "prod" },
    x_sourceFile: `raw/${TENANT_ID}/${s.provider.toLowerCase()}/${ym}/v1.parquet`, x_sourceVersion: "FOCUS-1.2",
    x_ingestedAt: DATA_AS_OF, x_tenantId: TENANT_ID, x_connectionId: `conn-${s.provider.toLowerCase()}`,
    x_rawServiceCode: s.service.toUpperCase().replace(/[^A-Z]/g, ""), x_normalizerVersion: "1.4.0", chargePeriod: `${ym}-01`,
  } as CostRow;
}
function round(n: number) { return Math.round(n * 100) / 100; }
export function monthlyTotals(rows: CostRow[], basis: "billedCost" | "effectiveCost" | "listCost" = "billedCost"): { month: string; cost: number }[] {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.billingPeriod, (map.get(r.billingPeriod) || 0) + r[basis]));
  return [...map.entries()].sort().map(([month, cost]) => ({ month, cost: round(cost) }));
}
export function monthCost(rows: CostRow[], ym: string): number {
  return round(rows.filter((r) => r.billingPeriod === ym).reduce((a, r) => a + r.billedCost, 0));
}
export const CONNECTIONS: Connection[] = [
  { id: "conn-aws", provider: "AWS", name: "AWS production (payer)", billingAccount: "123456789012", status: "Healthy", freshness: "Fresh", dataAsOf: DATA_AS_OF, monthState: "Estimated", reconciliation: "Reconciled", variancePct: 0.12, accounts: 2, lastSync: "2026-10-26 02:10 UTC" },
  { id: "conn-azure", provider: "Azure", name: "Azure MCA billing", billingAccount: "sub-9f21-azure", status: "Degraded", freshness: "Delayed", dataAsOf: "2026-10-24", monthState: "Estimated", reconciliation: "Variance", variancePct: 0.68, accounts: 1, lastSync: "2026-10-24 18:40 UTC" },
  { id: "conn-gcp", provider: "GCP", name: "GCP billing export", billingAccount: "proj-ledger-4412", status: "Healthy", freshness: "Fresh", dataAsOf: DATA_AS_OF, monthState: "Estimated", reconciliation: "Reconciled", variancePct: 0.04, accounts: 1, lastSync: "2026-10-26 01:55 UTC" },
];
export const COMMITMENTS: Commitment[] = [
  { id: "sp-ec2-3yr", provider: "AWS", type: "Savings Plan (Compute)", resource: "EC2 fleet, us-east-1", term: "3 yr", start: "2025-01-01", end: "2027-12-31", hourlyCommitment: 142, utilization: 91, coverage: 78, savingsRate: 28, unusedCost: 930 },
  { id: "ri-azure-1yr", provider: "Azure", type: "Reservation (VM)", resource: "D-series, westeurope", term: "1 yr", start: "2026-02-01", end: "2027-01-31", hourlyCommitment: 88, utilization: 84, coverage: 64, savingsRate: 22, unusedCost: 1210 },
  { id: "cud-gcp-1yr", provider: "GCP", type: "Committed Use Discount", resource: "Compute Engine, us-central1", term: "1 yr", start: "2026-03-01", end: "2027-02-28", hourlyCommitment: 61, utilization: 96, coverage: 71, savingsRate: 31, unusedCost: 310 },
];
export const RECOMMENDATIONS: Recommendation[] = [
  { id: "rec-1", title: "Rightsize 14 idle EC2 instances (p95 CPU < 5% for 14 days)", category: "Rightsizing", provider: "AWS", resource: "i-0a… / EC2 fleet", monthlySavings: 1840, effort: "Medium", risk: "Low", source: "AWS Compute Optimizer", status: "Open" },
  { id: "rec-2", title: "Delete 9 unattached disks and 3 unattached IPs", category: "Idle", provider: "Azure", resource: "Managed disks, westeurope", monthlySavings: 640, effort: "Low", risk: "Low", source: "Azure Advisor (Cost)", status: "Open" },
  { id: "rec-3", title: "Move infrequently read Cloud Storage objects to Nearline", category: "Storage tier", provider: "GCP", resource: "ledger-archive bucket", monthlySavings: 410, effort: "Low", risk: "Low", source: "GCP Recommender", status: "Open" },
  { id: "rec-4", title: "Buy a 1-yr Compute Savings Plan for the uncovered baseline", category: "Commitment", provider: "AWS", resource: "EC2 baseline ~$38/hr", monthlySavings: 2210, effort: "Medium", risk: "Medium", source: "Ledger rule: coverage < 80%", status: "Open" },
  { id: "rec-5", title: "Downgrade Cloud SQL instance with near-zero connections", category: "Rightsizing", provider: "GCP", resource: "Cloud SQL, europe-west1", monthlySavings: 530, effort: "Medium", risk: "Medium", source: "GCP Recommender", status: "Accepted" },
];
export const ALLOCATION_RULES: import("./types").AllocationRule[] = [
  { id: "r1", name: "By account → team", type: "Account", match: "prod-aws → platform", target: "Team: platform", split: "100%" },
  { id: "r2", name: "By tag team (normalised)", type: "Tag", match: "tags.team (case/whitespace normalised)", target: "Team: <tag value>", split: "100%" },
  { id: "r3", name: "Support + tax shared", type: "Shared cost", match: "ChargeCategory Tax / support", target: "All teams", split: "Proportional to usage" },
  { id: "r4", name: "Untagged spend", type: "Fallback", match: "tags.team empty", target: "Untagged (own line, never hidden)", split: "100%" },
];
