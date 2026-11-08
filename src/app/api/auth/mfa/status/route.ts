export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { mfaStatus } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// GET /api/auth/mfa/status — is MFA on, how many backup codes remain?
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  return NextResponse.json({ data: mfaStatus(auth.user!.id), totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
}
