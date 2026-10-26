export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { RECOMMENDATIONS } from "../../../lib/data";
import { metaFor } from "../../../lib/query";
export async function GET() { return NextResponse.json({ data: RECOMMENDATIONS, totals: { cost: RECOMMENDATIONS.reduce((a,b)=>a+b.monthlySavings,0), usage: 0, rows: RECOMMENDATIONS.length }, meta: metaFor() }); }
