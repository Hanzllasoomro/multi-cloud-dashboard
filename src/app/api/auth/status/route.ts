export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { demoAuthEnabled, listUsers } from "../../../../lib/auth";
import { metaFor } from "../../../../lib/query";

// GET /api/auth/status — deliberately minimal, for UX only: does any
// account exist on this server, and is demo auth enabled? It never
// reveals emails, counts, hashes, or whether a specific email exists, so
// it cannot be used to enumerate accounts. Login failures still return
// the generic "Invalid email or password" for the same reason.
export async function GET() {
  return NextResponse.json({
    data: { hasUsers: listUsers().length > 0, demoAuthEnabled: demoAuthEnabled() },
    totals: { cost: 0, usage: 0, rows: 1 },
    meta: metaFor(),
  });
}
