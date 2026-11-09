export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listUserSessions, SESSION_COOKIE } from "../../../../lib/auth";
import { requireUser } from "../../../../lib/auth-guard";
import { metaFor } from "../../../../lib/query";

// GET /api/auth/sessions — list my sessions (token prefixes only, never
// full tokens), newest first, with the current session flagged.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const data = await listUserSessions(auth.user!.id, req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}
