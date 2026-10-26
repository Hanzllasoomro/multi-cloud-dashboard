export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { listAudit } from "../../../../lib/accounts";
import { metaFor } from "../../../../lib/query";
// GET /api/accounts/audit — append-only account audit entries, newest first.
export async function GET() {
  const data = listAudit();
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}
