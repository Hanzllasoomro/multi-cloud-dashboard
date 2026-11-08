// Ledger — server-side auth guard for API routes (v1.6).
//
// Middleware (src/middleware.ts) only checks that a session cookie is
// PRESENT — it runs on the edge and cannot validate the token. These
// helpers are the authoritative check: they validate the session against
// the server store (or an API key) and enforce the role permission.
// Every protected API route must call one of them; UI hiding alone is
// never enforcement.
//
// Authentication, in order: (1) httpOnly session cookie, (2) API key
// via `Authorization: Bearer lk_...` or `X-Ledger-Api-Key`. An API key
// inherits its owner's role at use time, so a role change applies to
// the key immediately, and a revoked key stops working at once.
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, validateApiKey, validateSession, type PublicUser } from "./auth";
import { can, type Permission } from "./permissions";

export type AuthResult =
  | { user: PublicUser; via: "session" | "api-key"; response: null }
  | { user: null; via: null; response: NextResponse };

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

export function authFromRequest(req: NextRequest): { user: PublicUser | null; via: "session" | "api-key" | null } {
  const sessionUser = sessionUserFromRequest(req);
  if (sessionUser) return { user: sessionUser, via: "session" };
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const keyUser = validateApiKey(bearer || req.headers.get("x-ledger-api-key"));
  if (keyUser) return { user: keyUser, via: "api-key" };
  return { user: null, via: null };
}

export function requireUser(req: NextRequest): AuthResult {
  const { user, via } = authFromRequest(req);
  return user && via ? { user, via, response: null } : { user: null, via: null, response: unauthenticated() };
}

export function requirePermission(req: NextRequest, permission: Permission): AuthResult {
  const auth = requireUser(req);
  if (auth.response) return auth;
  if (!can(auth.user!.role, permission)) return { user: null, via: null, response: forbidden(permission) };
  return auth;
}

/** Client IP for rate limiting: first X-Forwarded-For entry, else a fallback. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
