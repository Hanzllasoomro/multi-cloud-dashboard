export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../lib/auth-guard";
import { listUsers } from "../../../lib/auth";
import { metaFor } from "../../../lib/query";

// GET /api/users — team members, Owner/Admin only (manageMembers).
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, "manageMembers");
  if (auth.response) return auth.response;
  const data = listUsers();
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}
