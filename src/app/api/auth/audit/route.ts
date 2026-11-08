export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listAuthEvents } from "../../../../lib/auth";
import { requirePermission } from "../../../../lib/auth-guard";
import { metaFor } from "../../../../lib/query";

// GET /api/auth/audit — auth audit log, newest first. Owner, Admin and
// Auditor only (viewAudit). Events: logins, MFA, resets, API keys,
// sessions, role changes, registrations.
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, "viewAudit");
  if (auth.response) return auth.response;
  const data = listAuthEvents(200);
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}
