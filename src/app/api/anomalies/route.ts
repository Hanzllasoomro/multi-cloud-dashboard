export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-guard";
import { NextRequest } from "next/server";
import { allRows } from "../../../lib/data";
import { detectAnomalies } from "../../../lib/insights";
import { metaFor } from "../../../lib/query";
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response; const d = detectAnomalies(allRows()); return NextResponse.json({ data: d, totals: { cost: d.reduce((a,b)=>a+b.delta,0), usage: 0, rows: d.length }, meta: metaFor() }); }
