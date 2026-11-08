export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { revokeOtherSessions, SESSION_COOKIE } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/sessions/revoke-others — revoke every session except
// the current one ("sign out everywhere else").
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  const n = revokeOtherSessions(auth.user!.id, req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ data: { revoked: n }, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
}
