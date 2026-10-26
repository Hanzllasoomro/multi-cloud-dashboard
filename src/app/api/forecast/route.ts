import { NextResponse } from "next/server";
import { allRows } from "../../../lib/data";
import { forecastMonth } from "../../../lib/insights";
import { metaFor } from "../../../lib/query";
export async function GET() { const d = forecastMonth(allRows()); return NextResponse.json({ data: d, totals: { cost: d.reduce((a,b)=>a+b.forecast,0), usage: 0, rows: d.length }, meta: metaFor() }); }
