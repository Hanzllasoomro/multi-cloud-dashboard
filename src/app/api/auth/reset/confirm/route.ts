export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { confirmPasswordReset, originOk } from "../../../../../lib/auth";
import { clientIp } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/reset/confirm { token, newPassword } — complete a reset.
// The token is single-use and expires after 1 hour. All sessions are
// revoked, so a stolen session cannot survive a reset.
export async function POST(req: NextRequest) {
  if (!originOk(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Origin check failed." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    await confirmPasswordReset(String(body.token || ""), String(body.newPassword || ""), clientIp(req));
    return NextResponse.json({ data: { reset: true }, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Password reset failed." }, { status: 400 });
  }
}
