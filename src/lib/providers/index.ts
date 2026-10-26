// Ledger — live fetch aggregator. One provider failing must never take down
// the others: errors are collected per provider and returned alongside rows.
import type { CostRow } from "../types";
import { CONNECTORS } from "./source";
import type { CostRange, LiveFetchResult } from "./types";

export async function fetchLiveRows(range: CostRange): Promise<LiveFetchResult> {
  const rows: CostRow[] = [];
  const errors: LiveFetchResult["errors"] = [];
  for (const c of CONNECTORS) {
    if (!c.isConfigured()) continue; // unconfigured => "Not connected", not fake data
    try {
      rows.push(...(await c.fetchCosts(range)));
    } catch {
      errors.push({ provider: c.provider, error: "Live fetch failed; check credentials and permissions (see docs/REAL_ACCOUNTS.md)." });
    }
  }
  return { rows, errors };
}
export { CONNECTORS };
export type { CostRange, LiveFetchResult, ProviderConnector } from "./types";
