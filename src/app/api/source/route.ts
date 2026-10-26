export const dynamic = "force-dynamic"; // must read env at request time, not build time
import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-guard";
import { NextRequest } from "next/server";
import { getDataSource, providerEnvStatus } from "../../../lib/providers/source";
import { metaFor } from "../../../lib/query";
// GET /api/source — mode + provider configuration *presence* only. Never env values.
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response;
  const meta = metaFor();
  return NextResponse.json({
    data: { source: getDataSource(), providers: providerEnvStatus() },
    totals: { cost: 0, usage: 0, rows: 3 },
    meta: { ...meta, source: getDataSource() },
  });
}
