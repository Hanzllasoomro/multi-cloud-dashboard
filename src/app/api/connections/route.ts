export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-guard";
import { NextRequest } from "next/server";
import { CONNECTIONS } from "../../../lib/data";
import { metaFor } from "../../../lib/query";
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response; return NextResponse.json({ data: CONNECTIONS, totals: { cost: 0, usage: 0, rows: CONNECTIONS.length }, meta: metaFor() }); }
