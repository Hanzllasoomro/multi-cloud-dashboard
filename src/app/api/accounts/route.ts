export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createAccount, listAccounts, type CreateAccountInput } from "../../../lib/accounts";
import { metaFor } from "../../../lib/query";

function err(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
// GET /api/accounts — identifiers + scopes only. Never credentials (none are stored).
export async function GET() {
  const data = listAccounts();
  return NextResponse.json({ data, totals: { cost: 0, usage: 0, rows: data.length }, meta: metaFor() });
}
// POST /api/accounts — no secret fields accepted; unknown fields are ignored.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const split = (v: unknown): string[] => typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : [];
    const input: CreateAccountInput = {
      provider: body.provider,
      displayName: body.displayName,
      accountId: body.accountId,
      billingAccount: body.billingAccount,
      scope: {
        providers: body.scope?.providers,
        accounts: split(body.scope?.accounts),
        tags: split(body.scope?.tags),
        teams: split(body.scope?.teams),
      },
    };
    const acc = createAccount(input);
    return NextResponse.json({ data: acc, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() }, { status: 201 });
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid account"); }
}
