// Ledger — Demo Studio scenario (v1.5).
//
// PURPOSE: let a presenter change the DEMO story (multipliers, presets,
// extra demo accounts) and see it reflected on every demo page, without
// touching live provider data and without editing the seeded dataset.
// This module is pure and client-safe: no fs, no env. The file-backed
// store lives in demo-scenario-store.ts and is server-only.
//
// HONESTY RULES (do not weaken these):
// - A scenario only ever applies in demo mode. API routes refuse to save
//   it in live mode, and applyScenario is only called when the server
//   source is demo (client pages fetch the scenario from that API).
// - The platform's Demo banner stays visible on every page while a
//   scenario is active, and the Overview shows which scenario is live.
// - Multipliers scale cost AND usage together, so charts, tables, budgets,
//   forecasts and anomalies stay internally consistent. They never invent
//   a single fake invoice line: every scaled row keeps its original date,
//   service, account, tags and lineage.
// - Recommendation and commitment lists are static demo lists and are
//   deliberately NOT scaled by a scenario (scaling them would invent
//   savings). The editor says so on screen.
import type { CostRow, Provider } from "./types";
import { DATA_AS_OF, TENANT_ID } from "./types";

export interface ExtraDemoAccount {
  id: string; provider: Provider; subAccount: string; service: string; monthlyBase: number;
}
export interface DemoScenario {
  version: 1;
  active: boolean;
  label: string;
  updatedAt: string;
  globalMultiplier: number;
  providerMultipliers: Partial<Record<Provider, number>>;
  accountMultipliers: Record<string, number>;
  serviceMultipliers: Record<string, number>;
  extraAccounts: ExtraDemoAccount[];
}
export const DEMO_PROVIDERS: Provider[] = ["AWS", "Azure", "GCP"];
export const DEMO_ACCOUNTS: { subAccount: string; provider: Provider }[] = [
  { subAccount: "prod-aws", provider: "AWS" },
  { subAccount: "staging-aws", provider: "AWS" },
  { subAccount: "prod-azure-sub", provider: "Azure" },
  { subAccount: "prod-gcp-project", provider: "GCP" },
];
export const DEMO_SERVICES: { service: string; provider: Provider }[] = [
  { service: "Amazon EC2", provider: "AWS" }, { service: "Amazon S3", provider: "AWS" },
  { service: "Amazon RDS", provider: "AWS" }, { service: "AWS Lambda", provider: "AWS" },
  { service: "Virtual Machines", provider: "Azure" }, { service: "Blob Storage", provider: "Azure" },
  { service: "SQL Database", provider: "Azure" }, { service: "Compute Engine", provider: "GCP" },
  { service: "Cloud Storage", provider: "GCP" }, { service: "Cloud SQL", provider: "GCP" },
];

