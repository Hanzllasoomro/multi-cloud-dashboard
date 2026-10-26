// Ledger — AWS connector (read-only, Cost Explorer).
// Credentials: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION (or the
// SDK's default credential chain, e.g. an IAM role). Prefer a cross-account role
// with a unique ExternalId per connection (see docs/REAL_ACCOUNTS.md); static
// keys are the fallback, never the recommendation. No credential is logged.
// The SDK is dynamically imported so the demo bundle never pays for it.
import type { CostRow } from "../types";
import { baseRow, signedAmount, type CostRange, type ProviderConnector } from "./types";

export interface AwsCeGroup {
  Keys?: string[]; // [service, linkedAccount] — group order is fixed by fetchCosts
  Metrics?: { BlendedCost?: { Amount?: string }; UsageQuantity?: { Amount?: string } };
}
export interface AwsCeResponse {
  ResultsByTime?: { TimePeriod?: { Start?: string }; Groups?: AwsCeGroup[] }[];
}

const REQUIRED = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
export const awsConnector: ProviderConnector = {
  provider: "AWS",
  isConfigured: () => REQUIRED.every((k) => !!process.env[k]),
  validate: () => {
    const missing = REQUIRED.filter((k) => !process.env[k]);
    return { ok: missing.length === 0, missing };
  },
  toFocusRows: (input: unknown): CostRow[] => {
    const data = input as AwsCeResponse;
    const rows: CostRow[] = [];
    for (const period of data.ResultsByTime ?? []) {
      const date = period.TimePeriod?.Start ?? "";
      for (const g of period.Groups ?? []) {
        const [serviceRaw, account] = g.Keys ?? [];
        const service = serviceRaw || "Unknown service";
        const amount = Number(g.Metrics?.BlendedCost?.Amount ?? 0);
        // Cost Explorer has no separate credit/tax line in this grouping: a
        // negative blended amount, or a service literally named Credit/Tax,
        // is classified explicitly so it is never silently treated as Usage.
        const category: CostRow["chargeCategory"] =
          service.toLowerCase().includes("credit") || amount < 0
            ? "Credit"
            : service.toLowerCase().includes("tax")
              ? "Tax"
              : "Usage";
        rows.push(baseRow("AWS", "conn-aws-live", "aws:cost-explorer", {
          service, subAccount: account || "aws-account", subAccountId: account || "aws-account",
          serviceCategory: category === "Credit" || category === "Tax" ? "Other" : "Compute",
          region: "global", // Region needs a second grouped call or the CUR export;
          // this connector is honest about that limit (see REAL_ACCOUNTS.md).
          chargePeriod: date, chargeCategory: category,
          billedCost: signedAmount(category, amount),
          usageQuantity: Number(g.Metrics?.UsageQuantity?.Amount ?? 0),
          usageUnit: "Hrs", x_rawServiceCode: service,
        }));
      }
    }
    return rows;
  },
  fetchCosts: async (range: CostRange): Promise<CostRow[]> => {
    const v = awsConnector.validate();
    if (!v.ok) throw new Error(`AWS not configured; missing: ${v.missing.join(", ")}`);
    const { CostExplorerClient, GetCostAndUsageCommand } = await import(
      "@aws-sdk/client-cost-explorer"
    );
    const client = new CostExplorerClient({ region: process.env.AWS_REGION || "us-east-1" });
    const out = await client.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: range.start, End: range.end },
      Granularity: "DAILY",
      Metrics: ["BlendedCost", "UsageQuantity"],
      GroupBy: [
        { Type: "DIMENSION", Key: "SERVICE" },
        { Type: "DIMENSION", Key: "LINKED_ACCOUNT" },
      ],
    }));
    return awsConnector.toFocusRows(out as unknown);
  },
};
