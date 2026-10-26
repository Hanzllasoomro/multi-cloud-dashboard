export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { CONNECTIONS } from "../../../lib/data";
import { metaFor } from "../../../lib/query";
export async function GET() { return NextResponse.json({ data: CONNECTIONS, totals: { cost: 0, usage: 0, rows: CONNECTIONS.length }, meta: metaFor() }); }
