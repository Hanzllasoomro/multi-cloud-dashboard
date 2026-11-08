export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookieHeader, destroySession, logAuthEvent, SESSION_COOKIE, validateSession } from "../../../../lib/auth";
import { metaFor } from "../../../../lib/query";

// POST /api/auth/logout — deletes the server session and clears the cookie.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = validateSession(token);
  if (user) logAuthEvent("logout", { userId: user.id, email: user.email });
  destroySession(token);
  const res = NextResponse.json({ data: { loggedOut: true }, totals: { cost: 0, usage: 0, rows: 0 }, meta: metaFor() });
  res.headers.set("Set-Cookie", clearSessionCookieHeader(process.env.NODE_ENV === "production"));
  return res;
}
