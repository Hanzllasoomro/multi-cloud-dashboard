export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { originOk, requestPasswordReset } from "../../../../../lib/auth";
import { clientIp } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/reset/request { email } — request a password reset.
// The response is always the same whether or not the email exists, so it
// cannot enumerate accounts. Ledger has no email provider configured:
// in non-production runs the reset token is returned in the response so
// the reset is actually usable locally; in production wire an email
// sender and do NOT return the token (see docs/SECURITY.md).
export async function POST(req: NextRequest) {
  if (!originOk(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Origin check failed." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { token, expiresAt } = requestPasswordReset(String(body.email || ""), clientIp(req));
  const data: Record<string, unknown> = { requested: true, expiresAt: new Date(expiresAt).toISOString() };
  if (token && process.env.NODE_ENV !== "production") data.resetToken = token;
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
}
