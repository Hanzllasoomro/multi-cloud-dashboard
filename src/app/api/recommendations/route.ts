export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-guard";
import { NextRequest } from "next/server";
import { RECOMMENDATIONS } from "../../../lib/data";
import { metaFor } from "../../../lib/query";
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response; return NextResponse.json({ data: RECOMMENDATIONS, totals: { cost: RECOMMENDATIONS.reduce((a,b)=>a+b.monthlySavings,0), usage: 0, rows: RECOMMENDATIONS.length }, meta: metaFor() }); }
