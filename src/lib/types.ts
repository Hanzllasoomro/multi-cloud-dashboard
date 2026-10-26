// Ledger — canonical (FOCUS-inspired) types. No provider quirk leaks past this file.
export type Provider = "AWS" | "Azure" | "GCP";
export type ChargeCategory = "Usage" | "Purchase" | "Credit" | "Tax" | "Adjustment";
export type CostBasis = "billed" | "effective" | "list";
export type Freshness = "Fresh" | "Delayed" | "Stale" | "Failed";
export type MonthState = "Estimated" | "Provisional" | "Final";
export type Reconciliation = "Reconciled" | "Variance" | "Unable to verify";

export interface CostRow {
  provider: Provider;
  billingAccount: string;
  billingAccountId: string;
  subAccount: string; // AWS account / Azure subscription / GCP project
  subAccountId: string;
  service: string;
  serviceCategory: string;
  region: string;
  resourceId: string;
  skuId: string;
  chargeCategory: ChargeCategory;
  chargePeriod: string; // YYYY-MM-DD (charge date, UTC)
  billingPeriod: string; // YYYY-MM
  billedCost: number;
  effectiveCost: number;
  listCost: number;
  contractedCost: number;
  usageQuantity: number;
  usageUnit: string;
  currency: string;
  tags: Record<string, string>;
  // Commitment fields
  commitmentId?: string;
  commitmentDiscountType?: string;
  // Lineage / extension columns (x_ prefix, per the plan)
  x_sourceFile: string;
  x_sourceVersion: string;
  x_ingestedAt: string;
  x_tenantId: string;
  x_connectionId: string;
  x_rawServiceCode: string;
  x_normalizerVersion: string;
  x_restatementNote?: string;
}

export type GroupKey = "provider" | "billingAccount" | "subAccount" | "service" | "serviceCategory" | "region" | "chargeCategory" | "month" | "tag:team" | "tag:env";
export interface QueryInput {
  metrics?: ("cost" | "usage")[];
  groupBy?: GroupKey[];
  providers?: Provider[];
  accounts?: string[];
  services?: string[];
  regions?: string[];
  tag?: string; // e.g. "team:platform"
  chargeCategories?: ChargeCategory[];
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  granularity?: "day" | "month";
  compareTo?: "previous" | "year";
  costBasis?: CostBasis;
  currency?: string;
  topN?: number;
}
export type DataSource = "demo" | "live";
export interface QueryMeta {
  source: DataSource;
  dataAsOf: string;
  freshness: Freshness;
  reconciliation: Reconciliation;
  costBasis: CostBasis;
  currency: string;
  estimatedMonths: string[];
  queryId: string;
  cache: boolean;
  fxNote?: string;
}
export interface QueryEnvelope<T = unknown> {
  data: T;
  totals: { cost: number; usage: number; rows: number };
  meta: QueryMeta;
}
export interface GroupedRow { key: string; label: string; cost: number; usage: number; rows: number; previousCost?: number; deltaPct?: number | null; }
export interface Connection {
  id: string; provider: Provider; name: string; billingAccount: string;
  status: "Healthy" | "Degraded" | "Broken" | "Pending";
  freshness: Freshness; dataAsOf: string; monthState: MonthState;
  reconciliation: Reconciliation; variancePct: number; accounts: number; lastSync: string;
}
export interface Budget {
  id: string; name: string; scope: string; period: "Monthly" | "Quarterly" | "Annual";
  amount: number; actual: number; forecast: number; thresholds: number[]; status: "OK" | "Triggered" | "Acknowledged" | "Resolved";
}
export interface Anomaly {
  id: string; series: string; service: string; provider: Provider; date: string;
  expected: number; actual: number; delta: number; deltaPct: number; severity: "High" | "Medium" | "Low";
  contributors: { label: string; amount: number }[]; status: "Open" | "Expected" | "Not useful";
}
export interface ForecastPoint { month: string; actual: number | null; forecast: number; low: number; high: number; method: string }
export interface Recommendation {
  id: string; title: string; category: string; provider: Provider; resource: string;
  monthlySavings: number; effort: "Low" | "Medium" | "High"; risk: "Low" | "Medium" | "High";
  source: string; status: "Open" | "Accepted" | "Dismissed" | "Implemented";
}
export interface Commitment {
  id: string; provider: Provider; type: string; resource: string; term: string;
  start: string; end: string; hourlyCommitment: number; utilization: number; coverage: number; savingsRate: number; unusedCost: number;
}
export interface AllocationRule { id: string; name: string; type: string; match: string; target: string; split: string }
export const TENANT_ID = "demo-tenant-01";
export const DATA_AS_OF = "2026-10-26";
