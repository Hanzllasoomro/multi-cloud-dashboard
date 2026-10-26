// Ledger — first-gate middleware (v1.3).
//
// IMPORTANT LIMIT: middleware runs on the edge and cannot validate a
// session token against the server store, so it only checks that the
// session cookie is PRESENT. The authoritative check lives in
// src/lib/auth-guard.ts, which every protected API route calls, and
// which validates the token and the role. An expired/forged cookie
// passes middleware but fails every protected route with 401, and the
// AppShell redirects to /login when /api/auth/me returns 401.
import { NextRequest, NextResponse } from "next/server";
// Deliberately NOT importing src/lib/auth here: middleware runs on the
// edge runtime, where node:crypto (used by auth.ts) is unavailable.
// The cookie name is duplicated on purpose — keep it in sync with
// SESSION_COOKIE in src/lib/auth.ts.
const SESSION_COOKIE = "ledger_session";

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_PREFIXES = ["/api/auth", "/_next", "/favicon.ico"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasCookie) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required — sign in first." }, { status: 401 });
    }
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