export function defaultScenario(): DemoScenario {
  return {
    version: 1, active: false, label: "Original seeded demo", updatedAt: "",
    globalMultiplier: 1, providerMultipliers: {}, accountMultipliers: {}, serviceMultipliers: {}, extraAccounts: [],
  };
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function mult(v: unknown, field: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error(`${field} must be a number between 0 and 10`);
  return n;
}
function strMap(v: unknown, field: string): Record<string, number> {
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) throw new Error(`${field} must be an object`);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!k.trim()) continue;
    out[k.trim()] = mult(val, field);
  }
  return out;
}
/** Validate + normalise an untrusted scenario body. Throws on bad input. */
export function cleanScenario(input: unknown): DemoScenario {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Scenario must be an object");
  const b = input as Record<string, unknown>;
  const providerMultipliers: Partial<Record<Provider, number>> = {};
  if (b.providerMultipliers !== undefined) {
    const m = strMap(b.providerMultipliers, "providerMultipliers");
    for (const [k, v] of Object.entries(m)) {
      if (!DEMO_PROVIDERS.includes(k as Provider)) throw new Error(`Unknown provider in providerMultipliers: ${k}`);
      providerMultipliers[k as Provider] = v;
    }
  }
  const extraRaw = b.extraAccounts;
  if (extraRaw !== undefined && !Array.isArray(extraRaw)) throw new Error("extraAccounts must be an array");
  const extras: ExtraDemoAccount[] = (Array.isArray(extraRaw) ? extraRaw : []).map((e, i) => {
    if (typeof e !== "object" || e === null) throw new Error(`extraAccounts[${i}] must be an object`);
    const x = e as Record<string, unknown>;
    if (!DEMO_PROVIDERS.includes(x.provider as Provider)) throw new Error(`extraAccounts[${i}].provider must be AWS, Azure, or GCP`);
    if (typeof x.subAccount !== "string" || !x.subAccount.trim()) throw new Error(`extraAccounts[${i}].subAccount is required`);
    if (typeof x.service !== "string" || !x.service.trim()) throw new Error(`extraAccounts[${i}].service is required`);
    const monthlyBase = typeof x.monthlyBase === "number" ? x.monthlyBase : Number(x.monthlyBase);
    if (!Number.isFinite(monthlyBase) || monthlyBase < 0 || monthlyBase > 1000000) throw new Error(`extraAccounts[${i}].monthlyBase must be between 0 and 1,000,000`);
    return { id: typeof x.id === "string" && x.id ? x.id : `extra-${i}`, provider: x.provider as Provider, subAccount: x.subAccount.trim(), service: x.service.trim(), monthlyBase };
  });
  const seen = new Set<string>();
  for (const e of extras) {
    if (seen.has(e.subAccount)) throw new Error(`Duplicate extra subAccount: ${e.subAccount}`);
    seen.add(e.subAccount);
  }
  if (extras.length > 5) throw new Error("At most 5 extra demo accounts");
  return {
    version: 1,
    active: b.active === true,
    label: typeof b.label === "string" && b.label.trim() ? b.label.trim().slice(0, 80) : "Demo scenario",
    updatedAt: typeof b.updatedAt === "string" ? b.updatedAt : "",
    globalMultiplier: b.globalMultiplier === undefined ? 1 : mult(b.globalMultiplier, "globalMultiplier"),
    providerMultipliers,
    accountMultipliers: strMap(b.accountMultipliers, "accountMultipliers"),
    serviceMultipliers: strMap(b.serviceMultipliers, "serviceMultipliers"),
    extraAccounts: extras,
  };
}
export function presetScenario(kind: "original" | "growth" | "spike" | "savings"): DemoScenario {
  const base = defaultScenario();
  if (kind === "original") return base;
  if (kind === "growth") return { ...base, active: true, label: "Growth story — spend up ~40%", globalMultiplier: 1.4 };
  if (kind === "spike") return { ...base, active: true, label: "EC2 spike story", serviceMultipliers: { "Amazon EC2": 2 } };
  return { ...base, active: true, label: "Savings story — spend down ~30%", globalMultiplier: 0.7 };
}
export function scenarioMultiplier(s: DemoScenario, row: Pick<CostRow, "provider" | "subAccount" | "service">): number {
  return s.globalMultiplier
    * (s.providerMultipliers[row.provider] ?? 1)
    * (s.accountMultipliers[row.subAccount] ?? 1)
    * (s.serviceMultipliers[row.service] ?? 1);
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const REGION_FOR: Record<Provider, string> = { AWS: "us-east-1", Azure: "westeurope", GCP: "us-central1" };
function extraRowsFor(e: ExtraDemoAccount): CostRow[] {
  const rows: CostRow[] = [];
  const seed = hashString(e.subAccount + e.service);
  for (let d = new Date(Date.UTC(2025, 10, 1)); d <= new Date(Date.UTC(2026, 9, 26)); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const idx = Math.round((d.getTime() - Date.UTC(2025, 10, 1)) / 86400000);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.9 : 1;
    const wobble = 1 + 0.08 * Math.sin(idx * 0.7 + (seed % 10));
    const daily = round2((e.monthlyBase / 30) * weekend * wobble);
    rows.push({
      provider: e.provider, billingAccount: `${e.provider.toLowerCase()}-billing-demo`, billingAccountId: `${e.provider}-BILL-DEMO`,
      subAccount: e.subAccount, subAccountId: e.subAccount, service: e.service, serviceCategory: "Compute",
      region: REGION_FOR[e.provider], resourceId: `demo-extra-${e.id}`, skuId: "SKU-DEMO-EXTRA",
      chargeCategory: "Usage", chargePeriod: day, billingPeriod: day.slice(0, 7),
      billedCost: daily, effectiveCost: round2(daily * 0.88), listCost: round2(daily / 0.82), contractedCost: round2(daily * 0.94),
      usageQuantity: round2(daily / 0.35), usageUnit: "Hrs", currency: "USD",
      tags: { team: "platform", env: "prod", project: "ledger" },
      x_sourceFile: `raw/${TENANT_ID}/demo-studio/${e.provider.toLowerCase()}/${day.slice(0, 7)}/v1.parquet`,
      x_sourceVersion: "FOCUS-1.2", x_ingestedAt: DATA_AS_OF, x_tenantId: TENANT_ID,
      x_connectionId: `conn-${e.provider.toLowerCase()}`, x_rawServiceCode: e.service.toUpperCase().replace(/[^A-Z]/g, ""),
      x_normalizerVersion: "1.4.0",
    });
  }
  return rows;
}
/** Scale a row set by a scenario. Inactive scenarios return the input unchanged. */
export function applyScenario(rows: CostRow[], scenario: DemoScenario): CostRow[] {
  if (!scenario.active) return rows;
  const scaled = rows.map((r) => {
    const m = scenarioMultiplier(scenario, r);
    if (m === 1) return r;
    return {
      ...r,
      billedCost: round2(r.billedCost * m), effectiveCost: round2(r.effectiveCost * m),
      listCost: round2(r.listCost * m), contractedCost: round2(r.contractedCost * m),
      usageQuantity: round2(r.usageQuantity * m),
    };
  });
  if (!scenario.extraAccounts.length) return scaled;
  return [...scaled, ...scenario.extraAccounts.flatMap(extraRowsFor)];
}
export function scenarioSummary(s: DemoScenario): string {
  if (!s.active) return "Original seeded demo (no scenario active)";
  const parts: string[] = [s.label];
  if (s.globalMultiplier !== 1) parts.push(`all ×${s.globalMultiplier}`);
  for (const [p, m] of Object.entries(s.providerMultipliers)) if (m !== 1) parts.push(`${p} ×${m}`);
  for (const [a, m] of Object.entries(s.accountMultipliers)) if (m !== 1) parts.push(`${a} ×${m}`);
  for (const [v, m] of Object.entries(s.serviceMultipliers)) if (m !== 1) parts.push(`${v} ×${m}`);
  if (s.extraAccounts.length) parts.push(`${s.extraAccounts.length} extra demo account(s)`);
  return parts.join(" · ");
}
