export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-guard";
import { NextRequest } from "next/server";
import { CONNECTIONS } from "../../../lib/data";
import { metaFor } from "../../../lib/query";
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response;
  const breakdown = [{ label: "Tax timing", pct: 0.41 }, { label: "Marketplace cadence", pct: 0.18 }, { label: "Late credits", pct: 0.09 }];
  return NextResponse.json({ data: { connections: CONNECTIONS, varianceBreakdown: breakdown, monthLifecycle: ["Estimated", "Provisional", "Final"] }, totals: { cost: 0, usage: 0, rows: CONNECTIONS.length }, meta: metaFor("Delayed", "Variance") });
}
