// Ledger — common provider-connector interface (v1.1).
// Every connector speaks this interface; only this layer knows provider quirks.
// Nothing in here ever logs, returns, or stores a credential — connectors read
// environment variables server-side only, and validate() reports only *names*
// of missing variables, never values.
import type { CostRow, Provider } from "../types";

export interface CostRange { start: string; end: string } // YYYY-MM-DD, inclusive

export interface ProviderConnector {
  provider: Provider;
  /** True when every env var this connector needs is present (presence only). */
  isConfigured(): boolean;
  /** Names of missing env vars; empty when configured. Never includes values. */
  validate(): { ok: boolean; missing: string[] };
  /** Pure mapper: provider-native payload -> canonical FOCUS-style rows. */
  toFocusRows(input: unknown): CostRow[];
  /** Live fetch (read-only). Throws on network/auth failure; caller catches. */
  fetchCosts(range: CostRange): Promise<CostRow[]>;
}

export interface LiveFetchResult {
  rows: CostRow[];
  /** One entry per provider that was configured but failed; message is generic. */
  errors: { provider: Provider; error: string }[];
}

/** Shared row factory: guarantees no row is ever dropped silently. */
export function baseRow(
  provider: Provider,
  connectionId: string,
  source: string,
  partial: Partial<CostRow> & Pick<CostRow, "service" | "chargePeriod">,
): CostRow {
  const period = partial.chargePeriod;
  return {
    billingAccount: `${provider.toLowerCase()}-billing-live`,
    billingAccountId: `${provider}-BILL-LIVE`,
    subAccount: partial.subAccount ?? "live-account",
    subAccountId: partial.subAccountId ?? "live-account",
    serviceCategory: partial.serviceCategory ?? "Other",
    region: partial.region ?? "global",
    resourceId: partial.resourceId ?? "",
    skuId: partial.skuId ?? "",
    // Unknown / unclassified input is mapped to Adjustment, never dropped.
    chargeCategory: partial.chargeCategory ?? "Adjustment",
    billingPeriod: period.slice(0, 7),
    billedCost: partial.billedCost ?? 0,
    effectiveCost: partial.effectiveCost ?? partial.billedCost ?? 0,
    listCost: partial.listCost ?? partial.billedCost ?? 0,
    contractedCost: partial.contractedCost ?? partial.billedCost ?? 0,
    usageQuantity: partial.usageQuantity ?? 0,
    usageUnit: partial.usageUnit ?? "",
    currency: partial.currency ?? "USD",
    tags: partial.tags ?? {},
    x_sourceFile: source,
    x_sourceVersion: "live-1.0",
    x_ingestedAt: new Date().toISOString(),
    x_tenantId: "demo-tenant-01",
    x_connectionId: connectionId,
    x_rawServiceCode: partial.x_rawServiceCode ?? partial.service,
    x_normalizerVersion: "2.0.0-live",
    ...partial,
    provider,
    service: partial.service,
    chargePeriod: period,
  };
}

/** Credits and tax are negative/positive by provider convention; normalise here. */
export function signedAmount(category: CostRow["chargeCategory"], amount: number): number {
  if (category === "Credit") return -Math.abs(amount);
  return amount;
}
