export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "../../../../lib/auth";
import { requireUser } from "../../../../lib/auth-guard";
import { metaFor } from "../../../../lib/query";

// GET /api/auth/api-keys — list my keys (never the full key value).
// POST /api/auth/api-keys { name } — create a key. The full key is
// returned exactly once; it is stored only as a hash after that.
export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  const data = listApiKeys(auth.user!.id);
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => ({}));
  try {
    const data = createApiKey(auth.user!.id, String(body.name || ""));
    return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create API key." }, { status: 400 });
  }
}
