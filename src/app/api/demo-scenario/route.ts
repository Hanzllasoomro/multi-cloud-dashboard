export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "../../../lib/providers/source";
import { loadScenario, saveScenario } from "../../../lib/demo-scenario-store";
import { defaultScenario } from "../../../lib/demo-scenario";
import { metaFor } from "../../../lib/query";
import { requirePermission, requireUser } from "../../../lib/auth-guard";

function err(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
// GET /api/demo-scenario — any signed-in user may read the current demo scenario.
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response;
  return NextResponse.json({ data: loadScenario(), meta: metaFor() });
}
// PUT /api/demo-scenario — Owner/Admin/FinOps Manager only, DEMO MODE ONLY.
// A scenario must never be saved while the server is in live mode: live
// pages show provider data only, and a demo override there would fake live billing.
export async function PUT(req: NextRequest) {
  const auth = requirePermission(req, "manageConnections"); if (auth.response) return auth.response;
  if (getDataSource() === "live") {
    return err("Demo scenarios only apply in demo mode (LEDGER_DATA_SOURCE=demo). This server is in live mode, so provider data is shown as-is.", 409);
  }
  try {
    const body = await req.json().catch(() => ({}));
    const saved = saveScenario(body);
    return NextResponse.json({ data: saved, meta: metaFor() });
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid scenario"); }
}
// DELETE /api/demo-scenario — reset to the original seeded demo (inactive).
export async function DELETE(req: NextRequest) {
  const auth = requirePermission(req, "manageConnections"); if (auth.response) return auth.response;
  const saved = saveScenario(defaultScenario());
  return NextResponse.json({ data: saved, meta: metaFor() });
}
