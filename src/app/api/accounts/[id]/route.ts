export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAccount, removeAccount, updateAccount } from "../../../../lib/accounts";
import { metaFor } from "../../../../lib/query";

function err(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
// PATCH /api/accounts/[id] — edit name/scope, or pause/resume (status Paused|Healthy only).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const split = (v: unknown): string[] | undefined => v === undefined ? undefined : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : undefined;
    const acc = updateAccount(params.id, {
      displayName: body.displayName,
      scope: body.scope ? {
        providers: body.scope.providers,
        accounts: split(body.scope.accounts),
        tags: split(body.scope.tags),
        teams: split(body.scope.teams),
      } : undefined,
      status: body.status,
    });
    return NextResponse.json({ data: acc, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid update", e instanceof Error && e.message === "Account not found" ? 404 : 400); }
}
// DELETE /api/accounts/[id]?confirm=<exact display name>&data=keep|purge
// Typed confirmation is mandatory: a mismatched or missing confirm is rejected.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const confirm = req.nextUrl.searchParams.get("confirm") ?? "";
  const data = req.nextUrl.searchParams.get("data") ?? "";
  if (!getAccount(params.id)) return err("Account not found", 404);
  try {
    const acc = removeAccount(params.id, confirm, data as "keep" | "purge");
    return NextResponse.json({ data: acc, totals: { cost: 0, usage: 0, rows: 1 }, meta: metaFor() });
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid delete"); }
}
