export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { revokeUserSession, SESSION_COOKIE, clearSessionCookieHeader } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// POST /api/auth/sessions/revoke { token } — revoke one of my sessions by
// its full token. Revoking the current session also clears the cookie.
export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  if (!revokeUserSession(auth.user!.id, token)) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  const res = NextResponse.json({ data: { revoked: true }, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  if (req.cookies.get(SESSION_COOKIE)?.value === token) {
    res.headers.set("Set-Cookie", clearSessionCookieHeader(process.env.NODE_ENV === "production"));
  }
  return res;
}
