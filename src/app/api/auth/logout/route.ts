export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookieHeader, destroySession, SESSION_COOKIE } from "../../../../lib/auth";
import { metaFor } from "../../../../lib/query";

// POST /api/auth/logout — deletes the server session and clears the cookie.
export async function POST(req: NextRequest) {
  destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ data: { loggedOut: true }, totals: { cost: 0, usage: 0, rows: 0 }, meta: metaFor() });
  res.headers.set("Set-Cookie", clearSessionCookieHeader(process.env.NODE_ENV === "production"));
  return res;
}
