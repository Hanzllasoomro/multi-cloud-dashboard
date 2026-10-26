export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth-guard";
import { listAudit } from "../../../../lib/accounts";
import { metaFor } from "../../../../lib/query";
// GET /api/accounts/audit — append-only account audit entries, newest first.
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, "viewAudit"); if (auth.response) return auth.response;
  const data = listAudit();
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}
