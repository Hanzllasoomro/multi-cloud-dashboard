export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  clearFailedAttempts, createSession, getStoredUserByEmail, isRateLimited,
  originOk, rateLimitKey, recordFailedAttempt, sessionCookieHeader, validateEmail,
  verifyPassword,
} from "../../../../lib/auth";
import { clientIp } from "../../../../lib/auth-guard";
import { metaFor } from "../../../../lib/query";

// POST /api/auth/login — generic "Invalid email or password" on failure so
// an attacker cannot tell a valid email from an invalid one. Rate-limited:
// 5 failed attempts per email+IP in 15 minutes, then 429.
export async function POST(req: NextRequest) {
  if (!originOk(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ error: "Origin check failed." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const key = rateLimitKey(email, clientIp(req));
  if (isRateLimited(key)) {
    return NextResponse.json({ error: "Too many failed sign-in attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const user = validateEmail(email) ? undefined : getStoredUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailedAttempt(key);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  clearFailedAttempts(key);
  const session = createSession(user.id);
  const res = NextResponse.json({ data: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt }, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  res.headers.set("Set-Cookie", sessionCookieHeader(session.token, process.env.NODE_ENV === "production"));
  return res;
}
