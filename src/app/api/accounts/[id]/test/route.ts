export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { runTestChecklist } from "../../../../../lib/accounts";
import { metaFor } from "../../../../../lib/query";
import { requirePermission } from "../../../../../lib/auth-guard";

function err(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
// POST /api/accounts/[id]/test — per-permission checklist; updates status + lastSync.
// Demo mode: simulated checklist, labelled mode:"demo" in the response.
// Live mode: env-presence check (variable names only, never values).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, "manageConnections"); if (auth.response) return auth.response;
  try {
    const result = runTestChecklist(params.id);
    return NextResponse.json({ data: result, totals: { cost: 0, usage: 0, rows: result.total }, meta: metaFor() });
  } catch (e) { return err(e instanceof Error ? e.message : "Test failed", e instanceof Error && e.message === "Account not found" ? 404 : 400); }
}
