export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { allRows } from "../../../lib/data";
import { runQuery } from "../../../lib/query";
import type { CostBasis, GroupKey, Provider } from "../../../lib/types";
import { getDataSource } from "../../../lib/providers/source";
import { fetchLiveRows } from "../../../lib/providers/index";
// GET /api/query?groupBy=service&provider=AWS&start=2025-11-01&end=2026-10-26&costBasis=billed&topN=10
// Demo (default): deterministic synthetic rows. Live: configured providers only;
// an unconfigured provider contributes no rows and is reported, never faked.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const source = getDataSource();
  let rows = allRows();
  let liveErrors: { provider: Provider; error: string }[] = [];
  if (source === "live") {
    const live = await fetchLiveRows({
      start: p.get("start") || "2025-11-01", end: p.get("end") || "2026-10-26",
    });
    rows = live.rows; liveErrors = live.errors;
  }
  const env = runQuery(rows, {
    groupBy: (p.get("groupBy")?.split(",") as GroupKey[]) || ["provider"],
    providers: p.get("provider") ? [p.get("provider") as Provider] : undefined,
    services: p.get("service") ? [p.get("service")!] : undefined,
    start: p.get("start") || "2025-11-01", end: p.get("end") || "2026-10-26",
    costBasis: (p.get("costBasis") as CostBasis) || "billed",
    topN: Number(p.get("topN") || 10),
  });
  return NextResponse.json({ ...env, meta: { ...env.meta, source }, liveErrors });
}
