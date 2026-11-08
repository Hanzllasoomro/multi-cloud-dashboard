export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { confirmMfaSetup } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/mfa/verify { code } — confirm MFA setup with a code from
// the authenticator app. On success MFA is enabled and 8 backup codes are
// returned ONCE — save them somewhere safe; they are stored hashed and
// can never be shown again.
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => ({}));
  try {
    const data = confirmMfaSetup(auth.user!.id, String(body.code || ""));
    return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MFA verification failed." }, { status: 400 });
  }
}
