// Ledger — data-source mode (server-side only).
// LEDGER_DATA_SOURCE=demo (default) | live. This module is imported by API
// routes, never by client components: env *presence* is exposed to the UI only
// through /api/source, which returns booleans, never values.
import type { Provider } from "../types";
import { awsConnector } from "./aws";
import { azureConnector } from "./azure";
import { gcpConnector } from "./gcp";

export type DataSource = "demo" | "live";
export function getDataSource(): DataSource {
  return process.env.LEDGER_DATA_SOURCE === "live" ? "live" : "demo";
}
export const CONNECTORS = [awsConnector, azureConnector, gcpConnector];
export function providerEnvStatus(): { provider: Provider; configured: boolean; missing: string[] }[] {
  return CONNECTORS.map((c) => {
    const v = c.validate();
    return { provider: c.provider, configured: v.ok, missing: v.missing };
  });
}
