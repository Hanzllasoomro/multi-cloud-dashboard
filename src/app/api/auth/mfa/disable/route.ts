export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { disableMfa } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/mfa/disable { password } — disable MFA. Requires the
// account password, so a stolen session alone cannot remove MFA.
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => ({}));
  try {
    disableMfa(auth.user!.id, String(body.password || ""));
    return NextResponse.json({ data: { mfaEnabled: false }, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not disable MFA." }, { status: 400 });
  }
}
