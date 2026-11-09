export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { startMfaSetup } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/mfa/setup — start MFA setup. Returns the secret and the
// otpauth:// URL ONCE; the secret is stored as *pending* until confirmed
// and is never returned again. Enter the secret manually in your
// authenticator app (or open the otpauth URL).
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  try {
    const data = await startMfaSetup(auth.user!.id);
    return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MFA setup failed." }, { status: 400 });
  }
}
