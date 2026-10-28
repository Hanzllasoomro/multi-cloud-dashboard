export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-guard";
import { NextRequest } from "next/server";
import { allRows } from "../../../lib/data";
import { evaluateBudgets } from "../../../lib/insights";
import { metaFor } from "../../../lib/query";
import { applyScenario } from "../../../lib/demo-scenario";
import { loadScenario } from "../../../lib/demo-scenario-store";
import { getDataSource } from "../../../lib/providers/source";
function demoRows() { const rows = allRows(); return getDataSource() === "demo" ? applyScenario(rows, loadScenario()) : rows; }
export async function GET(req: NextRequest) {
  const auth = requireUser(req); if (auth.response) return auth.response; const d = evaluateBudgets(demoRows()); return NextResponse.json({ data: d, totals: { cost: d.reduce((a,b)=>a+b.forecast,0), usage: 0, rows: d.length }, meta: metaFor() }); }
