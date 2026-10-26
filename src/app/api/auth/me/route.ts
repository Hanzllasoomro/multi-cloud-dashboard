export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth-guard";
import { metaFor } from "../../../../lib/query";

// GET /api/auth/me — the signed-in public user, or 401. Never a hash.
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  return NextResponse.json({ data: auth.user, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
}
