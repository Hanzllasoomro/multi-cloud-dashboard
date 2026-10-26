// Ledger — server-side auth guard for API routes (v1.3).
//
// Middleware (src/middleware.ts) only checks that a session cookie is
// PRESENT — it runs on the edge and cannot validate the token. These
// helpers are the authoritative check: they validate the session against
// the server store and enforce the role permission. Every protected API
// route must call one of them; UI hiding alone is never enforcement.
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, validateSession, type PublicUser } from "./auth";
import { can, type Permission } from "./permissions";

export type AuthResult =
  | { user: PublicUser; response: null }
  | { user: null; response: NextResponse };

function unauthenticated(message = "Authentication required — sign in first."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
function forbidden(permission: Permission): NextResponse {
  return NextResponse.json(
    { error: `Forbidden — your role does not have permission: ${permission}. Ask an Owner or Admin to change your role in Settings > Team members.` },
    { status: 403 },
  );
}

export function sessionUserFromRequest(req: NextRequest): PublicUser | null {
  return validateSession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function requireUser(req: NextRequest): AuthResult {
  const user = sessionUserFromRequest(req);
  return user ? { user, response: null } : { user: null, response: unauthenticated() };
}

export function requirePermission(req: NextRequest, permission: Permission): AuthResult {
  const auth = requireUser(req);
  if (auth.response) return auth;
  if (!can(auth.user!.role, permission)) return { user: null, response: forbidden(permission) };
  return auth;
}

/** Client IP for rate limiting: first X-Forwarded-For entry, else a fallback. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
