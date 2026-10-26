export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createSession, demoAuthEnabled, getOrCreateDemoUser, sessionCookieHeader } from "../../../../lib/auth";
import { metaFor } from "../../../../lib/query";

// POST /api/auth/demo — hackathon judge access. ONLY when LEDGER_DEMO_AUTH=true.
// The demo session is always a Viewer, never an Owner. When the flag is off
// this route returns 403 and creates nothing.
export async function POST(_req: NextRequest) {
  if (!demoAuthEnabled()) {
    return NextResponse.json({ error: "Demo sign-in is disabled. Set LEDGER_DEMO_AUTH=true to enable it for a demo, and keep it off for real deployments." }, { status: 403 });
  }
  const user = getOrCreateDemoUser();
  const session = createSession(user.id);
  const res = NextResponse.json({ data: user, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  res.headers.set("Set-Cookie", sessionCookieHeader(session.token, process.env.NODE_ENV === "production"));
  return res;
}
