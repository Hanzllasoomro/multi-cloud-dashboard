export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { COMMITMENTS } from "../../../lib/data";
import { metaFor } from "../../../lib/query";
export async function GET() { return NextResponse.json({ data: COMMITMENTS, totals: { cost: COMMITMENTS.reduce((a,b)=>a+b.unusedCost,0), usage: 0, rows: COMMITMENTS.length }, meta: metaFor() }); }
