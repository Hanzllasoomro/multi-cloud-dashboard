export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createSession, getUserById, logAuthEvent, sessionCookieHeader, verifyMfaChallenge } from "../../../../../lib/auth";
import { clientIp } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/mfa/challenge { challengeToken, code } — complete the
// MFA step of a login. Accepts a TOTP code or a one-time backup code.
// On success a session is created (same as a normal login).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = verifyMfaChallenge(String(body.challengeToken || ""), String(body.code || ""));
  if (!userId) {
    return NextResponse.json({ error: "Incorrect code, or the MFA challenge has expired. Sign in again." }, { status: 401 });
  }
  const user = getUserById(userId)!;
  const session = createSession(user.id, { userAgent: req.headers.get("user-agent") || undefined, ip: clientIp(req) });
  logAuthEvent("login_success", { userId: user.id, email: user.email, detail: "Signed in with MFA.", ip: clientIp(req) });
  const res = NextResponse.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, mfaEnabled: true }, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  res.headers.set("Set-Cookie", sessionCookieHeader(session.token, process.env.NODE_ENV === "production"));
  return res;
}
