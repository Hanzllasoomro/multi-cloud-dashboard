export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth-guard";
import { changeUserRole } from "../../../../lib/auth";
import { ROLES, type Role } from "../../../../lib/permissions";
import { metaFor } from "../../../../lib/query";

// PATCH /api/users/[id] — change a user's role. Owner/Admin only.
// Never allows demoting the last Owner (enforced in auth.changeUserRole).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, "manageMembers");
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const role = String(body.role || "") as Role;
    if (!ROLES.includes(role)) return NextResponse.json({ error: "role must be one of: " + ROLES.join(", ") }, { status: 400 });
    const user = changeUserRole(params.id, role);
    return NextResponse.json({ data: user, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Role change failed";
    return NextResponse.json({ error: msg }, { status: msg === "User not found" ? 404 : 400 });
  }
}
