// Ledger — GCP connector (read-only, BigQuery REST query path).
// This is deliberately the REST path, not the @google-cloud/bigquery client:
// it keeps the dependency surface small, works with a plain bearer token, and
// the query is visible and auditable. Credentials: GCP_PROJECT_ID,
// GCP_BIGQUERY_DATASET, GCP_ACCESS_TOKEN (e.g. `gcloud auth print-access-token`
// under Workload Identity Federation / service-account impersonation — no
// long-lived key file is ever committed). Token is header-only, never logged.
// Roles: BigQuery Data Viewer on the billing dataset + BigQuery Job User.
// NOTE: GCP billing exports are NOT retroactive — history starts on enablement.
import type { CostRow } from "../types";
import { baseRow, signedAmount, type CostRange, type ProviderConnector } from "./types";

/** Simplified billing-export row, after BigQuery's {schema, rows} shape is parsed. */
export interface GcpBillingRow {
  service?: string; project?: string; location?: string; date?: string;
  cost?: number; currency?: string; usageAmount?: number; usageUnit?: string;
  costType?: string; // regular | tax | credit | adjustment ...
  labels?: Record<string, string>;
}
export interface BigQueryResponse {
  schema?: { fields?: { name: string }[] };
  rows?: { f?: { v?: string }[] }[];
}

/** Parse BigQuery jobs.query response into simplified rows (pure, testable). */
export function parseBigQueryResponse(input: unknown): GcpBillingRow[] {
  const data = input as BigQueryResponse;
  const names = (data.schema?.fields ?? []).map((f) => f.name);
  return (data.rows ?? []).map((r) => {
    const get = (name: string): string => {
      const i = names.indexOf(name);
      return i >= 0 ? (r.f?.[i]?.v ?? "") : "";
    };
    return {
      service: get("service_description"), project: get("project_id"),
      location: get("location"), date: get("usage_start_time")?.slice(0, 10),
      cost: Number(get("cost") || 0), currency: get("currency") || "USD",
      usageAmount: Number(get("usage_amount") || 0), usageUnit: get("usage_unit") || "",
      costType: get("cost_type"),
      labels: {},
    };
  });
}

const REQUIRED = ["GCP_PROJECT_ID", "GCP_BIGQUERY_DATASET", "GCP_ACCESS_TOKEN"];
export const gcpConnector: ProviderConnector = {
  provider: "GCP",
  isConfigured: () => REQUIRED.every((k) => !!process.env[k]),
  validate: () => {
    const missing = REQUIRED.filter((k) => !process.env[k]);
    return { ok: missing.length === 0, missing };
  },
  toFocusRows: (input: unknown): CostRow[] => {
    const rows = Array.isArray(input) ? (input as GcpBillingRow[]) : parseBigQueryResponse(input);
    return rows.map((r) => {
      const service = r.service || "Unknown service";
      const t = (r.costType || "").toLowerCase();
      const category: CostRow["chargeCategory"] =
        t.includes("credit") ? "Credit"
        : t.includes("tax") ? "Tax"
        : t.includes("adjustment") ? "Adjustment"
        : "Usage";
      const amount = r.cost ?? 0;
      return baseRow("GCP", "conn-gcp-live", "gcp:bigquery-billing-export", {
        service, subAccount: r.project || "gcp-project", subAccountId: r.project || "gcp-project",
        serviceCategory: "Other", region: r.location || "global",
        chargePeriod: r.date || "", chargeCategory: category,
        billedCost: signedAmount(category, amount),
        usageQuantity: r.usageAmount ?? 0, usageUnit: r.usageUnit ?? "",
        currency: r.currency || "USD", tags: r.labels ?? {}, x_rawServiceCode: service,
      });
    });
  },
  fetchCosts: async (range: CostRange): Promise<CostRow[]> => {
    const v = gcpConnector.validate();
    if (!v.ok) throw new Error(`GCP not configured; missing: ${v.missing.join(", ")}`);
    const project = process.env.GCP_PROJECT_ID!;
    const dataset = process.env.GCP_BIGQUERY_DATASET!;
    const table = process.env.GCP_BIGQUERY_TABLE || `${project}.${dataset}.gcp_billing_export_resource_v1`;
    const query = `SELECT service.description AS service_description, project.id AS project_id, ` +
      `location.location AS location, usage_start_time, cost, currency, ` +
      `usage.amount AS usage_amount, usage.unit AS usage_unit, cost_type ` +
      `FROM \`${table}\` WHERE DATE(usage_start_time) BETWEEN '${range.start}' AND '${range.end}' LIMIT 100000`;
    const res = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GCP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, useLegacySql: false }),
    });
    if (!res.ok) throw new Error(`GCP BigQuery query failed (HTTP ${res.status})`);
    return gcpConnector.toFocusRows(parseBigQueryResponse(await res.json()));
  },
};
