// Ledger — Azure connector (read-only, Cost Management Query REST).
// Credentials: AZURE_SUBSCRIPTION_ID + AZURE_ACCESS_TOKEN (bearer token, e.g.
// from `az account get-access-token`). The token is sent only in the
// Authorization header to management.azure.com and is never logged or returned.
// Role needed: Cost Management Reader at the billing scope (see docs/REAL_ACCOUNTS.md).
import type { CostRow } from "../types";
import { baseRow, signedAmount, type CostRange, type ProviderConnector } from "./types";

export interface AzureQueryResponse {
  properties?: {
    columns?: { name: string; type: string }[];
    rows?: (string | number)[][];
  };
}

const REQUIRED = ["AZURE_SUBSCRIPTION_ID", "AZURE_ACCESS_TOKEN"];
export const azureConnector: ProviderConnector = {
  provider: "Azure",
  isConfigured: () => REQUIRED.every((k) => !!process.env[k]),
  validate: () => {
    const missing = REQUIRED.filter((k) => !process.env[k]);
    return { ok: missing.length === 0, missing };
  },
  toFocusRows: (input: unknown): CostRow[] => {
    const data = input as AzureQueryResponse;
    const cols = data.properties?.columns ?? [];
    const idx = (name: string) => cols.findIndex((c) => c.name === name);
    const rows: CostRow[] = [];
    for (const r of data.properties?.rows ?? []) {
      const get = (name: string): string | number => r[idx(name)] ?? "";
      const service = String(get("ServiceName") || "Unknown service");
      const chargeType = String(get("ChargeType") || "");
      const amount = Number(get("Cost") || 0);
      // Azure ChargeType values: Usage, Purchase, Refund, Adjustment, Tax...
      // Refund -> Credit; anything unrecognised -> Adjustment, never dropped.
      const category: CostRow["chargeCategory"] =
        chargeType === "Refund" ? "Credit"
        : chargeType === "Purchase" ? "Purchase"
        : chargeType === "Tax" ? "Tax"
        : chargeType === "Usage" ? "Usage"
        : "Adjustment";
      const date = String(get("UsageDate") || "");
      rows.push(baseRow("Azure", "conn-azure-live", "azure:cost-management-query", {
        service, subAccount: String(get("SubscriptionId") || "azure-subscription"),
        subAccountId: String(get("SubscriptionId") || "azure-subscription"),
        serviceCategory: "Other", region: String(get("ResourceLocation") || "global"),
        chargePeriod: date, chargeCategory: category,
        billedCost: signedAmount(category, amount),
        usageQuantity: Number(get("UsageQuantity") || 0),
        usageUnit: String(get("UnitOfMeasure") || ""),
        currency: String(get("Currency") || "USD"),
        tags: {}, x_rawServiceCode: service,
      }));
    }
    return rows;
  },
  fetchCosts: async (range: CostRange): Promise<CostRow[]> => {
    const v = azureConnector.validate();
    if (!v.ok) throw new Error(`Azure not configured; missing: ${v.missing.join(", ")}`);
    const sub = process.env.AZURE_SUBSCRIPTION_ID!;
    const url = `https://management.azure.com/subscriptions/${sub}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AZURE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: { from: range.start, to: range.end },
        dataset: {
          granularity: "Daily",
          aggregation: { totalCost: { name: "Cost", function: "Sum" } },
          grouping: [
            { type: "Dimension", name: "ServiceName" },
            { type: "Dimension", name: "ResourceLocation" },
            { type: "Dimension", name: "ChargeType" },
          ],
        },
      }),
    });
    if (!res.ok) throw new Error(`Azure Cost Management query failed (HTTP ${res.status})`);
    return azureConnector.toFocusRows(await res.json());
  },
};
