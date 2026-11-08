export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { revokeApiKey } from "../../../../../lib/auth";
import { requireUser } from "../../../../../lib/auth-guard";
import { metaFor } from "../../../../../lib/query";

// DELETE /api/auth/api-keys/[id] — revoke one of my keys. A revoked key
// stops working immediately.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  try {
    const data = revokeApiKey(auth.user!.id, params.id);
    return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not revoke API key." }, { status: 400 });
  }
}
