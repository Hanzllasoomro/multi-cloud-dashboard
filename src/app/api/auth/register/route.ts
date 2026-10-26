export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createSession, originOk, registerUser, sessionCookieHeader } from "../../../../lib/auth";
import { metaFor } from "../../../../lib/query";

// POST /api/auth/register — first user becomes Owner, later users Viewer.
// Returns the public user only; never a password hash. Sets the session cookie.
export async function POST(req: NextRequest) {
  if (!originOk(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Origin check failed." }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const user = registerUser(String(body.email || ""), String(body.name || ""), String(body.password || ""));
    const session = createSession(user.id);
    const res = NextResponse.json({ data: user, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() }, { status: 201 });
    res.headers.set("Set-Cookie", sessionCookieHeader(session.token, process.env.NODE_ENV === "production"));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
